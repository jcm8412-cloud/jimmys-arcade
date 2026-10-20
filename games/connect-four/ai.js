/* Connect Four rules and computer players, no DOM.
   Board: 7 columns x 6 rows. cells[row * 7 + col], row 0 is the bottom. 0 = empty, 1 or 2 = a player. */
window.C4 = (function () {
  const COLS = 7, ROWS = 6;
  const ORDER = [3, 2, 4, 1, 5, 0, 6]; // center first: better moves get searched first
  const other = p => 3 - p;

  // Zobrist hashing: two random 32-bit numbers per (player, cell), XORed in as pieces are played,
  // so the search can recognise a position it has already analysed. Seeded, so it's the same every time.
  let seed = 0x9e3779b9;
  const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
  const ZA = [null, [], []], ZB = [null, [], []];
  for (const p of [1, 2]) for (let i = 0; i < COLS * ROWS; i++) { ZA[p][i] = rnd(); ZB[p][i] = rnd(); }

  function newBoard() {
    return { cells: new Array(COLS * ROWS).fill(0), heights: new Array(COLS).fill(0), moves: [], ha: 0, hb: 0 };
  }
  const canPlay = (b, c) => c >= 0 && c < COLS && b.heights[c] < ROWS;
  const isFull = b => b.moves.length === COLS * ROWS;
  const validMoves = b => ORDER.filter(c => canPlay(b, c));

  // Drop a piece; returns the row it landed in.
  function play(b, c, p) {
    const row = b.heights[c]++;
    const i = row * COLS + c;
    b.cells[i] = p;
    b.ha ^= ZA[p][i]; b.hb ^= ZB[p][i];
    b.moves.push(c);
    return row;
  }
  function undo(b) {
    const c = b.moves.pop();
    if (c === undefined) return null;
    const row = --b.heights[c];
    const i = row * COLS + c;
    const p = b.cells[i];
    b.ha ^= ZA[p][i]; b.hb ^= ZB[p][i];
    b.cells[i] = 0;
    return { col: c, row };
  }
  const hashKey = b => (b.ha >>> 0) * 2097152 + ((b.hb >>> 0) & 0x1fffff);

  // The four winning cells through (row, col), or null. Checks across, down, and both diagonals.
  const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
  function winAt(b, row, col) {
    const p = b.cells[row * COLS + col];
    if (!p) return null;
    for (const [dr, dc] of DIRS) {
      const line = [[row, col]];
      for (const s of [1, -1]) {
        let r = row + dr * s, c = col + dc * s;
        while (r >= 0 && r < ROWS && c >= 0 && c < COLS && b.cells[r * COLS + c] === p) {
          line.push([r, c]);
          r += dr * s; c += dc * s;
        }
      }
      if (line.length >= 4) {
        line.sort((a, z) => a[0] - z[0] || a[1] - z[1]);
        // Keep four in a row that include the new piece.
        const i = line.findIndex(([r, c]) => r === row && c === col);
        const start = Math.max(0, Math.min(i, line.length - 4));
        return line.slice(start, start + 4).map(([r, c]) => r * COLS + c);
      }
    }
    return null;
  }
  // Would playing column c win for p?
  function winsWith(b, c, p) {
    if (!canPlay(b, c)) return false;
    const row = play(b, c, p);
    const w = !!winAt(b, row, c);
    undo(b);
    return w;
  }
  const winningMove = (b, p) => validMoves(b).find(c => winsWith(b, c, p));

  /* ---------- Position score for the search ---------- */
  function scoreWindow(a, b, c, d, me) {
    let mine = 0, theirs = 0;
    for (const v of [a, b, c, d]) { if (v === me) mine++; else if (v) theirs++; }
    if (mine && theirs) return 0;
    if (mine === 3) return 6;
    if (mine === 2) return 2;
    if (theirs === 3) return -7;
    if (theirs === 2) return -2;
    return 0;
  }
  function evaluate(b, me) {
    const x = b.cells;
    let s = 0;
    for (let r = 0; r < ROWS; r++) if (x[r * COLS + 3] === me) s += 3; else if (x[r * COLS + 3]) s -= 3;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      if (c <= 3) s += scoreWindow(x[i], x[i + 1], x[i + 2], x[i + 3], me);
      if (r <= 2) s += scoreWindow(x[i], x[i + 7], x[i + 14], x[i + 21], me);
      if (r <= 2 && c <= 3) s += scoreWindow(x[i], x[i + 8], x[i + 16], x[i + 24], me);
      if (r <= 2 && c >= 3) s += scoreWindow(x[i], x[i + 6], x[i + 12], x[i + 18], me);
    }
    return s;
  }

  /* Threat parity, the key to Connect Four endgames. A "threat" is an empty cell that would complete
     four for a player. The player who moved first wants threats on odd rows (1st, 3rd, 5th from the
     bottom); the second player wants them on even rows. Used by Impossible only. */
  function completesFour(x, i, p) {
    const r = Math.floor(i / COLS), c = i % COLS;
    for (const [dr, dc] of DIRS) {
      let n = 1;
      for (const s of [1, -1]) {
        let rr = r + dr * s, cc = c + dc * s;
        while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && x[rr * COLS + cc] === p) { n++; rr += dr * s; cc += dc * s; }
      }
      if (n >= 4) return true;
    }
    return false;
  }
  function threatScore(b, me) {
    const x = b.cells;
    const meFirst = b.moves.length % 2 === 0; // "me" is to move, so I'm the first player if an even number of moves were made
    let s = 0;
    for (let c = 0; c < COLS; c++) {
      for (let r = b.heights[c] + 1; r < ROWS; r++) { // cells above the next playable one
        const i = r * COLS + c;
        const oddRow = r % 2 === 0; // row 0 is the 1st row
        for (const p of [me, other(me)]) {
          if (!completesFour(x, i, p)) continue;
          const pFirst = p === me ? meFirst : !meFirst;
          const good = pFirst === oddRow;
          s += (p === me ? 1 : -1) * (good ? 40 : 12);
        }
      }
    }
    return s;
  }

  /* ---------- Search (negamax with alpha-beta) ---------- */
  const WIN = 1e6;
  const TIMEOUT = {};
  // stats.tt (optional): a Map of positions already analysed -> { depth, score, flag, move }.
  // flag 0 = exact score, 1 = at least this score, 2 = at most this score.
  function negamax(b, depth, alpha, beta, me, deadline, stats) {
    if (deadline && (++stats.nodes & 1023) === 0 && performance.now() > deadline) throw TIMEOUT;
    if (isFull(b)) return 0;
    const moves = validMoves(b);
    // A win right now beats anything a deeper search could find.
    for (const c of moves) {
      const row = play(b, c, me);
      const won = winAt(b, row, c);
      undo(b);
      if (won) return WIN + depth; // sooner wins score higher
    }
    if (depth === 0) return evaluate(b, me) + (stats.parity ? threatScore(b, me) : 0);

    const tt = stats.tt;
    const key = tt ? hashKey(b) : 0;
    const alpha0 = alpha;
    let order = moves;
    if (tt) {
      const e = tt.get(key);
      if (e) {
        if (e.depth >= depth) {
          if (e.flag === 0) return e.score;
          if (e.flag === 1 && e.score > alpha) alpha = e.score;
          else if (e.flag === 2 && e.score < beta) beta = e.score;
          if (alpha >= beta) return e.score;
        }
        if (e.move != null) order = [e.move].concat(moves.filter(c => c !== e.move));
      }
    }

    let best = -Infinity, bestMove = null;
    for (const c of order) {
      play(b, c, me);
      const score = -negamax(b, depth - 1, -beta, -alpha, other(me), deadline, stats);
      undo(b);
      if (score > best) { best = score; bestMove = c; }
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    if (tt) tt.set(key, { depth, score: best, flag: best <= alpha0 ? 2 : best >= beta ? 1 : 0, move: bestMove });
    return best;
  }
  // Best column at a fixed depth. Ties go to the more central column.
  function searchDepth(b, me, depth, deadline, stats, first) {
    let bestCol = null, bestScore = -Infinity, alpha = -Infinity;
    const order = first == null ? validMoves(b) : [first].concat(validMoves(b).filter(c => c !== first));
    for (const c of order) {
      const row = play(b, c, me);
      let score;
      if (winAt(b, row, c)) score = WIN + depth;
      else score = -negamax(b, depth - 1, -Infinity, -alpha, other(me), deadline, stats);
      undo(b);
      if (score > bestScore) { bestScore = score; bestCol = c; }
      if (score > alpha) alpha = score;
    }
    return { col: bestCol, score: bestScore };
  }

  /* ---------- The four levels ---------- */
  const random = list => list[Math.floor(Math.random() * list.length)];

  // Easy: random, but blocks an immediate win about half the time.
  function easy(b, me) {
    const block = winningMove(b, other(me));
    if (block !== undefined && Math.random() < 0.5) return block;
    return random(validMoves(b));
  }

  // Medium: takes a win, blocks a win, otherwise plays near the center (avoiding moves that hand over a win).
  function medium(b, me) {
    const win = winningMove(b, me);
    if (win !== undefined) return win;
    const block = winningMove(b, other(me));
    if (block !== undefined) return block;
    const safe = validMoves(b).filter(c => {
      play(b, c, me);
      const gives = winsWith(b, c, other(me));
      undo(b);
      return !gives;
    });
    const options = safe.length ? safe : validMoves(b);
    // validMoves is center-first; pick between the two most central options for a little variety.
    return random(options.slice(0, Math.min(2, options.length)));
  }

  // Hard: a few moves deep.
  function hard(b, me) {
    const win = winningMove(b, me);
    if (win !== undefined) return win;
    return searchDepth(b, me, 5, 0, { nodes: 0 }).col;
  }

  // Impossible: as deep as it can within the time budget, keeping the best fully searched answer.
  function impossible(b, me, budgetMs) {
    const win = winningMove(b, me);
    if (win !== undefined) return win;
    const block = winningMove(b, other(me));
    if (block !== undefined) return block;
    const deadline = performance.now() + (budgetMs || 600);
    const stats = { nodes: 0, tt: new Map(), parity: true };
    const start = b.moves.length;
    let best = validMoves(b)[0];
    for (let depth = 2; depth <= COLS * ROWS - start; depth++) {
      try {
        const r = searchDepth(b, me, depth, deadline, stats, best);
        best = r.col;
        if (r.score >= WIN) break; // found a forced win
      } catch (e) {
        // Running out of time stops the search mid-way: take back the moves it was trying.
        while (b.moves.length > start) undo(b);
        if (e === TIMEOUT) break;
        throw e;
      }
    }
    return best;
  }

  return {
    COLS, ROWS, newBoard, canPlay, isFull, validMoves, play, undo, winAt, winningMove,
    levels: { easy, medium, hard, impossible }
  };
})();

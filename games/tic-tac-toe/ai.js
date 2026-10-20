/* Tic-Tac-Toe rules and computer players, no DOM.
   A board is an array of 9 cells ("", "X" or "O"), read left to right, top to bottom. */
window.TTT = (function () {
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const other = m => (m === "X" ? "O" : "X");
  const newBoard = () => new Array(9).fill("");
  const empty = cells => cells.reduce((list, v, i) => (v ? list : list.concat(i)), []);
  const isFull = cells => cells.every(Boolean);

  // { mark, line } for a finished line, or null.
  function winner(cells) {
    for (const line of LINES) {
      const [a, b, c] = line;
      if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) return { mark: cells[a], line };
    }
    return null;
  }

  // A move that completes a line for `mark`, if there is one.
  function winningMove(cells, mark) {
    for (const i of empty(cells)) {
      cells[i] = mark;
      const w = winner(cells);
      cells[i] = "";
      if (w) return i;
    }
    return null;
  }

  /* Minimax over the whole game (the board is tiny, so every position is searched exactly).
     Score is from `me`'s point of view: +10 for a win, -10 for a loss, minus the moves it takes,
     so it prefers quick wins and slow losses. Results are remembered per position. */
  const memo = new Map();
  function score(cells, me, turn) {
    const key = cells.join(",") + "|" + me + turn;
    if (memo.has(key)) return memo.get(key);
    const w = winner(cells);
    let s;
    if (w) s = (w.mark === me ? 10 : -10) - (w.mark === me ? 1 : -1) * cells.filter(Boolean).length / 10;
    else if (isFull(cells)) s = 0;
    else {
      const results = empty(cells).map(i => {
        cells[i] = turn;
        const r = score(cells, me, other(turn));
        cells[i] = "";
        return r;
      });
      s = turn === me ? Math.max(...results) : Math.min(...results);
    }
    memo.set(key, s);
    return s;
  }
  // Every move with the best possible outcome for `me` (one of them is picked at random for variety).
  function perfectMoves(cells, me) {
    let best = -Infinity, moves = [];
    for (const i of empty(cells)) {
      cells[i] = me;
      const s = score(cells, me, other(me));
      cells[i] = "";
      if (s > best + 1e-9) { best = s; moves = [i]; } else if (Math.abs(s - best) < 1e-9) moves.push(i);
    }
    return moves;
  }

  const random = list => list[Math.floor(Math.random() * list.length)];
  const levels = {
    // Easy: random moves.
    easy: (cells) => random(empty(cells)),
    // Medium: wins or blocks when it can, otherwise random.
    medium: (cells, me) => {
      const win = winningMove(cells, me);
      if (win !== null) return win;
      const block = winningMove(cells, other(me));
      if (block !== null) return block;
      return random(empty(cells));
    },
    // Hard: perfect play 70% of the time, random otherwise.
    hard: (cells, me) => (Math.random() < 0.7 ? random(perfectMoves(cells, me)) : random(empty(cells))),
    // Impossible: always perfect, so it can never lose.
    impossible: (cells, me) => random(perfectMoves(cells, me))
  };

  return { LINES, newBoard, empty, isFull, winner, winningMove, perfectMoves, other, levels };
})();

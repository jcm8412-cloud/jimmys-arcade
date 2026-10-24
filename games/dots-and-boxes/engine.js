/* Dots and Boxes rules and computer players, no DOM.
   An n x n board of boxes has (n+1) x (n+1) dots. Lines are numbered: horizontals first
   (row r = 0..n, col c = 0..n-1 -> r*n + c), then verticals (row r = 0..n-1, col c = 0..n -> H + r*(n+1) + c).
   Box b = r*n + c. State: { n, drawn[line] 0/1, sides[box] 0..4, owner[box] player index or -1 }. */
window.DB = (function () {
  /* ---------- Geometry ---------- */
  const geo = {};
  function geometry(n) {
    if (geo[n]) return geo[n];
    const H = (n + 1) * n, L = 2 * n * (n + 1), B = n * n;
    const lineBoxes = Array.from({ length: L }, () => []), boxLines = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const b = r * n + c;
      const ls = [r * n + c, (r + 1) * n + c, H + r * (n + 1) + c, H + r * (n + 1) + c + 1];
      boxLines[b] = ls;
      for (const l of ls) lineBoxes[l].push(b);
    }
    return (geo[n] = { n, H, L, B, lineBoxes, boxLines });
  }

  /* ---------- Rules ---------- */
  function create(n) {
    const g = geometry(n);
    return { n, drawn: new Uint8Array(g.L), sides: new Uint8Array(g.B), owner: new Int8Array(g.B).fill(-1) };
  }
  const clone = s => ({ n: s.n, drawn: s.drawn.slice(), sides: s.sides.slice(), owner: s.owner.slice() });

  // Draw line l for player p. Returns the boxes it completed (0, 1 or 2): completing any means another turn.
  function draw(s, l, p) {
    const g = geometry(s.n);
    s.drawn[l] = 1;
    const done = [];
    for (const b of g.lineBoxes[l]) if (++s.sides[b] === 4) { s.owner[b] = p; done.push(b); }
    return done;
  }
  function erase(s, l) {
    const g = geometry(s.n);
    s.drawn[l] = 0;
    for (const b of g.lineBoxes[l]) { if (s.sides[b] === 4) s.owner[b] = -1; s.sides[b]--; }
  }
  const openLines = s => { const out = []; for (let l = 0; l < s.drawn.length; l++) if (!s.drawn[l]) out.push(l); return out; };
  const isOver = s => s.owner.every(o => o >= 0);

  // Lines that complete a box right now.
  function freeLines(s) {
    const g = geometry(s.n), out = new Set();
    for (let b = 0; b < g.B; b++) if (s.sides[b] === 3) for (const l of g.boxLines[b]) if (!s.drawn[l]) out.add(l);
    return [...out];
  }
  // A line is safe if it doesn't give any box its third side.
  function isSafe(s, l) {
    const g = geometry(s.n);
    return !s.drawn[l] && g.lineBoxes[l].every(b => s.sides[b] <= 1);
  }
  const safeLines = s => openLines(s).filter(l => isSafe(s, l));

  // Take every box that can be taken, in a row (on a copy). Returns how many.
  function captureAll(s, p) {
    let k = 0;
    for (let f = freeLines(s); f.length; f = freeLines(s)) k += draw(s, f[0], p).length;
    return k;
  }
  // How many boxes drawing line l hands to the other player (if they take everything).
  function gives(s, l) {
    const t = clone(s);
    draw(t, l, 0);
    return captureAll(t, 1);
  }

  /* ---------- Chain analysis (for the endgame) ----------
     When there are no safe lines and no free boxes, every unclaimed box usually has exactly two
     sides left, so the boxes form chains (open at both ends) and loops. Returns null otherwise. */
  function components(s) {
    const g = geometry(s.n), seen = new Uint8Array(g.B), comps = [];
    for (let b = 0; b < g.B; b++) if (s.owner[b] < 0 && s.sides[b] !== 2) return null;
    for (let start = 0; start < g.B; start++) {
      if (s.owner[start] >= 0 || seen[start]) continue;
      const stack = [start], boxes = [];
      seen[start] = 1;
      let ground = 0, groundLine = null;
      while (stack.length) {
        const b = stack.pop();
        boxes.push(b);
        for (const l of g.boxLines[b]) {
          if (s.drawn[l]) continue;
          const nb = g.lineBoxes[l].find(x => x !== b);
          if (nb === undefined) { ground++; if (groundLine == null) groundLine = l; continue; }
          if (!seen[nb]) { seen[nb] = 1; stack.push(nb); }
        }
      }
      const len = boxes.length;
      if (ground === 0) {
        const anyLine = g.boxLines[boxes[0]].find(l => !s.drawn[l]);
        comps.push({ type: "loop", len, open: anyLine });
      } else {
        // A 2-chain is opened in the middle (so the taker can't decline it); longer chains at an end.
        let open = groundLine;
        if (len === 2) open = g.boxLines[boxes[0]].find(l => !s.drawn[l] && g.lineBoxes[l].includes(boxes[1]));
        comps.push({ type: "chain", len, open });
      }
    }
    return comps;
  }

  /* Net boxes (mine minus theirs, from the remaining components) for the player who has to open one.
     The other player either takes the whole component and must open the next, or takes all but the
     last 2 (chain) / 4 (loop), declining those with a double-cross so the opener has to move again. */
  const vMemo = new Map();
  function value(comps) {
    if (!comps.length) return 0;
    const key = comps.map(c => c.type[0] + c.len).sort().join(",");
    if (vMemo.has(key)) return vMemo.get(key);
    let best = -Infinity;
    const tried = new Set();
    comps.forEach((c, i) => {
      const id = c.type + c.len;
      if (tried.has(id)) return;
      tried.add(id);
      const rest = value(comps.filter((_, j) => j !== i));
      const takeAll = -(c.len + rest);
      let v;
      if (c.type === "chain") v = c.len >= 3 ? Math.min(takeAll, 4 - c.len + rest) : takeAll;
      else v = Math.min(takeAll, 8 - c.len + rest);
      if (v > best) best = v;
    });
    vMemo.set(key, best);
    return best;
  }

  /* The double-cross: when exactly the last 2 boxes of a chain (or 4 of a loop) are left to take,
     the line that hands them over instead. Returns { line, give } or null. */
  function doubleCross(s) {
    const g = geometry(s.n);
    const free = [];
    for (let b = 0; b < g.B; b++) if (s.owner[b] < 0 && s.sides[b] === 3) free.push(b);
    const missing = b => g.boxLines[b].find(l => !s.drawn[l]);
    const across = (l, b) => g.lineBoxes[l].find(x => x !== b);
    const unclaimed2 = b => b !== undefined && s.owner[b] < 0 && s.sides[b] === 2;
    if (free.length === 1) {
      // Chain end: A (3 sides) - B (2 sides) - wall. Hand both over by drawing B's far side.
      const A = free[0], m = missing(A), B = across(m, A);
      if (!unclaimed2(B)) return null;
      const f = g.boxLines[B].find(l => !s.drawn[l] && l !== m);
      const C = across(f, B);
      if (C !== undefined && s.owner[C] < 0 && s.sides[C] >= 2) return null; // would hand over more
      return { line: f, give: 2 };
    }
    if (free.length === 2) {
      // Loop remainder: A - B - C - D with A and D free. Splitting B|C leaves two pairs to hand over.
      const [A, D] = free, B = across(missing(A), A), C = across(missing(D), D);
      if (!unclaimed2(B) || !unclaimed2(C) || B === C) return null;
      const x = g.boxLines[B].find(l => !s.drawn[l] && g.lineBoxes[l].includes(C));
      return x === undefined ? null : { line: x, give: 4 };
    }
    return null;
  }

  /* ---------- Computer players ---------- */
  const random = list => list[Math.floor(Math.random() * list.length)];
  // The open line that hands over the fewest boxes (opens the smallest chain or loop).
  function smallestSacrifice(s) {
    let best = null, bestGive = Infinity;
    for (const l of openLines(s)) {
      const k = gives(s, l);
      if (k < bestGive || (k === bestGive && Math.random() < 0.3)) { bestGive = k; best = l; }
    }
    return best;
  }

  // Easy: random lines; takes a free box only about half the time.
  function easy(s) {
    const free = freeLines(s);
    if (free.length && Math.random() < 0.5) return random(free);
    return random(openLines(s));
  }
  // Medium: always takes free boxes; otherwise avoids giving a box away when it can.
  function medium(s) {
    const free = freeLines(s);
    if (free.length) return free[0];
    const safe = safeLines(s);
    return random(safe.length ? safe : openLines(s));
  }
  // Hard: Medium, plus when no safe lines are left it opens the smallest chain or loop.
  function hard(s) {
    const free = freeLines(s);
    if (free.length) return free[0];
    const safe = safeLines(s);
    if (safe.length) return random(safe);
    return smallestSacrifice(s);
  }

  /* ---------- The endgame solver (used by Impossible) ----------
     Once no safe lines are left, every line gives something away. solve(s) is the best net score
     (from the remaining boxes) for the player who has to move, assuming best play: for each line they
     could draw, the other player either takes everything on offer and then has to move, or takes all
     but the last 2 (or 4, from a loop) and double-crosses, handing those over so the opener has to move
     again. Works for any shape, including junctions; positions already solved are remembered.
     Plain chains and loops use the exact formula in value(). Throws TIMEOUT past the deadline. */
  const TIMEOUT = {};
  function solveFast(s, ctx) {
    const comps = components(s);
    return comps ? value(comps) : solve(s, ctx);
  }
  function solve(s, ctx) {
    if (isOver(s)) return 0;
    const key = s.drawn.join("");
    if (ctx.memo.has(key)) return ctx.memo.get(key);
    if ((++ctx.nodes & 31) === 0 && performance.now() > ctx.deadline) throw TIMEOUT;
    let best = -Infinity;
    const results = new Map(); // lines that lead to the same position are only solved once
    for (const l of openLines(s)) {
      const t = clone(s);
      draw(t, l, 0);
      const r = respond(t, ctx, results);
      if (-r > best) best = -r;
    }
    ctx.memo.set(key, best);
    return best;
  }
  // Best net for the player to move when boxes are on offer (after the other player opened something).
  function respond(t, ctx, results) {
    const cur = clone(t);
    let taken = 0, declinable = 0;
    for (let f = freeLines(cur); f.length; f = freeLines(cur)) {
      if (!declinable) {
        const dc = doubleCross(cur);
        if (dc && dc.give === captureAll(clone(cur), 0)) declinable = dc.give;
      }
      taken += draw(cur, f[0], 0).length;
    }
    const key = cur.drawn.join("");
    let rest = results && results.get(key);
    if (rest === undefined) { rest = isOver(cur) ? 0 : solveFast(cur, ctx); if (results) results.set(key, rest); }
    let v = taken + rest;                                     // take everything, then move
    if (declinable) v = Math.max(v, taken - 2 * declinable - rest); // or double-cross
    return v;
  }

  /* Impossible: Hard, plus full chain control.
     - Boxes on offer: take them, except when exactly the last 2 (chain) or 4 (loop) are left and the
       double-cross is worth more; then hand them over to keep control.
     - No safe lines: draw the line the endgame solver rates best.
     - Safe lines left: search them (when few enough) so the other player ends up having to open the
       first chain. Everything stays inside the time budget; if time runs out it plays like Hard. */
  function impossible(s, me, budgetMs) {
    const ctx = { memo: new Map(), nodes: 0, deadline: performance.now() + (budgetMs || 350) };
    const free = freeLines(s);
    const safe = safeLines(s);
    try {
      if (free.length) {
        const after = clone(s);
        const k = captureAll(after, me);
        if (isOver(after) || safeLines(after).length) return free[0];
        const dc = doubleCross(s);
        if (dc && dc.give === k) {
          const rest = solveFast(after, ctx);
          return (k - 2 * dc.give - rest) > (k + rest) ? dc.line : free[0];
        }
        return free[0];
      }

      if (!safe.length) {
        let best = [], bestV = -Infinity;
        const results = new Map();
        for (const l of openLines(s)) {
          const t = clone(s);
          draw(t, l, me);
          const v = -respond(t, ctx, results);
          if (v > bestV) { bestV = v; best = [l]; } else if (v === bestV) best.push(l);
        }
        return random(best);
      }

      if (safe.length <= 18) {
        const memo = new Map();
        const search = t => {
          if ((++ctx.nodes & 63) === 0 && performance.now() > ctx.deadline) throw TIMEOUT;
          const key = t.drawn.join("");
          if (memo.has(key)) return memo.get(key);
          const moves = safeLines(t);
          let v;
          if (!moves.length) v = solveFast(t, ctx);
          else {
            v = -Infinity;
            for (const l of moves) {
              draw(t, l, 0);
              const r = -search(t);
              erase(t, l);
              if (r > v) v = r;
            }
          }
          memo.set(key, v);
          return v;
        };
        const t = clone(s);
        let best = [], bestV = -Infinity;
        for (const l of safe) {
          draw(t, l, me);
          const v = -search(t);
          erase(t, l);
          if (v > bestV) { bestV = v; best = [l]; } else if (v === bestV) best.push(l);
        }
        return random(best);
      }
    } catch (e) {
      if (e !== TIMEOUT) throw e;
      // Out of time: fall back to Hard's choice.
      if (free.length) return free[0];
      if (!safe.length) return smallestSacrifice(s);
    }
    return random(safe);
  }

  return {
    geometry, create, clone, draw, erase, openLines, freeLines, safeLines, isSafe, isOver,
    components, value, doubleCross, gives,
    levels: { easy, medium, hard, impossible }
  };
})();

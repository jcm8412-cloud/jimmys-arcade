/* Connect Four: vs the computer (Easy, Medium, Hard, Impossible) or two players on one phone.
   Saved data: connect-four:stats {playerId: {vs: {level: {w, l, t}}, pvp: {otherId: {w, l, t}}}},
   connect-four:lastSetup (last two-player pair). Guests' games aren't recorded. */
(function () {
  const A = window.Arcade;
  const $ = id => document.getElementById(id);
  const esc = A.esc;
  const ACCENT = "#9fd3e8";
  const { COLS, ROWS } = C4;

  const LEVELS = {
    easy: { name: "Easy", desc: "Plays for fun", undos: Infinity },
    medium: { name: "Medium", desc: "Blocks your wins", undos: 3 },
    hard: { name: "Hard", desc: "Thinks ahead", undos: 0 },
    impossible: { name: "Impossible", desc: "Very hard to beat", undos: 0 }
  };
  const COMPUTER = { id: null, name: "Computer", avatar: "robot" };
  const PIECE = { 1: { color: "#f3d36b", mark: "dot", label: "yellow" }, 2: { color: "#f29a9a", mark: "ring", label: "pink" } };

  /* ---------- Screens ---------- */
  const home = `<button class="icon-btn" data-home aria-label="Home"></button>`;
  const back = `<button class="back-link" data-c4-back>‹ Connect Four</button>`;
  $("game-root").insertAdjacentHTML("beforeend", `
  <section class="screen c4 menu" id="c4-menu" hidden>
    <header class="topbar"><div class="tb-left">${home}</div><h2></h2><div class="tb-right"></div></header>
    <h1 class="title">Connect <span>Four</span></h1>
    <p class="tagline">Drop your pieces. Get four in a row to win!</p>
    <div class="menu-buttons">
      <button class="btn big" id="c4-btn-cpu">Vs computer</button>
      <button class="btn big" id="c4-btn-two">Two players</button>
    </div>
  </section>

  <section class="screen c4" id="c4-levels" hidden>
    <header class="topbar"><div class="tb-left">${home}${back}</div><h2>Pick a level</h2><div class="tb-right"></div></header>
    <div class="playing-as" id="c4-playing-as"></div>
    <div class="levels" id="c4-level-list"></div>
  </section>

  <section class="screen c4" id="c4-setup" hidden>
    <header class="topbar"><div class="tb-left">${home}${back}</div><h2>Two players</h2><div class="tb-right"></div></header>
    <h3 class="label">Pick two players</h3>
    <div id="c4-picker"></div>
    <p class="note" id="c4-pair-record"></p>
    <p class="err" id="c4-setup-err" aria-live="polite"></p>
    <button class="btn big" id="c4-start">Start game</button>
  </section>

  <section class="screen c4 play" id="c4-game" hidden>
    <header class="topbar">
      <div class="tb-left">${home}</div>
      <h2 id="c4-title"></h2>
      <div class="tb-right"><button class="btn ghost undo" id="c4-undo" aria-label="Undo">Undo</button></div>
    </header>
    <p class="turn" id="c4-turn" aria-live="polite"></p>
    <div class="board-wrap"><svg class="grid" id="c4-board" viewBox="0 0 700 610" role="grid" aria-label="Connect Four board"></svg></div>
    <div class="result" id="c4-result" hidden>
      <div class="result-art" id="c4-art" aria-hidden="true"></div>
      <p class="banner" id="c4-banner" aria-live="assertive"></p>
      <div class="row" id="c4-result-actions"></div>
    </div>
  </section>`);

  /* ---------- Stats ---------- */
  let stats = A.store.get("connect-four:stats", {});
  const saveStats = () => A.store.set("connect-four:stats", stats);
  const blank = () => ({ w: 0, l: 0, t: 0 });
  function statsFor(id) {
    const s = stats[id] = stats[id] || {};
    s.vs = s.vs || {};
    s.pvp = s.pvp || {};
    return s;
  }
  const levelRecord = (id, level) => (id && stats[id] && stats[id].vs && stats[id].vs[level]) || blank();
  const pairRecord = (a, b) => (a && b && stats[a] && stats[a].pvp && stats[a].pvp[b]) || blank();

  /* ---------- Menu & setup ---------- */
  function showMenu() {
    A.setAccent(ACCENT);
    A.show("c4-menu");
  }
  document.querySelectorAll("[data-c4-back]").forEach(b => b.addEventListener("click", showMenu));
  $("c4-btn-cpu").addEventListener("click", () =>
    A.whoIsPlaying({ onDone: showLevels, onBack: showMenu, backLabel: "Connect Four" }));
  $("c4-btn-two").addEventListener("click", showSetup);

  function showLevels() {
    const p = A.session.player;
    $("c4-playing-as").innerHTML = `${A.avatarSvg(p)}<span>Playing: <b>${esc(p.name)}</b></span>
      <button class="btn ghost" id="c4-switch">Switch</button>`;
    $("c4-switch").addEventListener("click", () =>
      A.whoIsPlaying({ force: true, onDone: showLevels, onBack: showLevels, backLabel: "Levels" }));
    const box = $("c4-level-list");
    box.innerHTML = "";
    for (const [id, lv] of Object.entries(LEVELS)) {
      const r = levelRecord(p.id, id);
      const undo = lv.undos === Infinity ? "Undo any time" : lv.undos ? `${lv.undos} undos` : "No undo";
      const b = document.createElement("button");
      b.className = "level" + (id === "impossible" ? " impossible" : "");
      b.innerHTML = `<b>${lv.name}</b><small>${lv.desc} · ${undo}</small>
        <span class="stats" aria-hidden="true"><span>${r.w}</span><span>${r.l}</span><span>${r.t}</span><i>wins</i><i>losses</i><i>ties</i></span>`;
      b.setAttribute("aria-label", `${lv.name}: ${lv.desc}, ${undo}. Wins ${r.w}, losses ${r.l}, ties ${r.t}.`);
      b.addEventListener("click", () => startGame({ mode: "cpu", level: id, players: [p, COMPUTER], first: 0 }));
      box.appendChild(b);
    }
    A.setAccent(ACCENT);
    A.show("c4-levels");
  }

  let picker = null;
  function showSetup() {
    A.setAccent(ACCENT);
    $("c4-setup-err").textContent = "";
    picker = A.playerPicker($("c4-picker"), {
      min: 2, max: 2, initial: A.store.get("connect-four:lastSetup", []),
      onChange: () => { $("c4-setup-err").textContent = ""; showPairRecord(); }
    });
    showPairRecord();
    A.show("c4-setup");
  }
  function showPairRecord() {
    const [a, b] = picker.get();
    const r = a && b ? pairRecord(a.id, b.id) : null;
    $("c4-pair-record").textContent = r && (r.w || r.l || r.t)
      ? `${a.name} vs ${b.name}: ${r.w} wins, ${r.l} losses, ${r.t} ties` : "";
  }
  $("c4-start").addEventListener("click", () => {
    if (picker.count() < 2) { $("c4-setup-err").textContent = "Pick two players."; return; }
    A.store.set("connect-four:lastSetup", picker.entries());
    startGame({ mode: "two", players: picker.get(), first: 0 });
  });

  /* ---------- Playing ---------- */
  // G: { mode, level, players: [p1, p2] (piece 1, piece 2), first (index who starts), board, turn (1|2),
  //      over, winCells, undosLeft, themeId, busy, lastDrop }
  let G = null;

  function startGame({ mode, level, players, first }) {
    G = {
      mode, level, players, first,
      board: C4.newBoard(),
      turn: first + 1,
      over: false, winCells: null,
      undosLeft: mode === "cpu" ? LEVELS[level].undos : 0,
      themeId: A.resolveTheme(A.settings.theme),
      busy: false, lastDrop: null
    };
    A.noteThemeUsed(G.themeId);
    A.setAccent(ACCENT);
    $("c4-title").textContent = mode === "cpu" ? `Vs ${LEVELS[level].name}` : `${players[0].name} vs ${players[1].name}`;
    $("c4-result").hidden = true;
    A.show("c4-game");
    render();
    if (isComputerTurn()) computerMove();
  }

  const isComputerTurn = () => G.mode === "cpu" && G.turn === 2 && !G.over;
  const playerFor = piece => G.players[piece - 1];

  function render() {
    const b = G.board;
    const W = 100, PAD = 5;
    let svg = `<rect class="frame" x="2" y="8" width="696" height="598" rx="18"/>`;
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const cx = c * W + 50, cy = (ROWS - 1 - r) * W + 58;
        const p = b.cells[r * COLS + c];
        if (!p) { svg += `<circle class="hole" cx="${cx}" cy="${cy}" r="38"/>`; continue; }
        const isNew = G.lastDrop && G.lastDrop.row === r && G.lastDrop.col === c;
        const win = G.winCells && G.winCells.includes(r * COLS + c);
        const drop = isNew ? ` style="--drop:${-(cy + 60)}px;--dur:${0.22 + (ROWS - r) * 0.05}s"` : "";
        svg += `<g class="piece p${p}${isNew ? " drop" : ""}${win ? " win" : ""}"${drop}>
          <circle cx="${cx}" cy="${cy}" r="${38 - PAD / 2}" fill="${PIECE[p].color}" fill-opacity=".85" stroke="${PIECE[p].color}"/>
          ${PIECE[p].mark === "dot" ? `<circle class="mark" cx="${cx}" cy="${cy}" r="9"/>` : `<circle class="mark ring" cx="${cx}" cy="${cy}" r="18"/>`}
        </g>`;
      }
    }
    // Full-height tap targets, one per column.
    for (let c = 0; c < COLS; c++) {
      const full = !C4.canPlay(b, c);
      svg += `<rect class="col-hit${full ? " full" : ""}" data-col="${c}" x="${c * W}" y="0" width="${W}" height="610"
        role="button" aria-label="Column ${c + 1}${full ? ", full" : ""}"/>`;
    }
    $("c4-board").innerHTML = svg;
    $("c4-board").classList.toggle("locked", G.over || G.busy || isComputerTurn());
    renderTurn();
    renderUndo();
  }

  function renderTurn() {
    if (G.over) { $("c4-turn").innerHTML = ""; return; }
    const p = playerFor(G.turn);
    const piece = `<svg class="mini" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" fill="${PIECE[G.turn].color}"/>${PIECE[G.turn].mark === "dot" ? '<circle cx="20" cy="20" r="4" class="m"/>' : '<circle cx="20" cy="20" r="8" class="m ring"/>'}</svg>`;
    const text = G.mode === "cpu" ? (G.turn === 1 ? "Your turn" : "Thinking…") : `${esc(p.name)}'s turn`;
    $("c4-turn").innerHTML = `${A.avatarSvg(p)}<span>${text}</span>${piece}`;
    $("c4-turn").classList.toggle("thinking", isComputerTurn());
  }

  function renderUndo() {
    const btn = $("c4-undo");
    const allowed = G.mode === "cpu" && LEVELS[G.level].undos > 0;
    btn.hidden = !allowed;
    if (!allowed) return;
    const humanMoved = G.board.moves.length > (G.first === 1 ? 1 : 0);
    btn.disabled = G.over || G.busy || isComputerTurn() || !humanMoved || G.undosLeft <= 0;
    btn.textContent = G.undosLeft === Infinity ? "Undo" : `Undo (${G.undosLeft})`;
  }

  $("c4-board").addEventListener("click", e => {
    const hit = e.target.closest(".col-hit");
    if (hit) humanMove(+hit.dataset.col);
  });
  document.addEventListener("keydown", e => {
    if (A.currentScreen !== "c4-game" || A.dialogOpen() || e.target.tagName === "INPUT") return;
    if (/^[1-7]$/.test(e.key)) humanMove(+e.key - 1);
  });

  function humanMove(col) {
    if (!G || G.over || G.busy || isComputerTurn() || !C4.canPlay(G.board, col)) return;
    drop(col);
    if (!G.over && isComputerTurn()) computerMove();
  }

  function drop(col) {
    const row = C4.play(G.board, col, G.turn);
    G.lastDrop = { row, col };
    A.sfx.right();
    const win = C4.winAt(G.board, row, col);
    if (win) { G.winCells = win; finish(G.turn); }
    else if (C4.isFull(G.board)) finish(0);
    else G.turn = 3 - G.turn;
    render();
  }

  function computerMove() {
    G.busy = true;
    render();
    const game = G;
    // Let the player's piece land first. Pause + Impossible's 500 ms search keeps the reply under a second.
    setTimeout(() => {
      if (G !== game || G.over) return;
      const col = G.level === "impossible" ? C4.levels.impossible(G.board, 2, 500) : C4.levels[G.level](G.board, 2);
      G.busy = false;
      drop(col);
    }, 250);
  }

  $("c4-undo").addEventListener("click", () => {
    if (!G || G.mode !== "cpu" || G.over || G.busy || G.undosLeft <= 0) return;
    // Take back the computer's reply and your move (unless the computer moved first and nothing else).
    const minMoves = G.first === 1 ? 1 : 0;
    if (G.board.moves.length - 2 < minMoves) return;
    C4.undo(G.board);
    C4.undo(G.board);
    G.turn = 1;
    G.lastDrop = null;
    if (G.undosLeft !== Infinity) G.undosLeft--;
    render();
  });

  function finish(winner) {
    G.over = true;
    G.busy = false;
    record(winner);
    const theme = A.getTheme(G.themeId);
    let banner, outcome;
    if (winner === 0) { banner = "It's a tie!"; outcome = null; }
    else if (G.mode === "cpu") {
      outcome = winner === 1 ? "win" : "lose";
      banner = winner === 1 ? "You win!" : "The computer wins!";
    } else {
      outcome = "win";
      banner = `${playerFor(winner).name} wins!`;
    }
    setTimeout(() => (winner === 0 || outcome === "lose" ? A.sfx.lose() : A.sfx.win()), 300);
    if (outcome === "lose") A.buzz();
    // After the winning four light up, the picture theme plays its win or loss animation.
    setTimeout(() => {
      if (!G.over) return;
      $("c4-art").innerHTML = outcome
        ? A.themeSvg(theme, A.themeView(theme, outcome === "lose" ? 8 : 0, 8), outcome) : "";
      $("c4-art").hidden = !outcome;
      $("c4-banner").textContent = banner;
      $("c4-banner").className = "banner " + (outcome === "lose" ? "lose" : outcome ? "win" : "");
      const actions = $("c4-result-actions");
      actions.innerHTML = "";
      const add = (label, cls, run) => {
        const b = document.createElement("button");
        b.className = "btn " + cls;
        b.textContent = label;
        b.addEventListener("click", run);
        actions.appendChild(b);
      };
      // Whoever didn't start this game starts the next one.
      add("Play again", "", () => startGame({ mode: G.mode, level: G.level, players: G.players, first: 1 - G.first }));
      add("Menu", "ghost", () => (G.mode === "cpu" ? showLevels() : showMenu()));
      $("c4-result").hidden = false;
    }, 900);
  }

  function record(winner) {
    if (G.mode === "cpu") {
      const p = G.players[0];
      if (!p.id) return;
      const r = statsFor(p.id).vs[G.level] = statsFor(p.id).vs[G.level] || blank();
      if (winner === 1) r.w++; else if (winner === 2) r.l++; else r.t++;
    } else {
      const [a, b] = G.players;
      if (!a.id || !b.id) return;
      const ra = statsFor(a.id).pvp[b.id] = statsFor(a.id).pvp[b.id] || blank();
      const rb = statsFor(b.id).pvp[a.id] = statsFor(b.id).pvp[a.id] || blank();
      if (winner === 1) { ra.w++; rb.l++; } else if (winner === 2) { ra.l++; rb.w++; } else { ra.t++; rb.t++; }
    }
    saveStats();
  }

  A.homeGuards["c4-game"] = () => (G && !G.over && G.board.moves.length
    ? A.confirm("Leave this game? It won't count.", "Leave") : Promise.resolve(true));

  /* ---------- Register with the arcade ---------- */
  A.registerGame({
    id: "connect-four",
    name: "Connect Four",
    accent: ACCENT,
    icon: `<rect x="6" y="10" width="36" height="31" rx="3"/>
      <circle cx="14" cy="18" r="3.5"/><circle cx="24" cy="18" r="3.5"/><circle cx="34" cy="18" r="3.5"/>
      <circle class="acc" cx="14" cy="30" r="3.5"/><circle class="acc" cx="24" cy="30" r="3.5"/><circle cx="34" cy="30" r="3.5"/>
      <path d="M8 46 v-5 M40 46 v-5"/>`,
    open: showMenu,
    tileStat(playerId) {
      const s = stats[playerId];
      if (!s) return null;
      const wins = Object.values(s.vs || {}).reduce((n, r) => n + r.w, 0) + Object.values(s.pvp || {}).reduce((n, r) => n + r.w, 0);
      return wins ? `Wins: ${wins}` : null;
    },
    resetStats() { stats = {}; saveStats(); },
    forgetPlayer(id) {
      delete stats[id];
      for (const s of Object.values(stats)) if (s.pvp) delete s.pvp[id];
      saveStats();
      A.store.set("connect-four:lastSetup", A.store.get("connect-four:lastSetup", []).filter(e => e.id !== id));
    }
  });
})();

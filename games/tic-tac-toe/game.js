/* Tic-Tac-Toe: vs the computer (Easy, Medium, Hard, Impossible) or two players on one phone.
   You pick X or O for the first game; players swap letters every game, so X always starts and the
   starter alternates. Matches are one game, best of 3 or best of 5 (ending early once decided).
   Saved data: tic-tac-toe:stats {playerId: {vs: {level: {w, l, t}}, pvp: {otherId: {w, l, t}}}},
   tic-tac-toe:prefs {mark, length}, tic-tac-toe:lastSetup. Guests' games aren't recorded. */
(function () {
  const A = window.Arcade;
  const $ = id => document.getElementById(id);
  const esc = A.esc;
  const ACCENT = "#f5a142";
  const LEVELS = {
    easy: { name: "Easy", desc: "Random moves" },
    medium: { name: "Medium", desc: "Wins and blocks" },
    hard: { name: "Hard", desc: "Almost perfect" },
    impossible: { name: "Impossible", desc: "Never loses. Can you tie it?" }
  };
  const COMPUTER = { id: null, name: "Computer", avatar: "robot" };
  const CELL = 100; // board is 300 x 300, cells are 100 x 100

  /* ---------- Screens ---------- */
  const home = `<button class="icon-btn" data-home aria-label="Home"></button>`;
  const back = `<button class="back-link" data-ttt-back>‹ Tic-Tac-Toe</button>`;
  const choices = id => `
    <div class="choice-row"><span class="label" id="${id}-mark-label">You play</span>
      <div class="seg" role="radiogroup" aria-labelledby="${id}-mark-label" id="${id}-mark">
        <button type="button" data-mark="X">X</button><button type="button" data-mark="O">O</button></div></div>
    <div class="choice-row"><span class="label" id="${id}-len-label">Match</span>
      <div class="seg" role="radiogroup" aria-labelledby="${id}-len-label" id="${id}-len">
        <button type="button" data-len="1">1 game</button><button type="button" data-len="3">Best of 3</button><button type="button" data-len="5">Best of 5</button></div></div>`;
  $("game-root").insertAdjacentHTML("beforeend", `
  <section class="screen ttt menu" id="ttt-menu" hidden>
    <header class="topbar"><div class="tb-left">${home}</div><h2></h2><div class="tb-right"></div></header>
    <h1 class="title">Tic-Tac-<span>Toe</span></h1>
    <p class="tagline">Three in a row wins!</p>
    <div class="menu-buttons">
      <button class="btn big" id="ttt-btn-cpu">Vs computer</button>
      <button class="btn big" id="ttt-btn-two">Two players</button>
    </div>
  </section>

  <section class="screen ttt" id="ttt-levels" hidden>
    <header class="topbar"><div class="tb-left">${home}${back}</div><h2>Vs computer</h2><div class="tb-right"></div></header>
    <div class="playing-as" id="ttt-playing-as"></div>
    ${choices("ttt-cpu")}
    <p class="brag" id="ttt-brag"></p>
    <div class="levels" id="ttt-level-list"></div>
  </section>

  <section class="screen ttt" id="ttt-setup" hidden>
    <header class="topbar"><div class="tb-left">${home}${back}</div><h2>Two players</h2><div class="tb-right"></div></header>
    <h3 class="label">Pick two players</h3>
    <div id="ttt-picker"></div>
    ${choices("ttt-two")}
    <p class="note" id="ttt-pair-record"></p>
    <p class="err" id="ttt-setup-err" aria-live="polite"></p>
    <button class="btn big" id="ttt-start">Start</button>
  </section>

  <section class="screen ttt play" id="ttt-game" hidden>
    <header class="topbar"><div class="tb-left">${home}</div><h2 id="ttt-title"></h2><div class="tb-right"></div></header>
    <div class="scorebar" id="ttt-score"></div>
    <p class="turn" id="ttt-turn" aria-live="polite"></p>
    <div class="board-wrap"><svg class="tgrid" id="ttt-board" viewBox="-10 -10 320 320" aria-label="Tic-Tac-Toe board"></svg></div>
    <div class="result" id="ttt-result" hidden>
      <div class="result-art" id="ttt-art" aria-hidden="true"></div>
      <p class="banner" id="ttt-banner" aria-live="assertive"></p>
      <p class="note" id="ttt-match-note"></p>
      <div class="row" id="ttt-result-actions"></div>
    </div>
  </section>`);

  /* ---------- Preferences (X or O, match length) ---------- */
  const prefs = Object.assign({ mark: "X", length: 1 }, A.store.get("tic-tac-toe:prefs", {}));
  const savePrefs = () => A.store.set("tic-tac-toe:prefs", prefs);
  function bindChoices(id) {
    const markBox = $(`${id}-mark`), lenBox = $(`${id}-len`);
    const paint = () => {
      markBox.querySelectorAll("button").forEach(b => b.setAttribute("aria-checked", String(b.dataset.mark === prefs.mark)));
      lenBox.querySelectorAll("button").forEach(b => b.setAttribute("aria-checked", String(+b.dataset.len === prefs.length)));
    };
    markBox.querySelectorAll("button").forEach(b => { b.setAttribute("role", "radio"); b.addEventListener("click", () => { prefs.mark = b.dataset.mark; savePrefs(); paint(); }); });
    lenBox.querySelectorAll("button").forEach(b => { b.setAttribute("role", "radio"); b.addEventListener("click", () => { prefs.length = +b.dataset.len; savePrefs(); paint(); }); });
    return { paint, setLabel: text => { $(`${id}-mark-label`).textContent = text; } };
  }
  const cpuChoices = bindChoices("ttt-cpu");
  const twoChoices = bindChoices("ttt-two");

  /* ---------- Stats ---------- */
  let stats = A.store.get("tic-tac-toe:stats", {});
  const saveStats = () => A.store.set("tic-tac-toe:stats", stats);
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
    A.show("ttt-menu");
  }
  document.querySelectorAll("[data-ttt-back]").forEach(b => b.addEventListener("click", showMenu));
  $("ttt-btn-cpu").addEventListener("click", () =>
    A.whoIsPlaying({ onDone: showLevels, onBack: showMenu, backLabel: "Tic-Tac-Toe" }));
  $("ttt-btn-two").addEventListener("click", showSetup);

  function showLevels() {
    const p = A.session.player;
    $("ttt-playing-as").innerHTML = `${A.avatarSvg(p)}<span>Playing: <b>${esc(p.name)}</b></span>
      <button class="btn ghost" id="ttt-switch">Switch</button>`;
    $("ttt-switch").addEventListener("click", () =>
      A.whoIsPlaying({ force: true, onDone: showLevels, onBack: showLevels, backLabel: "Levels" }));
    cpuChoices.paint();
    const ties = levelRecord(p.id, "impossible").t;
    $("ttt-brag").innerHTML = p.id ? `Ties vs Impossible: <b>${ties}</b>` : "";
    const box = $("ttt-level-list");
    box.innerHTML = "";
    for (const [id, lv] of Object.entries(LEVELS)) {
      const r = levelRecord(p.id, id);
      const b = document.createElement("button");
      b.className = "level" + (id === "impossible" ? " impossible" : "");
      b.innerHTML = `<b>${lv.name}</b><small>${lv.desc}</small>
        <span class="stats" aria-hidden="true"><span>${r.w}</span><span>${r.l}</span><span>${r.t}</span><i>wins</i><i>losses</i><i>ties</i></span>`;
      b.setAttribute("aria-label", `${lv.name}: ${lv.desc}. Wins ${r.w}, losses ${r.l}, ties ${r.t}.`);
      b.addEventListener("click", () => startMatch({ mode: "cpu", level: id, players: [p, COMPUTER] }));
      box.appendChild(b);
    }
    A.setAccent(ACCENT);
    A.show("ttt-levels");
  }

  let picker = null;
  function showSetup() {
    A.setAccent(ACCENT);
    $("ttt-setup-err").textContent = "";
    twoChoices.paint();
    picker = A.playerPicker($("ttt-picker"), {
      min: 2, max: 2, initial: A.store.get("tic-tac-toe:lastSetup", []),
      onChange: () => { $("ttt-setup-err").textContent = ""; showSetupDetails(); }
    });
    showSetupDetails();
    A.show("ttt-setup");
  }
  function showSetupDetails() {
    const [a, b] = picker.get();
    twoChoices.setLabel(a ? `${a.name} plays` : "Player 1 plays");
    const r = a && b ? pairRecord(a.id, b.id) : null;
    $("ttt-pair-record").textContent = r && (r.w || r.l || r.t) ? `${a.name} vs ${b.name}: ${r.w} wins, ${r.l} losses, ${r.t} ties` : "";
  }
  $("ttt-start").addEventListener("click", () => {
    if (picker.count() < 2) { $("ttt-setup-err").textContent = "Pick two players."; return; }
    A.store.set("tic-tac-toe:lastSetup", picker.entries());
    startMatch({ mode: "two", players: picker.get() });
  });

  /* ---------- A match (one or more games) ---------- */
  // M: { mode, level, players: [p0, p1], length, wins: [0, 0], ties, played, firstMark (p0's letter in game 1) }
  // G: { cells, turn ("X"|"O"), marks: {X: playerIndex, O: playerIndex}, over, win, busy, themeId, fresh }
  let M = null, G = null;

  function startMatch({ mode, level, players }) {
    M = { mode, level, players, length: prefs.length, wins: [0, 0], ties: 0, played: 0, firstMark: prefs.mark };
    $("ttt-title").textContent = mode === "cpu" ? `Vs ${LEVELS[level].name}` : `${players[0].name} vs ${players[1].name}`;
    startGame();
  }

  function startGame() {
    // Players swap letters every game, so X (who always starts) alternates between them.
    const p0Mark = M.played % 2 === 0 ? M.firstMark : TTT.other(M.firstMark);
    G = {
      cells: TTT.newBoard(), turn: "X",
      marks: { [p0Mark]: 0, [TTT.other(p0Mark)]: 1 },
      over: false, win: null, busy: false, fresh: null,
      themeId: A.resolveTheme(A.settings.theme)
    };
    A.noteThemeUsed(G.themeId);
    A.setAccent(ACCENT);
    $("ttt-result").hidden = true;
    A.show("ttt-game");
    render(true);
    if (isComputerTurn()) computerMove();
  }

  const playerOf = mark => M.players[G.marks[mark]];
  const isComputerTurn = () => M.mode === "cpu" && G.marks[G.turn] === 1 && !G.over;
  const markSvg = (mark, cls) => mark === "X"
    ? `<svg class="mk x ${cls || ""}" viewBox="0 0 40 40" aria-hidden="true"><path d="M9 9 L31 31 M31 9 L9 31"/></svg>`
    : `<svg class="mk o ${cls || ""}" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="12"/></svg>`;

  function render(newGame) {
    let svg = `<path class="lines${newGame ? " draw" : ""}" pathLength="100" d="M100 6 V294 M200 6 V294 M6 100 H294 M6 200 H294"/>`;
    G.cells.forEach((v, i) => {
      const x = (i % 3) * CELL, y = Math.floor(i / 3) * CELL, cx = x + 50, cy = y + 50;
      const fresh = G.fresh === i ? " draw" : "";
      if (v === "X") svg += `<path class="mark x${fresh}" pathLength="100" d="M${cx - 26} ${cy - 26} L${cx + 26} ${cy + 26}"/>
        <path class="mark x second${fresh}" pathLength="100" d="M${cx + 26} ${cy - 26} L${cx - 26} ${cy + 26}"/>`;
      else if (v === "O") svg += `<circle class="mark o${fresh}" pathLength="100" cx="${cx}" cy="${cy}" r="29"/>`;
      svg += `<rect class="cell-hit${v ? " used" : ""}" data-cell="${i}" x="${x}" y="${y}" width="${CELL}" height="${CELL}"
        role="button" aria-label="Row ${Math.floor(i / 3) + 1}, column ${i % 3 + 1}${v ? ", " + v : ""}"/>`;
    });
    if (G.win) {
      const [a, , c] = G.win.line;
      const p = i => [(i % 3) * CELL + 50, Math.floor(i / 3) * CELL + 50];
      const [x1, y1] = p(a), [x2, y2] = p(c);
      const dx = Math.sign(x2 - x1) * 30, dy = Math.sign(y2 - y1) * 30;
      svg += `<path class="win-line draw" pathLength="100" d="M${x1 - dx} ${y1 - dy} L${x2 + dx} ${y2 + dy}"/>`;
    }
    $("ttt-board").innerHTML = svg;
    $("ttt-board").classList.toggle("locked", G.over || G.busy || isComputerTurn());
    renderScore();
    renderTurn();
  }

  function renderScore() {
    const [a, b] = M.players;
    const gameNo = Math.min(M.played + (G.over ? 0 : 1), M.length);
    $("ttt-score").innerHTML = `
      <span class="who">${A.avatarSvg(a)}<span>${esc(M.mode === "cpu" ? "You" : a.name)}</span></span>
      <span class="nums"><b>${M.wins[0]}</b>–<b>${M.wins[1]}</b></span>
      <span class="who right"><span>${esc(b.name)}</span>${A.avatarSvg(b)}</span>
      <span class="game-no">${M.length > 1 ? `Game ${Math.max(1, gameNo)} of ${M.length}` : "One game"}${M.ties ? ` · ${M.ties} tie${M.ties > 1 ? "s" : ""}` : ""}</span>`;
  }

  function renderTurn() {
    if (G.over) { $("ttt-turn").innerHTML = ""; return; }
    const p = playerOf(G.turn);
    const text = M.mode === "cpu" ? (G.marks[G.turn] === 0 ? "Your turn" : "Thinking…") : `${esc(p.name)}'s turn`;
    $("ttt-turn").innerHTML = `${A.avatarSvg(p)}<span>${text}</span>${markSvg(G.turn)}`;
    $("ttt-turn").classList.toggle("thinking", isComputerTurn());
  }

  $("ttt-board").addEventListener("click", e => {
    const hit = e.target.closest(".cell-hit");
    if (hit) humanMove(+hit.dataset.cell);
  });
  document.addEventListener("keydown", e => {
    if (A.currentScreen !== "ttt-game" || A.dialogOpen() || e.target.tagName === "INPUT") return;
    if (/^[1-9]$/.test(e.key)) humanMove(+e.key - 1);
  });

  function humanMove(i) {
    if (!G || G.over || G.busy || isComputerTurn() || G.cells[i]) return;
    place(i);
    if (!G.over && isComputerTurn()) computerMove();
  }

  function place(i) {
    G.cells[i] = G.turn;
    G.fresh = i;
    A.sfx.right();
    const w = TTT.winner(G.cells);
    if (w) { G.win = w; finishGame(G.marks[w.mark]); }
    else if (TTT.isFull(G.cells)) finishGame(-1);
    else G.turn = TTT.other(G.turn);
    render(false);
  }

  function computerMove() {
    G.busy = true;
    render(false);
    const game = G;
    setTimeout(() => {
      if (G !== game || G.over) return;
      const i = TTT.levels[M.level](G.cells, G.turn);
      G.busy = false;
      place(i);
    }, 450);
  }

  // winnerIndex: 0 or 1 (index into M.players), or -1 for a tie.
  function finishGame(winnerIndex) {
    G.over = true;
    G.busy = false;
    M.played++;
    if (winnerIndex >= 0) M.wins[winnerIndex]++; else M.ties++;
    record(winnerIndex);

    // The match is over after `length` games, or early once the leader can't be caught.
    const left = M.length - M.played;
    const matchOver = left <= 0 || Math.abs(M.wins[0] - M.wins[1]) > left;
    M.done = matchOver;

    let banner, outcome;
    if (winnerIndex < 0) { banner = "It's a tie!"; outcome = null; }
    else if (M.mode === "cpu") {
      outcome = winnerIndex === 0 ? "win" : "lose";
      banner = winnerIndex === 0 ? "You win!" : "The computer wins!";
    } else { outcome = "win"; banner = `${M.players[winnerIndex].name} wins!`; }
    if (winnerIndex < 0 && M.mode === "cpu" && M.level === "impossible") banner = "A tie with Impossible!";

    let matchNote = "";
    if (M.length > 1 && matchOver) {
      const [a, b] = M.wins;
      const name = i => (M.mode === "cpu" ? (i === 0 ? "You win" : "The computer wins") : `${M.players[i].name} wins`);
      matchNote = a === b ? `The match is a tie, ${a}–${b}.` : `${name(a > b ? 0 : 1)} the match ${Math.max(a, b)}–${Math.min(a, b)}!`;
    } else if (M.length > 1) {
      matchNote = `Game ${M.played} of ${M.length} done.`;
    }

    setTimeout(() => (outcome === "lose" ? A.sfx.lose() : outcome ? A.sfx.win() : A.sfx.lose()), 250);
    if (outcome === "lose") A.buzz();
    setTimeout(() => {
      if (!G.over) return;
      const theme = A.getTheme(G.themeId);
      $("ttt-art").innerHTML = outcome ? A.themeSvg(theme, A.themeView(theme, outcome === "lose" ? 8 : 0, 8), outcome) : "";
      $("ttt-art").hidden = !outcome;
      $("ttt-banner").textContent = banner;
      $("ttt-banner").className = "banner " + (outcome === "lose" ? "lose" : outcome ? "win" : "");
      $("ttt-match-note").textContent = matchNote;
      renderScore();
      const actions = $("ttt-result-actions");
      actions.innerHTML = "";
      const add = (label, cls, run) => {
        const b = document.createElement("button");
        b.className = "btn " + cls;
        b.textContent = label;
        b.addEventListener("click", run);
        actions.appendChild(b);
      };
      if (!matchOver) add("Next game", "", startGame);
      else add(M.length > 1 ? "New match" : "Play again", "", () => {
        // Start the next match with the other letter so the first move alternates between matches too.
        M = Object.assign({}, M, { wins: [0, 0], ties: 0, played: 0, done: false, firstMark: M.played % 2 ? TTT.other(M.firstMark) : M.firstMark });
        startGame();
      });
      add("Menu", "ghost", () => (M.mode === "cpu" ? showLevels() : showMenu()));
      $("ttt-result").hidden = false;
    }, 700);
  }

  function record(winnerIndex) {
    if (M.mode === "cpu") {
      const p = M.players[0];
      if (!p.id) return;
      const r = statsFor(p.id).vs[M.level] = statsFor(p.id).vs[M.level] || blank();
      if (winnerIndex === 0) r.w++; else if (winnerIndex === 1) r.l++; else r.t++;
    } else {
      const [a, b] = M.players;
      if (!a.id || !b.id) return;
      const ra = statsFor(a.id).pvp[b.id] = statsFor(a.id).pvp[b.id] || blank();
      const rb = statsFor(b.id).pvp[a.id] = statsFor(b.id).pvp[a.id] || blank();
      if (winnerIndex === 0) { ra.w++; rb.l++; } else if (winnerIndex === 1) { ra.l++; rb.w++; } else { ra.t++; rb.t++; }
    }
    saveStats();
  }

  // Ask before leaving a match that's under way (finished games are already recorded).
  A.homeGuards["ttt-game"] = () => (M && !M.done && (M.played > 0 || G.cells.some(Boolean))
    ? A.confirm("Leave this match? The unfinished game won't count.", "Leave") : Promise.resolve(true));

  /* ---------- Register with the arcade ---------- */
  A.registerGame({
    id: "tic-tac-toe",
    name: "Tic-Tac-Toe",
    accent: ACCENT,
    icon: `<path d="M18 6 V42 M30 6 V42 M6 18 H42 M6 30 H42"/>
      <path class="acc" d="M8 8 l7 7 M15 8 l-7 7 M33 33 l7 7 M40 33 l-7 7"/>
      <circle cx="24" cy="24" r="3.5"/>`,
    open: showMenu,
    tileStat(playerId) {
      const s = stats[playerId];
      if (!s) return null;
      const impTies = s.vs && s.vs.impossible ? s.vs.impossible.t : 0;
      if (impTies) return `Ties vs Impossible: ${impTies}`;
      const wins = Object.values(s.vs || {}).reduce((n, r) => n + r.w, 0) + Object.values(s.pvp || {}).reduce((n, r) => n + r.w, 0);
      return wins ? `Wins: ${wins}` : null;
    },
    resetStats() { stats = {}; saveStats(); },
    forgetPlayer(id) {
      delete stats[id];
      for (const s of Object.values(stats)) if (s.pvp) delete s.pvp[id];
      saveStats();
      A.store.set("tic-tac-toe:lastSetup", A.store.get("tic-tac-toe:lastSetup", []).filter(e => e.id !== id));
    }
  });
})();

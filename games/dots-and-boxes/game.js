/* Dots and Boxes: vs the computer (Easy, Medium, Hard, Impossible) or pass-and-play for 2–4 players,
   on four board sizes. The game in progress is saved after every line and resumed when the app reopens.
   Saved data: dots-and-boxes:game (in progress), dots-and-boxes:stats
   {playerId: {vs: {"level|size": {w, l, t}}, pvpWins, most: {size: boxes}}}, dots-and-boxes:prefs
   {size, hint}, dots-and-boxes:rotation {cpu, pass}, dots-and-boxes:lastSetup. Guests aren't recorded. */
(function () {
  const A = window.Arcade;
  const $ = id => document.getElementById(id);
  const esc = A.esc;
  const ACCENT = "#c9b6f2";
  const COLORS = ["#f3d36b", "#9fd3e8", "#f29a9a", "#b8e986"];
  const SIZES = { 3: "Small", 4: "Medium", 5: "Large", 6: "Huge" };
  const LEVELS = {
    easy: { name: "Easy", desc: "Learning the ropes", undos: -1 },
    medium: { name: "Medium", desc: "Grabs every free box", undos: 3 },
    hard: { name: "Hard", desc: "Gives away as little as it can", undos: 0 },
    impossible: { name: "Impossible", desc: "Plays the long game", undos: 0 }
  };
  const COMPUTER = { id: null, name: "Computer", avatar: "robot" };
  const STEP = 100;          // board units between dots
  const COMPUTER_DELAY = 400; // ms per computer line

  /* ---------- Screens ---------- */
  const home = `<button class="icon-btn" data-home aria-label="Home"></button>`;
  const back = `<button class="back-link" data-db-back>‹ Dots and Boxes</button>`;
  const sizePicker = id => `
    <div class="choice-row"><span class="label" id="${id}-label">Board</span>
      <div class="seg" role="radiogroup" aria-labelledby="${id}-label" id="${id}">
        ${Object.entries(SIZES).map(([n, name]) => `<button type="button" data-size="${n}">${name}<small>${n}×${n}</small></button>`).join("")}
      </div></div>`;
  $("game-root").insertAdjacentHTML("beforeend", `
  <section class="screen db menu" id="db-menu" hidden>
    <header class="topbar"><div class="tb-left">${home}</div><h2></h2><div class="tb-right"></div></header>
    <h1 class="title">Dots <span>&amp;</span> Boxes</h1>
    <p class="tagline">Draw lines, close boxes, and take another turn!</p>
    <div class="resume" id="db-resume" hidden>
      <p id="db-resume-text"></p>
      <div class="row">
        <button class="btn" id="db-btn-resume">Resume game</button>
        <button class="btn ghost" id="db-btn-discard">Quit it</button>
      </div>
    </div>
    <div class="menu-buttons">
      <button class="btn big" id="db-btn-cpu">Vs computer</button>
      <button class="btn big" id="db-btn-pass">Pass-and-play</button>
    </div>
  </section>

  <section class="screen db" id="db-levels" hidden>
    <header class="topbar"><div class="tb-left">${home}${back}</div><h2>Vs computer</h2><div class="tb-right"></div></header>
    <div class="playing-as" id="db-playing-as"></div>
    ${sizePicker("db-cpu-size")}
    <div class="levels" id="db-level-list"></div>
  </section>

  <section class="screen db" id="db-setup" hidden>
    <header class="topbar"><div class="tb-left">${home}${back}</div><h2>Pass-and-play</h2><div class="tb-right"></div></header>
    <h3 class="label">Players (2–4, in turn order)</h3>
    <div id="db-picker"></div>
    ${sizePicker("db-pass-size")}
    <p class="err" id="db-setup-err" aria-live="polite"></p>
    <button class="btn big" id="db-start">Start game</button>
  </section>

  <section class="screen db play" id="db-game" hidden>
    <header class="topbar">
      <div class="tb-left">${home}</div>
      <h2 id="db-title"></h2>
      <div class="tb-right"><button class="btn ghost small" id="db-undo">Undo</button></div>
    </header>
    <div class="scores" id="db-scores"></div>
    <label class="toggle hint-toggle" id="db-hint-row" hidden><span>Show safe moves</span><input type="checkbox" id="db-hint"><i></i></label>
    <div class="board-wrap" id="db-wrap">
      <svg class="dgrid" id="db-board" aria-label="Dots and Boxes board"></svg>
      <p class="go-again" id="db-go-again" aria-live="polite" hidden>Go again!</p>
    </div>
    <div class="result" id="db-result" hidden>
      <div class="result-art" id="db-art" aria-hidden="true"></div>
      <table class="scoreboard" id="db-final" hidden><tbody></tbody></table>
      <p class="banner" id="db-banner" aria-live="assertive"></p>
      <div class="row" id="db-result-actions"></div>
    </div>
  </section>`);

  /* ---------- Preferences ---------- */
  const prefs = Object.assign({ size: 4, hint: false }, A.store.get("dots-and-boxes:prefs", {}));
  const savePrefs = () => A.store.set("dots-and-boxes:prefs", prefs);
  function bindSize(id, onChange) {
    const box = $(id);
    const paint = () => box.querySelectorAll("button").forEach(b => b.setAttribute("aria-checked", String(+b.dataset.size === prefs.size)));
    box.querySelectorAll("button").forEach(b => {
      b.setAttribute("role", "radio");
      b.addEventListener("click", () => { prefs.size = +b.dataset.size; savePrefs(); paint(); if (onChange) onChange(); });
    });
    return paint;
  }
  const paintCpuSize = bindSize("db-cpu-size", () => showLevels());
  const paintPassSize = bindSize("db-pass-size");

  /* ---------- Stats ---------- */
  let stats = A.store.get("dots-and-boxes:stats", {});
  const saveStats = () => A.store.set("dots-and-boxes:stats", stats);
  const blank = () => ({ w: 0, l: 0, t: 0 });
  function statsFor(id) {
    const s = stats[id] = stats[id] || {};
    s.vs = s.vs || {}; s.most = s.most || {}; s.pvpWins = s.pvpWins || 0;
    return s;
  }
  const record = (id, level, n) => (id && stats[id] && stats[id].vs && stats[id].vs[`${level}|${n}`]) || blank();

  /* ---------- Menu & setup ---------- */
  let G = null;      // the game in play (see newGame)
  let S = null;      // engine state for G, rebuilt from G.history
  let saved = A.store.get("dots-and-boxes:game", null);

  function showMenu() {
    A.setAccent(ACCENT);
    saved = A.store.get("dots-and-boxes:game", null);
    $("db-resume").hidden = !saved;
    if (saved) {
      $("db-resume-text").textContent = `You have a ${SIZES[saved.n]} game in progress (${saved.mode === "cpu"
        ? "vs " + LEVELS[saved.level].name : saved.players.map(p => p.name).join(", ")}).`;
    }
    A.show("db-menu");
  }
  document.querySelectorAll("[data-db-back]").forEach(b => b.addEventListener("click", showMenu));
  $("db-btn-cpu").addEventListener("click", () =>
    A.whoIsPlaying({ onDone: showLevels, onBack: showMenu, backLabel: "Dots and Boxes" }));
  $("db-btn-pass").addEventListener("click", showSetup);
  $("db-btn-resume").addEventListener("click", () => { if (saved) openGame(saved); });
  $("db-btn-discard").addEventListener("click", async () => {
    if (!(await A.confirm("Quit the game in progress?", "Quit game"))) return;
    A.store.remove("dots-and-boxes:game");
    showMenu();
  });

  function showLevels() {
    const p = A.session.player;
    $("db-playing-as").innerHTML = `${A.avatarSvg(p)}<span>Playing: <b>${esc(p.name)}</b></span>
      <button class="btn ghost" id="db-switch">Switch</button>`;
    $("db-switch").addEventListener("click", () =>
      A.whoIsPlaying({ force: true, onDone: showLevels, onBack: showLevels, backLabel: "Levels" }));
    paintCpuSize();
    const box = $("db-level-list");
    box.innerHTML = "";
    for (const [id, lv] of Object.entries(LEVELS)) {
      const r = record(p.id, id, prefs.size);
      const undo = lv.undos < 0 ? "Undo any time" : lv.undos ? `${lv.undos} undos` : "No undo";
      const b = document.createElement("button");
      b.className = "level" + (id === "impossible" ? " impossible" : "");
      b.innerHTML = `<b>${lv.name}</b><small>${lv.desc} · ${undo}</small>
        <span class="stats" aria-hidden="true"><span>${r.w}</span><span>${r.l}</span><span>${r.t}</span><i>wins</i><i>losses</i><i>ties</i></span>`;
      b.setAttribute("aria-label", `${lv.name} on ${SIZES[prefs.size]}: ${lv.desc}, ${undo}. Wins ${r.w}, losses ${r.l}, ties ${r.t}.`);
      b.addEventListener("click", () => startNew({ mode: "cpu", level: id, players: [p, COMPUTER], n: prefs.size }));
      box.appendChild(b);
    }
    A.setAccent(ACCENT);
    A.show("db-levels");
  }

  let picker = null;
  function showSetup() {
    A.setAccent(ACCENT);
    $("db-setup-err").textContent = "";
    paintPassSize();
    picker = A.playerPicker($("db-picker"), {
      min: 2, max: 4, initial: A.store.get("dots-and-boxes:lastSetup", []),
      onChange: () => { $("db-setup-err").textContent = ""; }
    });
    A.show("db-setup");
  }
  $("db-start").addEventListener("click", () => {
    if (picker.count() < 2) { $("db-setup-err").textContent = "Pick at least 2 players."; return; }
    A.store.set("dots-and-boxes:lastSetup", picker.entries());
    startNew({ mode: "pass", players: picker.get(), n: prefs.size });
  });

  async function startNew(opts) {
    if (A.store.get("dots-and-boxes:game", null) && !(await A.confirm("Start a new game? The game in progress will be lost.", "Start new"))) return;
    newGame(opts);
  }

  /* ---------- Game state ---------- */
  // G: { mode, level, n, players [{id, name, avatar}], first, turn, history [{l, p}], undosLeft (-1 = any), themeId }
  function newGame({ mode, level, players, n }) {
    const rot = A.store.get("dots-and-boxes:rotation", {});
    const first = (rot[mode] || 0) % players.length; // who goes first rotates each new game
    rot[mode] = (rot[mode] || 0) + 1;
    A.store.set("dots-and-boxes:rotation", rot);
    const themeId = A.resolveTheme(A.settings.theme);
    A.noteThemeUsed(themeId);
    openGame({
      mode, level: level || null, n, first, turn: first, history: [],
      players: players.map(p => ({ id: p.id || null, name: p.name, avatar: p.avatar || null })),
      undosLeft: mode === "cpu" ? LEVELS[level].undos : 0, themeId
    });
  }

  function rebuild() {
    S = DB.create(G.n);
    for (const h of G.history) DB.draw(S, h.l, h.p);
  }
  const scores = () => G.players.map((_, i) => S.owner.filter(o => o === i).length);
  const save = () => { if (DB.isOver(S)) A.store.remove("dots-and-boxes:game"); else A.store.set("dots-and-boxes:game", G); };
  const isComputerTurn = () => G.mode === "cpu" && G.turn === 1 && !DB.isOver(S);

  let busy = false, fresh = null, sparkles = [], timer = 0;
  function openGame(game) {
    G = game;
    rebuild();
    busy = false; fresh = null; sparkles = [];
    clearTimeout(timer);
    A.setAccent(ACCENT);
    $("db-title").textContent = G.mode === "cpu" ? `${LEVELS[G.level].name} · ${SIZES[G.n]}` : `${SIZES[G.n]} board`;
    $("db-result").hidden = true;
    $("db-go-again").hidden = true;
    $("db-hint-row").hidden = !(G.mode === "cpu" && G.level === "easy");
    $("db-hint").checked = prefs.hint;
    A.show("db-game");
    render();
    if (DB.isOver(S)) finish();
    else if (isComputerTurn()) computerStep();
  }

  /* ---------- Drawing the board ---------- */
  const lineEnds = l => {
    const { n, H } = DB.geometry(G.n);
    if (l < H) { const r = Math.floor(l / n), c = l % n; return [c * STEP, r * STEP, (c + 1) * STEP, r * STEP]; }
    const k = l - H, r = Math.floor(k / (n + 1)), c = k % (n + 1);
    return [c * STEP, r * STEP, c * STEP, (r + 1) * STEP];
  };
  // The tap area for a line: the diamond between its two dots and the centers of the boxes on either side.
  function hitPoints(l) {
    const [x1, y1, x2, y2] = lineEnds(l), h = STEP / 2;
    return y1 === y2
      ? `${x1},${y1} ${x1 + h},${y1 - h} ${x2},${y2} ${x1 + h},${y1 + h}`
      : `${x1},${y1} ${x1 + h},${y1 + h} ${x2},${y2} ${x1 - h},${y1 + h}`;
  }
  const pathFor = l => { const [x1, y1, x2, y2] = lineEnds(l); return `M${x1} ${y1} L${x2} ${y2}`; };

  function nestedAvatar(p, x, y, size) {
    // Inline size beats the shared .avatar size, so the avatar fills the box.
    return A.avatarSvg(p).replace("<svg ", `<svg x="${x}" y="${y}" width="${size}" height="${size}" style="width:${size}px;height:${size}px" `)
      .replace(/style="--av:([^"]+)"/, 'style="--av:$1;width:' + size + "px;height:" + size + 'px"');
  }

  function render() {
    const { n, L, B } = DB.geometry(G.n);
    const owners = lineOwners();
    const pad = STEP / 2;
    const board = $("db-board");
    board.setAttribute("viewBox", `${-pad} ${-pad} ${n * STEP + 2 * pad} ${n * STEP + 2 * pad}`);
    board.classList.toggle("big", n >= 5);
    let svg = "";
    // Claimed boxes: a light wash of the owner's color plus their avatar (or initial on big boards).
    for (let b = 0; b < B; b++) {
      const o = S.owner[b];
      if (o < 0) continue;
      const r = Math.floor(b / n), c = b % n, x = c * STEP, y = r * STEP;
      svg += `<g class="box${fresh && fresh.boxes.includes(b) ? " claimed" : ""}">
        <rect x="${x + 7}" y="${y + 7}" width="${STEP - 14}" height="${STEP - 14}" rx="10" fill="${COLORS[o]}" fill-opacity=".22"/>
        ${n <= 4 ? nestedAvatar(G.players[o], x + 22, y + 22, STEP - 44)
                 : `<text class="initial" x="${x + 50}" y="${y + 66}" fill="${COLORS[o]}">${esc((G.players[o].name || "?").charAt(0).toUpperCase())}</text>`}
      </g>`;
    }
    // Faint marks for safe lines (Easy hint).
    if (hintOn()) for (const l of DB.safeLines(S)) svg += `<path class="hint-line" d="${pathFor(l)}"/>`;
    // Drawn lines in their player's color.
    for (let l = 0; l < L; l++) {
      if (owners[l] < 0) continue;
      const isNew = fresh && fresh.line === l;
      svg += `<path class="ln${isNew ? " draw" : ""}" pathLength="100" stroke="${COLORS[owners[l]]}" d="${pathFor(l)}"/>`;
    }
    svg += `<path class="preview" id="db-preview" d="M0 0"/>`;
    // Dots on top.
    for (let r = 0; r <= n; r++) for (let c = 0; c <= n; c++) svg += `<circle class="dot" cx="${c * STEP}" cy="${r * STEP}" r="7"/>`;
    // Sparkles on boxes just completed.
    for (const b of sparkles) {
      const cx = (b % n) * STEP + 50, cy = Math.floor(b / n) * STEP + 50;
      svg += `<g class="sparkle" style="transform-origin:${cx}px ${cy}px"><path d="M${cx} ${cy - 40} v14 M${cx} ${cy + 40} v-14 M${cx - 40} ${cy} h14 M${cx + 40} ${cy} h-14 M${cx - 28} ${cy - 28} l9 9 M${cx + 28} ${cy + 28} l-9 -9 M${cx + 28} ${cy - 28} l-9 9 M${cx - 28} ${cy + 28} l9 -9"/></g>`;
    }
    // Tap areas last, so they're on top.
    for (let l = 0; l < L; l++) if (!S.drawn[l]) svg += `<polygon class="hit" data-line="${l}" points="${hitPoints(l)}"/>`;
    board.innerHTML = svg;
    board.classList.toggle("locked", busy || isComputerTurn() || DB.isOver(S));
    renderScores();
    renderUndo();
  }

  function lineOwners() {
    const owners = new Array(DB.geometry(G.n).L).fill(-1);
    for (const h of G.history) owners[h.l] = h.p;
    return owners;
  }

  function renderScores() {
    const sc = scores(), over = DB.isOver(S);
    $("db-scores").innerHTML = G.players.map((p, i) => `
      <div class="chip${!over && i === G.turn ? " now" : ""}" style="--pc:${COLORS[i]}">
        ${A.avatarSvg(p)}<span class="name">${esc(G.mode === "cpu" && i === 0 ? "You" : p.name)}</span><b>${sc[i]}</b>
      </div>`).join("");
    $("db-scores").classList.toggle("many", G.players.length > 2);
  }

  const hintOn = () => G.mode === "cpu" && G.level === "easy" && prefs.hint && !isComputerTurn() && !DB.isOver(S);
  $("db-hint").addEventListener("change", e => { prefs.hint = e.target.checked; savePrefs(); render(); });

  function renderUndo() {
    const btn = $("db-undo");
    btn.hidden = !(G.mode === "cpu" && LEVELS[G.level].undos !== 0); // Easy and Medium only
    if (btn.hidden) return;
    const humanMoved = G.history.some(h => h.p === 0);
    btn.disabled = busy || isComputerTurn() || DB.isOver(S) || !humanMoved || G.undosLeft === 0;
    btn.textContent = G.undosLeft < 0 ? "Undo" : `Undo (${G.undosLeft})`;
  }

  /* ---------- Touch: highlight on press, draw on release, slide off to cancel ---------- */
  let pressed = null;
  const lineUnder = e => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    return el && el.classList && el.classList.contains("hit") ? +el.dataset.line : null;
  };
  const canPlay = () => G && !busy && !isComputerTurn() && !DB.isOver(S) && A.currentScreen === "db-game" && !A.dialogOpen();
  function preview(l) {
    const p = $("db-preview");
    if (!p) return;
    if (l == null) { p.setAttribute("d", "M0 0"); p.classList.remove("on"); return; }
    p.setAttribute("d", pathFor(l));
    p.setAttribute("stroke", COLORS[G.turn]);
    p.classList.add("on");
  }
  $("db-board").addEventListener("pointerdown", e => {
    if (!canPlay()) return;
    const l = lineUnder(e);
    if (l == null) return;
    pressed = l;
    preview(l);
    try { $("db-board").setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    e.preventDefault();
  });
  $("db-board").addEventListener("pointermove", e => {
    if (pressed == null) return;
    preview(lineUnder(e) === pressed ? pressed : null);
  });
  $("db-board").addEventListener("pointerup", e => {
    if (pressed == null) return;
    const l = pressed;
    pressed = null;
    preview(null);
    if (lineUnder(e) === l && canPlay()) humanMove(l);
  });
  $("db-board").addEventListener("pointercancel", () => { pressed = null; preview(null); });

  /* ---------- Moves ---------- */
  function play(l) {
    const p = G.turn;
    const done = DB.draw(S, l, p);
    G.history.push({ l, p });
    fresh = { line: l, boxes: done };
    sparkles = done.slice();
    if (done.length) {
      A.sfx.right();
      if (!DB.isOver(S)) goAgain();
    } else {
      G.turn = (G.turn + 1) % G.players.length; // no box: next player
    }
    save();
    render();
    if (DB.isOver(S)) finish();
  }

  let goTimer = 0;
  function goAgain() {
    const el = $("db-go-again");
    el.textContent = G.mode === "cpu" && G.turn === 1 ? "Computer goes again!" : "Go again!";
    el.style.setProperty("--pc", COLORS[G.turn]);
    el.hidden = false;
    el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
    clearTimeout(goTimer);
    goTimer = setTimeout(() => { el.hidden = true; }, 900);
  }

  function humanMove(l) {
    if (S.drawn[l]) return;
    play(l);
    if (isComputerTurn()) computerStep();
  }

  // The computer draws one line every COMPUTER_DELAY ms until its turn ends.
  function computerStep() {
    busy = true;
    render();
    const game = G;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (G !== game || A.currentScreen !== "db-game") { busy = false; return; }
      const l = G.level === "impossible" ? DB.levels.impossible(S, 1, 350) : DB.levels[G.level](S, 1);
      busy = false;
      play(l);
      if (isComputerTurn()) computerStep();
      else render();
    }, COMPUTER_DELAY);
  }

  // Undo back to before the player's last line, including any computer lines after it.
  $("db-undo").addEventListener("click", () => {
    if (!G || G.mode !== "cpu" || busy || isComputerTurn() || DB.isOver(S) || G.undosLeft === 0) return;
    const i = G.history.map(h => h.p).lastIndexOf(0);
    if (i < 0) return;
    G.history.length = i;
    G.turn = 0;
    if (G.undosLeft > 0) G.undosLeft--;
    rebuild();
    fresh = null; sparkles = [];
    save();
    render();
  });

  /* ---------- End of the game ---------- */
  function finish() {
    clearTimeout(timer);
    busy = false;
    const sc = scores();
    const top = Math.max(...sc);
    const winners = sc.map((s, i) => (s === top ? i : -1)).filter(i => i >= 0);
    const tie = winners.length > 1;
    if (!G.recorded) { recordStats(sc, winners); G.recorded = true; }
    A.store.remove("dots-and-boxes:game");

    let banner, outcome = null;
    if (G.mode === "cpu") {
      if (tie) banner = `It's a tie, ${sc[0]}–${sc[1]}!`;
      else if (winners[0] === 0) { banner = `You win ${sc[0]}–${sc[1]}!`; outcome = "win"; }
      else { banner = `The computer wins ${sc[1]}–${sc[0]}!`; outcome = "lose"; }
    } else {
      banner = tie ? `It's a tie: ${winners.map(i => G.players[i].name).join(" & ")}!` : `${G.players[winners[0]].name} wins!`;
    }
    setTimeout(() => (outcome === "lose" ? A.sfx.lose() : A.sfx.win()), 300);
    if (outcome === "lose") A.buzz();

    setTimeout(() => {
      if (!G || A.currentScreen !== "db-game") return;
      const theme = A.getTheme(G.themeId);
      $("db-art").hidden = G.mode !== "cpu" || !outcome;
      $("db-art").innerHTML = G.mode === "cpu" && outcome ? A.themeSvg(theme, A.themeView(theme, outcome === "lose" ? 8 : 0, 8), outcome) : "";
      // Pass-and-play: the final scoreboard with the winner highlighted.
      const table = $("db-final");
      table.hidden = G.mode === "cpu";
      if (G.mode !== "cpu") {
        const rows = G.players.map((p, i) => ({ p, i, s: sc[i] })).sort((a, b) => b.s - a.s);
        table.querySelector("tbody").innerHTML = rows.map(({ p, i, s }) => `
          <tr class="${s === top ? "top" : ""}"><td><span class="who">${A.avatarSvg(p)}<span>${esc(p.name)}</span></span></td><td>${s}</td></tr>`).join("");
      }
      $("db-banner").textContent = banner;
      $("db-banner").className = "banner " + (outcome === "lose" ? "lose" : "win");
      const actions = $("db-result-actions");
      actions.innerHTML = "";
      const add = (label, cls, run) => {
        const b = document.createElement("button");
        b.className = "btn " + cls;
        b.textContent = label;
        b.addEventListener("click", run);
        actions.appendChild(b);
      };
      add("Play again", "", () => newGame({ mode: G.mode, level: G.level, players: G.players, n: G.n }));
      add("Menu", "ghost", () => (G.mode === "cpu" ? showLevels() : showMenu()));
      $("db-result").hidden = false;
    }, 800);
  }

  function recordStats(sc, winners) {
    const tie = winners.length > 1;
    G.players.forEach((p, i) => {
      if (!p.id) return;
      const s = statsFor(p.id);
      s.most[G.n] = Math.max(s.most[G.n] || 0, sc[i]);
      if (G.mode === "cpu") {
        const key = `${G.level}|${G.n}`;
        const r = s.vs[key] = s.vs[key] || blank();
        if (tie) r.t++; else if (winners[0] === i) r.w++; else r.l++;
      } else if (!tie && winners[0] === i) {
        s.pvpWins++;
      }
    });
    saveStats();
  }

  /* ---------- Register with the arcade ---------- */
  A.registerGame({
    id: "dots-and-boxes",
    name: "Dots and Boxes",
    accent: ACCENT,
    icon: `<circle class="accf" cx="10" cy="10" r="2.6"/><circle class="accf" cx="24" cy="10" r="2.6"/><circle class="accf" cx="38" cy="10" r="2.6"/>
      <circle class="accf" cx="10" cy="24" r="2.6"/><circle class="accf" cx="24" cy="24" r="2.6"/><circle class="accf" cx="38" cy="24" r="2.6"/>
      <circle class="accf" cx="10" cy="38" r="2.6"/><circle class="accf" cx="24" cy="38" r="2.6"/><circle class="accf" cx="38" cy="38" r="2.6"/>
      <path d="M10 10 H24 V24 H10 Z M24 24 H38 M38 24 V38"/>
      <path class="acc" d="M14 14 l6 6 M20 14 l-6 6"/>`,
    open: showMenu,
    tileStat(playerId) {
      const s = stats[playerId];
      if (!s) return null;
      const wins = Object.values(s.vs || {}).reduce((n, r) => n + r.w, 0) + (s.pvpWins || 0);
      return wins ? `Wins: ${wins}` : null;
    },
    resetStats() { stats = {}; saveStats(); },
    forgetPlayer(id) {
      delete stats[id];
      saveStats();
      A.store.set("dots-and-boxes:lastSetup", A.store.get("dots-and-boxes:lastSetup", []).filter(e => e.id !== id));
    },
    autoResume() {
      const g = A.store.get("dots-and-boxes:game", null);
      if (!g || !g.history) return false;
      openGame(g);
      A.toast("Game resumed");
      return true;
    }
  });
})();

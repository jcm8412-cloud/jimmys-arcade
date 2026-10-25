/* Brick Bash: Breakout with a 30-level campaign (every 5th level a boss), power-up bricks, and a level
   editor whose levels are shared by the household under "Our levels". Built on the shared action kit.
   High score: points in one campaign run (from any starting level until the balls run out, the player
   stops, or level 30 is beaten), per player and level of difficulty.
   Saved data: brick-bash:progress {playerId: furthest level unlocked (1–30)}, brick-bash:prefs
   {playerId: difficulty}, brick-bash:levels [{id, name, maker {id, name, avatar}, rows, best, made}]
   (up to 50; best = {score, id, name, avatar} or null). Guests aren't recorded. */
(function () {
  const A = window.Arcade, Act = A.Action, BB = window.BB;
  const $ = id => document.getElementById(id);
  const esc = A.esc;
  const ID = "brick-bash";
  const ACCENT = "#ff8f7a";
  const COLS = BB.COLS;          // bricks across
  const GRID_ROWS = 12;          // rows of brick space at the top of the field
  const EDIT_ROWS = 10;          // rows in the level editor
  const BOSS_ROW = 1;            // grid row where a boss's top sits
  const MAX_CUSTOM = 50;
  const MAX_LIVES = 9;
  const MAX_BALLS = 6;
  const MAX_ANGLE = 1.05;        // bounce angle (radians from straight up) at the very end of the paddle
  const TWISTS = ["The ball grows with every hit", "Every brick explodes", "Upside down"];
  const COLORS = { w: "#f2f0e6", y: "#f3d36b", p: "#f29a9a", b: "#9fd3e8", g: "#b8e986", o: "#f5a142", v: "#d7b4f3" };
  const SCORE = { n: 10, 2: 20, 3: 30, X: 20, "?": 20, crack: 5, armor: 5, weak: 100, boss: 500, clear: 100 };

  // Power-ups caught with the paddle. w: how often each one drops.
  const POWERS = {
    multi: { name: "Multi-ball!", w: 3, color: "#f3d36b" },
    wide: { name: "Wide paddle!", w: 3, color: "#b8e986", time: 15 },
    laser: { name: "Lasers! Tap to shoot", w: 2, color: "#ff8a65", time: 8 },
    sticky: { name: "Sticky paddle!", w: 2, color: "#d7b4f3", time: 15 },
    slow: { name: "Slow ball!", w: 3, color: "#9fd3e8", time: 10 },
    life: { name: "Extra life!", w: 1, color: "#f29a9a" }
  };

  // ball: speed as a share of the screen height per second. paddle: share of the field's width.
  // forgive: extra reach at each end of the paddle, in brick widths. Bosses: drop = seconds between
  // projectiles, fall = their speed (share of the height per second), daze = a hit stuns the paddle
  // instead of costing a life.
  const LEVELS = {
    easy: { name: "Easy", desc: "Slow ball, big paddle, 5 lives", ball: 0.48, paddle: 0.3, lives: 5, forgive: 0.4, drop: 4, fall: 0.17, daze: true },
    medium: { name: "Medium", desc: "Normal speed, 3 lives", ball: 0.64, paddle: 0.23, lives: 3, forgive: 0.15, drop: 3, fall: 0.22, daze: true },
    hard: { name: "Hard", desc: "Fast ball, small paddle, 3 lives", ball: 0.8, paddle: 0.19, lives: 3, forgive: 0, drop: 2, fall: 0.27, daze: false },
    impossible: { name: "Impossible", desc: "Very fast, tiny paddle, 2 lives", ball: 0.95, paddle: 0.155, lives: 2, forgive: 0, drop: 1.6, fall: 0.32, daze: false }
  };

  let progress = A.store.get("brick-bash:progress", {});
  let prefs = A.store.get("brick-bash:prefs", {});
  let custom = A.store.get("brick-bash:levels", []);
  const saveProgress = () => A.store.set("brick-bash:progress", progress);
  const savePrefs = () => A.store.set("brick-bash:prefs", prefs);
  const saveCustom = () => A.store.set("brick-bash:levels", custom);
  let guestFurthest = 1, guestDiff = "easy";
  const furthest = p => (p && p.id ? progress[p.id] || 1 : guestFurthest);
  const diffOf = p => (p && p.id ? prefs[p.id] || "easy" : guestDiff);
  function setDiff(p, d) { if (p && p.id) { prefs[p.id] = d; savePrefs(); } else guestDiff = d; }

  /* ---------- Menu screens ---------- */
  const home = `<button class="icon-btn" data-home aria-label="Home"></button>`;
  const back = `<button class="back-link" data-bb-back>‹ Brick Bash</button>`;
  const seg = (id, items) => `<div class="seg" role="radiogroup" id="${id}">${items.map(([v, label]) => `<button type="button" role="radio" data-v="${v}">${label}</button>`).join("")}</div>`;
  const diffItems = Object.entries(LEVELS).map(([k, l]) => [k, l.name]);
  const TOOLS = [["w", "Chalk"], ["y", "Yellow"], ["p", "Pink"], ["b", "Blue"], ["g", "Green"], ["o", "Orange"], ["v", "Violet"],
    ["2", "Tough"], ["3", "Extra tough"], ["X", "Boom"], ["#", "Steel"], ["?", "Power-up"], [".", "Eraser"]];
  $("game-root").insertAdjacentHTML("beforeend", `
  <section class="screen bb menu" id="bb-menu" hidden>
    <header class="topbar"><div class="tb-left">${home}</div><h2></h2><div class="tb-right"></div></header>
    <h1 class="title">Brick <span>Bash</span></h1>
    <p class="tagline">Smash the chalk bricks. Beat the bosses!</p>
    <div class="menu-buttons">
      <button class="btn big" id="bb-btn-play">Play</button>
      <button class="btn big daily" id="bb-btn-daily" hidden></button>
      <button class="btn big" id="bb-btn-ours">Our levels</button>
      <button class="btn" id="bb-btn-make">Make a level</button>
      <button class="btn ghost" id="bb-btn-top">Top scores</button>
    </div>
  </section>

  <section class="screen bb" id="bb-levels" hidden>
    <header class="topbar"><div class="tb-left">${home}${back}</div><h2>Pick a level</h2><div class="tb-right"></div></header>
    <div class="playing-as" id="bb-playing-as"></div>
    ${seg("bb-diff", diffItems)}
    <p class="note center-text" id="bb-diff-note"></p>
    <div class="bb-map" id="bb-map"></div>
  </section>

  <section class="screen bb" id="bb-ours" hidden>
    <header class="topbar"><div class="tb-left">${home}${back}</div><h2>Our levels</h2><div class="tb-right"></div></header>
    ${seg("bb-ours-diff", diffItems)}
    <div class="bb-list" id="bb-ours-list"></div>
    <p class="note center-text" id="bb-ours-note"></p>
    <button class="btn big" id="bb-ours-make">Make a level</button>
  </section>

  <section class="screen bb" id="bb-editor" hidden>
    <header class="topbar"><div class="tb-left">${home}<button class="back-link" id="bb-ed-back">‹ Our levels</button></div><h2>Make a level</h2><div class="tb-right"></div></header>
    <label class="field"><span>Level name</span><input type="text" id="bb-ed-name" maxlength="24" autocomplete="off" placeholder="My super level"></label>
    <div class="bb-tools" role="radiogroup" aria-label="Brick" id="bb-tools">
      ${TOOLS.map(([t, label]) => `<button type="button" role="radio" data-t="${t}"><i class="bk" data-t="${t}"></i><span>${label}</span></button>`).join("")}
    </div>
    <div class="bb-grid" id="bb-ed-grid" aria-label="Level grid"></div>
    <p class="note">Tap or drag to place bricks. Tap a brick with the same kind again to remove it.</p>
    <p class="err" id="bb-ed-err" aria-live="polite"></p>
    <div class="bb-ed-buttons">
      <button class="btn ghost" id="bb-ed-clear">Clear</button>
      <button class="btn" id="bb-ed-try">Try it</button>
      <button class="btn big" id="bb-ed-save">Save</button>
    </div>
  </section>

  <section class="screen bb" id="bb-top" hidden>
    <header class="topbar"><div class="tb-left">${home}${back}</div><h2>Top scores</h2><div class="tb-right"></div></header>
    ${seg("bb-top-level", diffItems.concat([["daily", "Today"]]))}
    <div id="bb-top-list"></div>
  </section>`);

  const scr = Act.createScreen({
    id: "bb-play", cls: "bb",
    onRestart: () => restart(),
    onQuit: () => A.goHome(),
    onResize: () => { if (R) layout(); }
  });

  function paintSeg(id, value) { $(id).querySelectorAll("button").forEach(b => b.setAttribute("aria-checked", String(b.dataset.v === String(value)))); }

  /* ---------- Menu ---------- */
  const todayTwist = () => { const d = Act.daily(); return d && d.gameId === ID ? d : null; };
  function showMenu() {
    A.setAccent(ACCENT);
    const d = todayTwist();
    $("bb-btn-daily").hidden = !d;
    if (d) $("bb-btn-daily").innerHTML = `Daily twist<small>${esc(d.name)}</small>`;
    A.show("bb-menu");
  }
  document.querySelectorAll("[data-bb-back]").forEach(b => b.addEventListener("click", showMenu));
  $("bb-btn-play").addEventListener("click", () => A.whoIsPlaying({ onDone: showLevels, onBack: showMenu, backLabel: "Brick Bash" }));
  $("bb-btn-daily").addEventListener("click", () => A.whoIsPlaying({
    onDone: p => startRun({ kind: "daily", diff: "medium", player: p, level: 0, twist: todayTwist() }), onBack: showMenu, backLabel: "Brick Bash"
  }));
  $("bb-btn-ours").addEventListener("click", () => showOurs());
  $("bb-btn-make").addEventListener("click", () => A.whoIsPlaying({ onDone: p => openEditor(null, p), onBack: showMenu, backLabel: "Brick Bash" }));
  $("bb-btn-top").addEventListener("click", () => showTop("easy"));

  // Campaign level picker: difficulty on top, then every level up to the furthest one reached.
  function showLevels() {
    const p = A.session.player;
    $("bb-playing-as").innerHTML = `${A.avatarSvg(p)}<span>Playing: <b>${esc(p.name)}</b></span>
      <button class="btn ghost" id="bb-switch">Switch</button>`;
    $("bb-switch").addEventListener("click", () => A.whoIsPlaying({ force: true, onDone: showLevels, onBack: showLevels, backLabel: "Levels" }));
    const diff = diffOf(p);
    paintSeg("bb-diff", diff);
    const best = Act.scores.best(ID, diff, p.id);
    $("bb-diff-note").textContent = LEVELS[diff].desc + (p.id ? ` · your best: ${best}` : "");
    const reach = furthest(p);
    const box = $("bb-map");
    box.innerHTML = "";
    BB.LEVELS.forEach((lv, i) => {
      const n = i + 1, open = n <= reach;
      const b = document.createElement("button");
      b.className = "bb-lvl" + (lv.boss ? " boss" : "") + (n === reach ? " next" : "");
      b.disabled = !open;
      b.innerHTML = `<b>${n}</b><small>${open ? esc(lv.boss ? "Boss" : lv.name) : "Locked"}</small>`;
      b.setAttribute("aria-label", `Level ${n}: ${open ? lv.name + (lv.boss ? " (boss)" : "") : "locked"}`);
      b.addEventListener("click", () => startRun({ kind: "campaign", diff: diffOf(p), player: p, level: i }));
      box.appendChild(b);
    });
    A.setAccent(ACCENT);
    A.show("bb-levels");
  }
  $("bb-diff").querySelectorAll("button").forEach(b => b.addEventListener("click", () => { setDiff(A.session.player, b.dataset.v); showLevels(); }));

  function showTop(level) {
    paintSeg("bb-top-level", level);
    const list = level === "daily" ? Act.scores.dailyTop(ID) : Act.scores.top(ID, level);
    const d = todayTwist();
    $("bb-top-list").innerHTML = (level === "daily" ? `<p class="note">${d ? `Today's twist: ${esc(d.name)}` : "Brick Bash isn't today's daily twist."}</p>` : "")
      + `<p class="note">Points in one run of the campaign.</p>` + Act.topListHtml(list, -1);
    A.setAccent(ACCENT);
    A.show("bb-top");
  }
  $("bb-top-level").querySelectorAll("button").forEach(b => b.addEventListener("click", () => showTop(b.dataset.v)));

  /* ---------- Our levels ---------- */
  let oursDiff = "easy";
  function showOurs() {
    paintSeg("bb-ours-diff", oursDiff);
    const box = $("bb-ours-list");
    box.innerHTML = custom.length ? "" : `<p class="note center-text">No levels yet. Make the first one!</p>`;
    custom.slice().reverse().forEach(lv => {
      const card = document.createElement("div");
      card.className = "bb-card";
      card.innerHTML = `<button class="bb-card-play" aria-label="Play ${esc(lv.name)}">
          <canvas width="78" height="40" aria-hidden="true"></canvas>
          <span class="bb-card-text"><b>${esc(lv.name)}</b>
            <small>${A.avatarSvg(lv.maker)}by ${esc(lv.maker.name)}</small>
            <small>${lv.best ? `Best: ${lv.best.score} (${esc(lv.best.name)})` : "No score yet"}</small></span>
        </button>
        <div class="bb-card-tools"><button class="btn ghost" data-act="edit">Edit</button><button class="btn ghost" data-act="del">Delete</button></div>`;
      drawPreview(card.querySelector("canvas"), lv.rows);
      card.querySelector(".bb-card-play").addEventListener("click", () => A.whoIsPlaying({
        onDone: p => startRun({ kind: "custom", diff: oursDiff, player: p, custom: lv }), onBack: showOurs, backLabel: "Our levels"
      }));
      card.querySelector("[data-act=edit]").addEventListener("click", () => openEditor(lv));
      card.querySelector("[data-act=del]").addEventListener("click", async () => {
        if (!(await A.confirm(`Delete "${lv.name}"? Nobody will be able to play it any more.`, "Delete"))) return;
        custom = custom.filter(x => x !== lv);
        saveCustom();
        showOurs();
      });
      box.appendChild(card);
    });
    $("bb-ours-note").textContent = `${custom.length} of ${MAX_CUSTOM} levels saved.`;
    A.setAccent(ACCENT);
    A.show("bb-ours");
  }
  $("bb-ours-diff").querySelectorAll("button").forEach(b => b.addEventListener("click", () => { oursDiff = b.dataset.v; paintSeg("bb-ours-diff", oursDiff); }));
  $("bb-ours-make").addEventListener("click", () => A.whoIsPlaying({ onDone: p => openEditor(null, p), onBack: showOurs, backLabel: "Our levels" }));

  function drawPreview(cv, rows) {
    const c = cv.getContext("2d"), cw = cv.width / COLS, ch = cv.height / EDIT_ROWS;
    rows.forEach((row, r) => [...row].forEach((t, k) => {
      if (t === ".") return;
      c.fillStyle = brickFill(t, t);
      c.fillRect(k * cw + 0.5, r * ch + 0.5, cw - 1, ch - 1);
    }));
  }

  /* ---------- Level editor ----------
     ED: { level (the saved level being edited, or null), maker, cells [COLS * EDIT_ROWS chars], tool, dirty } */
  let ED = null;
  const gridEl = $("bb-ed-grid");
  gridEl.innerHTML = Array.from({ length: COLS * EDIT_ROWS }, (_, i) => `<i class="bk" data-i="${i}" data-t="."></i>`).join("");
  const cellEls = [...gridEl.children];

  // level: a saved level to edit, or null for a new one made by maker.
  function openEditor(level, maker) {
    const who = level ? level.maker : { id: maker.id, name: maker.name, avatar: maker.avatar };
    ED = { level, maker: who, cells: [], tool: ED ? ED.tool : "w", dirty: false };
    const rows = level ? level.rows : [];
    for (let r = 0; r < EDIT_ROWS; r++) for (let c = 0; c < COLS; c++) ED.cells.push((rows[r] || "")[c] || ".");
    $("bb-ed-name").value = level ? level.name : "";
    $("bb-ed-err").textContent = "";
    paintTools();
    paintGrid();
    A.setAccent(ACCENT);
    A.show("bb-editor");
  }
  function paintTools() { $("bb-tools").querySelectorAll("button").forEach(b => b.setAttribute("aria-checked", String(b.dataset.t === ED.tool))); }
  function paintGrid() { cellEls.forEach((el, i) => { el.dataset.t = ED.cells[i]; }); }
  const edRows = () => Array.from({ length: EDIT_ROWS }, (_, r) => ED.cells.slice(r * COLS, r * COLS + COLS).join(""));
  const breakable = rows => rows.join("").replace(/[.#]/g, "").length;

  $("bb-tools").querySelectorAll("button").forEach(b => b.addEventListener("click", () => { ED.tool = b.dataset.t; paintTools(); }));
  // Tap or drag to paint; starting on a brick of the chosen kind erases instead.
  let paintMode = null;
  function cellAt(e) {
    const r = gridEl.getBoundingClientRect();
    const c = Math.floor((e.clientX - r.left) / (r.width / COLS)), row = Math.floor((e.clientY - r.top) / (r.height / EDIT_ROWS));
    return c >= 0 && c < COLS && row >= 0 && row < EDIT_ROWS ? row * COLS + c : -1;
  }
  function paintCell(i) {
    if (i < 0 || ED.cells[i] === paintMode) return;
    ED.cells[i] = paintMode;
    cellEls[i].dataset.t = paintMode;
    ED.dirty = true;
    $("bb-ed-err").textContent = "";
  }
  gridEl.addEventListener("pointerdown", e => {
    const i = cellAt(e);
    if (i < 0) return;
    paintMode = ED.cells[i] === ED.tool && ED.tool !== "." ? "." : ED.tool;
    paintCell(i);
    try { gridEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    e.preventDefault();
  });
  gridEl.addEventListener("pointermove", e => { if (paintMode) paintCell(cellAt(e)); });
  const stopPaint = () => { paintMode = null; };
  gridEl.addEventListener("pointerup", stopPaint);
  gridEl.addEventListener("pointercancel", stopPaint);
  $("bb-ed-name").addEventListener("input", () => { ED.dirty = true; $("bb-ed-err").textContent = ""; });

  $("bb-ed-clear").addEventListener("click", async () => {
    if (!ED.cells.some(t => t !== ".")) return;
    if (!(await A.confirm("Clear all the bricks?", "Clear"))) return;
    ED.cells.fill(".");
    ED.dirty = true;
    paintGrid();
  });
  $("bb-ed-try").addEventListener("click", () => {
    const rows = edRows();
    if (!breakable(rows)) { $("bb-ed-err").textContent = "Add at least one brick you can break."; return; }
    startRun({ kind: "custom", diff: oursDiff, player: A.session.chosen ? A.session.player : A.GUEST, custom: { name: $("bb-ed-name").value.trim() || "My level", rows }, fromEditor: true });
  });
  $("bb-ed-save").addEventListener("click", () => {
    const name = $("bb-ed-name").value.trim(), rows = edRows();
    if (!name) { $("bb-ed-err").textContent = "Give your level a name."; $("bb-ed-name").focus(); return; }
    if (!breakable(rows)) { $("bb-ed-err").textContent = "Add at least one brick you can break."; return; }
    if (ED.level) {
      // Changing the bricks makes the old best score unfair, so it's cleared.
      if (ED.level.rows.join("") !== rows.join("")) ED.level.best = null;
      ED.level.name = name;
      ED.level.rows = rows;
    } else {
      if (custom.length >= MAX_CUSTOM) { $("bb-ed-err").textContent = `There are already ${MAX_CUSTOM} levels. Delete one in Our levels first.`; return; }
      custom.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, maker: ED.maker, rows, best: null, made: Act.dateKey() });
    }
    saveCustom();
    ED.dirty = false;
    A.toast("Level saved!");
    showOurs();
  });
  async function leaveEditor() { return !ED.dirty || A.confirm("Leave without saving your level?", "Leave"); }
  $("bb-ed-back").addEventListener("click", async () => { if (await leaveEditor()) showOurs(); });
  A.homeGuards["bb-editor"] = leaveEditor;

  /* ---------- Run state ----------
     R: { kind ("campaign" | "daily" | "custom"), diff, cfg, player, twist, twistName, level (campaign index),
          def (the level being played), custom, fromEditor, score, lives, grid [GRID_ROWS][COLS] of brick | null,
          left (breakable bricks), boss, balls, bolts, caps, bombs, blasts, effects {wide, laser, sticky, slow},
          daze, pad {x, target}, aimT, launched, state ("play" | "clear" | "over"), t }
     brick: { t ("n" | "2" | "3" | "X" | "#" | "?"), color, hp, max, boom }
     ball: { x, y, dx, dy (unit direction), sp, r, held, off }
     boss: { col (left edge, in bricks), dir, speed, cells [{c, r, hp, max, color, weakOK, dead}], map, weak, health, max, flash, dead } */
  let R = null;
  const dustFx = Act.dust(70);
  const keysDown = new Set();
  const F = {};                          // field geometry, see layout()
  const layer = document.createElement("canvas"), lctx = layer.getContext("2d"); // the bricks, redrawn only when they change

  function startRun({ kind, diff, player, level, custom: lv, fromEditor, twist }) {
    const cfg = LEVELS[diff];
    R = {
      kind, diff, cfg, player, level: level || 0, def: null, custom: lv, fromEditor: !!fromEditor,
      twist: twist ? twist.twist : -1, twistName: twist ? twist.name : "",
      score: 0, lives: cfg.lives, t: 0, pad: { x: 0, target: null }, aimT: 0,
      themeId: A.resolveTheme(A.settings.theme)
    };
    A.noteThemeUsed(R.themeId);
    A.setAccent(ACCENT);
    scr.show();
    requestAnimationFrame(() => {
      layout();
      loadLevel();
      scr.start(update, render);
    });
  }
  const twistArg = () => (R.twist >= 0 ? { twist: R.twist, name: R.twistName } : null);
  // Restart (from the Paused screen): a fresh run from the level being played (the daily twist from level 1).
  function restart() {
    if (!R) return;
    startRun({ kind: R.kind, diff: R.diff, player: R.player, level: R.kind === "daily" ? 0 : R.level, custom: R.custom, fromEditor: R.fromEditor, twist: twistArg() });
  }

  function makeBrick(t) {
    if (t === "." || !t) return null;
    if (COLORS[t]) return { t: "n", color: t, hp: 1, max: 1, boom: false };
    const hp = t === "2" ? 2 : t === "3" ? 3 : 1;
    return { t, color: t, hp, max: hp, boom: false };
  }
  function loadLevel() {
    const def = R.def = R.kind === "custom" ? R.custom : BB.LEVELS[R.level];
    R.grid = Array.from({ length: GRID_ROWS }, () => new Array(COLS).fill(null));
    R.left = 0;
    R.boss = null;
    if (def.boss) R.boss = makeBoss(def);
    else def.rows.forEach((row, r) => [...row].forEach((t, c) => {
      const b = makeBrick(t);
      if (!b || r >= GRID_ROWS) return;
      if (R.twist === 1 && b.t !== "#") b.boom = true; // daily twist: every brick explodes
      R.grid[r][c] = b;
      if (b.t !== "#") R.left++;
    }));
    R.pad.x = F.x + F.w / 2; R.pad.target = null;
    R.balls = [newHeldBall()];
    R.bolts = []; R.caps = []; R.bombs = []; R.blasts = [];
    R.effects = { wide: 0, laser: 0, sticky: 0, slow: 0 };
    R.daze = 0; R.launched = false; R.state = "play"; R.levelT = 0; R.fireT = 0; R.nextBomb = 0;
    R.bricksDirty = true;
    dustFx.clear();
    updateHud();
  }

  function makeBoss(def) {
    const idx = BB.LEVELS.indexOf(def);
    const tally = {};
    for (const ch of def.rows.join("")) if (COLORS[ch]) tally[ch] = (tally[ch] || 0) + 1;
    const main = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0] || "w";
    const cells = [], map = def.rows.map(() => []);
    def.rows.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch === ".") return;
      const hp = ch === "2" ? 2 : ch === "3" ? 3 : 1;
      const cell = { c, r, hp, max: hp, color: ch === "W" ? main : ch, weakOK: ch === "W", dead: false };
      cells.push(cell);
      map[r][c] = cell;
    }));
    const width = def.rows[0].length, spots = cells.filter(c => c.weakOK);
    return {
      cells, map, width, height: def.rows.length, col: (COLS - width) / 2, dir: Math.random() < 0.5 ? -1 : 1,
      speed: 0.9 + Math.max(0, idx) / 5 * 0.06, // bricks per second; later bosses are a little quicker
      health: def.health, max: def.health, flash: 0, dead: false,
      weak: spots[Math.floor(Math.random() * spots.length)]
    };
  }

  /* ---------- Geometry ---------- */
  const W = () => scr.size.w, H = () => scr.size.h;
  function layout() {
    F.w = Math.min(W(), H() * 0.78);
    F.x = (W() - F.w) / 2;
    F.cw = F.w / COLS;
    F.ch = Math.min(F.cw * 0.6, H() * 0.045);
    F.top = 0;
    F.gridY = F.ch * 1.6;
    F.padH = Math.max(10, F.ch * 0.75);
    F.padY = H() - Math.max(26, H() * 0.07);
    F.r0 = Math.max(5, Math.min(F.cw * 0.2, 9));
    R.speed0 = H() * R.cfg.ball;
    layer.width = Math.round(W() * scr.size.dpr);
    layer.height = Math.round(H() * scr.size.dpr);
    R.bricksDirty = true;
    // Keep things inside the field after a resize.
    if (R.balls) for (const b of R.balls) { b.x = Math.max(F.x + b.r, Math.min(F.x + F.w - b.r, b.x)); b.y = Math.min(b.y, F.padY - b.r); }
    R.pad.x = Math.max(F.x, Math.min(F.x + F.w, R.pad.x));
  }
  const padW = () => R.cfg.paddle * F.w * (R.effects.wide > R.t ? 1.5 : 1);
  const brickRect = (r, c) => ({ x: F.x + c * F.cw, y: F.gridY + r * F.ch, w: F.cw, h: F.ch });
  const bossCellRect = cell => ({ x: F.x + (R.boss.col + cell.c) * F.cw, y: F.gridY + (BOSS_ROW + cell.r) * F.ch, w: F.cw, h: F.ch });

  /* ---------- Input: drag anywhere to move the paddle, tap to launch (or fire lasers) ---------- */
  let press = null;
  const local = e => { const r = scr.stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  scr.stage.addEventListener("pointerdown", e => {
    if (!R) return;
    const p = local(e);
    press = { id: e.pointerId, x: p.x, y: p.y, t: performance.now(), moved: false };
    R.pad.target = p.x;
    try { scr.stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    e.preventDefault();
  });
  scr.stage.addEventListener("pointermove", e => {
    if (!R || !press || press.id !== e.pointerId) return;
    const p = local(e);
    R.pad.target = p.x;
    if (Math.hypot(p.x - press.x, p.y - press.y) > 12) press.moved = true;
  });
  scr.stage.addEventListener("pointerup", e => {
    if (press && press.id === e.pointerId && !press.moved && performance.now() - press.t < 450) tap();
    press = null;
  });
  scr.stage.addEventListener("pointercancel", () => { press = null; });
  // Keyboard: arrows move, space (or up) launches and fires.
  document.addEventListener("keydown", e => {
    if (A.currentScreen !== "bb-play" || A.dialogOpen()) return;
    if (e.key === " " || e.key === "ArrowUp") { e.preventDefault(); tap(); return; }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { keysDown.add(e.key); e.preventDefault(); }
  });
  document.addEventListener("keyup", e => keysDown.delete(e.key));

  function tap() {
    if (!R || !scr.running || R.state !== "play") return;
    const held = R.balls.filter(b => b.held);
    if (held.length) { for (const b of held) launch(b); return; }
    if (R.effects.laser > R.t) fire();
  }

  /* ---------- Balls ---------- */
  // The aim arrow on a ball waiting on the paddle swings slowly from side to side.
  const aimAngle = () => Math.sin(R.aimT * 2.2) * 0.85;
  function newHeldBall() { return { x: R.pad.x, y: F.padY - F.r0, dx: 0, dy: -1, sp: R.speed0, r: F.r0, held: true, off: 0 }; }
  function launch(b) {
    const a = aimAngle();
    b.held = false;
    b.dx = Math.sin(a); b.dy = -Math.cos(a);
    R.launched = true;
  }
  // Never let the ball travel almost flat, or it would take forever to come back.
  function fixAngle(b) {
    const min = 0.28;
    if (Math.abs(b.dy) < min) {
      b.dy = (b.dy < 0 ? -1 : 1) * min;
      b.dx = (b.dx < 0 ? -1 : 1) * Math.sqrt(1 - min * min);
    }
  }
  // A tiny random turn off the walls, so the ball can't get stuck in the same loop forever.
  function jitter(b) {
    const a = (Math.random() - 0.5) * 0.06, c = Math.cos(a), s = Math.sin(a);
    [b.dx, b.dy] = [b.dx * c - b.dy * s, b.dx * s + b.dy * c];
    fixAngle(b);
  }
  function grow(b) { if (R.twist === 0) b.r = Math.min(F.r0 * 3, b.r * 1.05); } // daily twist: the ball grows

  // The brick or boss cell nearest the ball that it overlaps, or null.
  function overlap(x, y, r) {
    let best = null, bestD = Infinity;
    const x0 = x - r + 0.5, x1 = x + r - 0.5, y0 = y - r + 0.5, y1 = y + r - 0.5;
    const c0 = Math.max(0, Math.floor((x0 - F.x) / F.cw)), c1 = Math.min(COLS - 1, Math.floor((x1 - F.x) / F.cw));
    const r0 = Math.max(0, Math.floor((y0 - F.gridY) / F.ch)), r1 = Math.min(GRID_ROWS - 1, Math.floor((y1 - F.gridY) / F.ch));
    for (let row = r0; row <= r1; row++) for (let c = c0; c <= c1; c++) {
      if (!R.grid[row][c]) continue;
      const d = Math.hypot(F.x + (c + 0.5) * F.cw - x, F.gridY + (row + 0.5) * F.ch - y);
      if (d < bestD) { bestD = d; best = { row, c }; }
    }
    const boss = R.boss;
    if (boss && !boss.dead) {
      const bx = F.x + boss.col * F.cw, by = F.gridY + BOSS_ROW * F.ch;
      const bc0 = Math.max(0, Math.floor((x0 - bx) / F.cw)), bc1 = Math.min(boss.width - 1, Math.floor((x1 - bx) / F.cw));
      const br0 = Math.max(0, Math.floor((y0 - by) / F.ch)), br1 = Math.min(boss.height - 1, Math.floor((y1 - by) / F.ch));
      for (let row = br0; row <= br1; row++) for (let c = bc0; c <= bc1; c++) {
        const cell = boss.map[row][c];
        if (!cell || cell.dead) continue;
        const d = Math.hypot(bx + (c + 0.5) * F.cw - x, by + (row + 0.5) * F.ch - y);
        if (d < bestD) { bestD = d; best = { cell }; }
      }
    }
    return best;
  }
  function strike(hit) {
    if (hit.cell) hitBossCell(hit.cell); else hitBrick(hit.row, hit.c);
  }

  function moveBall(b, dt) {
    const dist = b.sp * (R.effects.slow > R.t ? 0.65 : 1) * dt;
    const n = Math.max(1, Math.ceil(dist / (b.r * 0.8)));
    const step = dist / n;
    for (let i = 0; i < n && R.state === "play"; i++) {
      // Already inside something (the boss slid onto the ball, or the ball grew): knock it loose downwards.
      let hit = overlap(b.x, b.y, b.r);
      if (hit) {
        const rc = hit.cell ? bossCellRect(hit.cell) : brickRect(hit.row, hit.c);
        strike(hit);
        b.y = Math.max(b.y, rc.y + rc.h + b.r + 0.5);
        b.dy = Math.abs(b.dy);
        continue;
      }
      b.x += b.dx * step;
      hit = overlap(b.x, b.y, b.r);
      if (hit) { b.x -= b.dx * step; b.dx = -b.dx; strike(hit); grow(b); }
      b.y += b.dy * step;
      hit = overlap(b.x, b.y, b.r);
      if (hit) { b.y -= b.dy * step; b.dy = -b.dy; strike(hit); grow(b); fixAngle(b); }
      // Walls.
      if (b.x - b.r < F.x) { b.x = F.x + b.r; b.dx = Math.abs(b.dx); jitter(b); }
      if (b.x + b.r > F.x + F.w) { b.x = F.x + F.w - b.r; b.dx = -Math.abs(b.dx); jitter(b); }
      if (b.y - b.r < F.top) { b.y = F.top + b.r; b.dy = Math.abs(b.dy); jitter(b); }
      // Paddle.
      const w = padW(), reach = w / 2 + b.r + R.cfg.forgive * F.cw;
      if (b.dy > 0 && b.y + b.r >= F.padY && b.y - b.r <= F.padY + F.padH && Math.abs(b.x - R.pad.x) <= reach) {
        hitPaddle(b, w);
        if (b.held) return;
      }
      if (b.y - b.r > H()) { b.lost = true; return; }
    }
    if (b.sp > R.speed0 * 1.15 && Math.random() < 0.3) dustFx.emit(b.x, b.y, "#f2f0e6", 1);
  }

  function hitPaddle(b, w) {
    const offset = Math.max(-1, Math.min(1, (b.x - R.pad.x) / (w / 2)));
    b.y = F.padY - b.r;
    grow(b);
    if (R.effects.sticky > R.t) {
      // Sticky paddle: catch the ball; it waits with the aim arrow until the next tap.
      b.held = true;
      b.off = Math.max(-w / 2, Math.min(w / 2, b.x - R.pad.x));
      sound("right");
      return;
    }
    const a = offset * MAX_ANGLE;
    b.dx = Math.sin(a); b.dy = -Math.cos(a);
    b.sp = Math.min(R.speed0 * 1.3, b.sp * 1.01);
    sound("right");
  }

  /* ---------- Bricks ---------- */
  function hitBrick(row, c) {
    const br = R.grid[row][c];
    if (!br || br.t === "#") return;
    br.hp--;
    if (br.hp > 0) { R.score += SCORE.crack; R.bricksDirty = true; sound("right"); return; }
    destroyBrick(row, c, "hit");
  }
  // cause: "hit" (ball or laser), "chain" (set off by another explosive brick) or "blast" (caught in a blast).
  function destroyBrick(row, c, cause) {
    const br = R.grid[row][c];
    if (!br || br.t === "#") return;
    R.grid[row][c] = null;
    R.left--;
    R.score += SCORE[br.t] || SCORE.n;
    R.bricksDirty = true;
    const rc = brickRect(row, c), cx = rc.x + rc.w / 2, cy = rc.y + rc.h / 2;
    dustFx.emit(cx, cy, brickFill(br.t, br.color), 4);
    sound("right");
    if (br.t === "?") dropPower(cx, cy);
    // Explosive bricks clear the bricks next to them and set off other explosive bricks.
    // On "every brick explodes" days a brick only explodes when hit itself, so one hit can't clear the level.
    if (br.t === "X" || (br.boom && cause !== "blast")) {
      R.blasts.push({ x: cx, y: cy, t: R.t });
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = row + dr, cc = c + dc;
        if ((dr || dc) && rr >= 0 && rr < GRID_ROWS && cc >= 0 && cc < COLS && R.grid[rr][cc]) {
          destroyBrick(rr, cc, R.grid[rr][cc].t === "X" ? "chain" : "blast");
        }
      }
    }
    checkClear();
  }

  /* ---------- Boss ---------- */
  function hitBossCell(cell) {
    const boss = R.boss;
    if (!boss || boss.dead) return;
    if (cell === boss.weak) { bossHit(); return; }
    cell.hp--;
    sound("right");
    if (cell.hp <= 0) {
      cell.dead = true;
      R.score += SCORE.armor;
      const rc = bossCellRect(cell);
      dustFx.emit(rc.x + rc.w / 2, rc.y + rc.h / 2, brickFill(cell.color, cell.color), 3);
    }
  }
  function bossHit() {
    const boss = R.boss;
    boss.health--;
    boss.flash = R.t + 0.35;
    R.score += SCORE.weak;
    A.sfx.win();
    const rc = bossCellRect(boss.weak);
    R.blasts.push({ x: rc.x + rc.w / 2, y: rc.y + rc.h / 2, t: R.t });
    if (boss.health <= 0) {
      boss.dead = true;
      R.score += SCORE.boss;
      R.bombs = [];
      for (const cell of boss.cells) { const r2 = bossCellRect(cell); dustFx.emit(r2.x + r2.w / 2, r2.y + r2.h / 2, brickFill(cell.color, cell.color), 2); }
      scr.burst("Boss beaten!");
      checkClear();
      return;
    }
    scr.message("Bonk!", 700);
    // The weak spot moves somewhere else (growing back there if that brick was broken, unless a ball is in the way).
    const free = c => { const rc2 = bossCellRect(c); return !R.balls.some(b => b.x + b.r > rc2.x && b.x - b.r < rc2.x + rc2.w && b.y + b.r > rc2.y && b.y - b.r < rc2.y + rc2.h); };
    const spots = boss.cells.filter(c => c.weakOK && c !== boss.weak && (!c.dead || free(c)));
    if (spots.length) boss.weak = spots[Math.floor(Math.random() * spots.length)];
    boss.weak.dead = false; boss.weak.hp = boss.weak.max;
  }
  function moveBoss(dt) {
    const boss = R.boss;
    if (!boss || boss.dead || !R.launched) return; // it waits until the ball is launched
    boss.col += boss.dir * boss.speed * dt;
    const maxCol = COLS - boss.width;
    if (boss.col < 0) { boss.col = 0; boss.dir = 1; }
    if (boss.col > maxCol) { boss.col = maxCol; boss.dir = -1; }
    // Slow projectiles to dodge, dropped from the bottom of a random column.
    if (R.t >= R.nextBomb) {
      if (R.nextBomb) {
        const bottoms = [];
        for (let c = 0; c < boss.width; c++) {
          let low = null;
          for (const cell of boss.cells) if (cell.c === c && !cell.dead && (!low || cell.r > low.r)) low = cell;
          if (low) bottoms.push(low);
        }
        if (bottoms.length) {
          const rc = bossCellRect(bottoms[Math.floor(Math.random() * bottoms.length)]);
          R.bombs.push({ x: rc.x + rc.w / 2, y: rc.y + rc.h, r: Math.max(5, F.cw * 0.22) });
        }
      }
      R.nextBomb = R.t + R.cfg.drop * (0.7 + Math.random() * 0.6);
    }
  }
  function updateBombs(dt) {
    const v = H() * R.cfg.fall, w = padW();
    for (let i = R.bombs.length - 1; i >= 0; i--) {
      const k = R.bombs[i];
      k.y += v * dt;
      if (k.y + k.r >= F.padY && k.y - k.r <= F.padY + F.padH && Math.abs(k.x - R.pad.x) <= w / 2 + k.r) {
        R.bombs.splice(i, 1);
        dustFx.emit(k.x, k.y, "#f29a9a", 6);
        scr.message("Splat!", 800);
        // Easy and Medium: the paddle is slowed for a moment. Hard and Impossible: it costs a life.
        if (R.cfg.daze) { R.daze = R.t + 1.2; A.buzz(); A.sfx.wrong(); }
        else { loseLife(true); return; }
      } else if (k.y - k.r > H()) R.bombs.splice(i, 1);
    }
  }

  /* ---------- Power-ups and lasers ---------- */
  function dropPower(x, y) {
    const list = Object.entries(POWERS), total = list.reduce((s, [, p]) => s + p.w, 0);
    let roll = Math.random() * total, type = "multi";
    for (const [k, p] of list) { roll -= p.w; if (roll < 0) { type = k; break; } }
    R.caps.push({ type, x, y });
  }
  function updateCaps(dt) {
    const v = H() * 0.2, w = padW(), cw = F.cw * 0.9, chh = F.ch * 0.9;
    for (let i = R.caps.length - 1; i >= 0; i--) {
      const k = R.caps[i];
      k.y += v * dt;
      if (k.y + chh / 2 >= F.padY && k.y - chh / 2 <= F.padY + F.padH && Math.abs(k.x - R.pad.x) <= w / 2 + cw / 2) {
        R.caps.splice(i, 1);
        applyPower(k.type);
      } else if (k.y - chh > H()) R.caps.splice(i, 1);
    }
  }
  function applyPower(type) {
    const p = POWERS[type];
    if (type === "multi") {
      for (const b of R.balls) if (b.held) launch(b);
      for (const b of R.balls.slice()) {
        for (const turn of [-0.4, 0.4]) {
          if (R.balls.length >= MAX_BALLS) break;
          const c = Math.cos(turn), s = Math.sin(turn);
          const nb = { ...b, dx: b.dx * c - b.dy * s, dy: b.dx * s + b.dy * c, held: false };
          fixAngle(nb);
          R.balls.push(nb);
        }
      }
    } else if (type === "life") R.lives = Math.min(MAX_LIVES, R.lives + 1);
    else R.effects[type] = R.t + p.time;
    scr.message(p.name, 900);
    dustFx.emit(R.pad.x, F.padY, p.color, 10);
    A.sfx.right();
  }
  function fire() {
    if (R.t < R.fireT) return;
    R.fireT = R.t + 0.22;
    const w = padW();
    for (const sgn of [-1, 1]) R.bolts.push({ x: R.pad.x + sgn * w * 0.4, y: F.padY });
    sound("right");
  }
  function updateBolts(dt) {
    const v = H() * 1.2;
    for (let i = R.bolts.length - 1; i >= 0; i--) {
      const k = R.bolts[i];
      k.y -= v * dt;
      const hit = overlap(k.x, k.y, 2);
      if (hit) { R.bolts.splice(i, 1); strike(hit); if (R.state !== "play") return; }
      else if (k.y < F.top) R.bolts.splice(i, 1);
    }
  }

  /* ---------- Update ---------- */
  function update(dt) {
    if (R.state !== "play") return;
    R.t += dt; R.levelT += dt; R.aimT += dt;
    movePaddle();
    moveBoss(dt);
    for (const b of R.balls) {
      if (b.held) { b.x = R.pad.x + b.off; b.y = F.padY - b.r; } else moveBall(b, dt);
      if (R.state !== "play") return;
    }
    R.balls = R.balls.filter(b => !b.lost);
    if (!R.balls.length) { loseLife(false); return; }
    updateCaps(dt);
    updateBolts(dt);
    if (R.state !== "play") return;
    updateBombs(dt);
    R.blasts = R.blasts.filter(k => R.t - k.t < 0.35);
    dustFx.update(dt);
    updateHud();
  }
  function movePaddle() {
    let target = R.pad.target;
    if (keysDown.size && !press) {
      const v = F.w * 1.5 * Act.STEP;
      if (keysDown.has("ArrowLeft")) target = R.pad.x - v;
      if (keysDown.has("ArrowRight")) target = R.pad.x + v;
      R.pad.target = null;
    }
    if (target == null) return;
    // Stunned by a boss's blob: the paddle can only creep along.
    if (R.daze > R.t) { const max = F.w * 0.45 * Act.STEP; target = R.pad.x + Math.max(-max, Math.min(max, target - R.pad.x)); }
    const half = padW() / 2;
    R.pad.x = Math.max(F.x + half, Math.min(F.x + F.w - half, target));
  }

  // At most one sound every 60 ms, so a chain of explosions doesn't turn into noise.
  let lastSound = 0;
  function sound(name) {
    const now = performance.now();
    if (now - lastSound < 60) return;
    lastSound = now;
    A.sfx[name]();
  }

  /* ---------- Lives, levels and the end of a run ---------- */
  function loseLife(byBomb) {
    R.lives--;
    A.sfx.lose();
    A.buzz();
    R.caps = []; R.bolts = []; R.bombs = [];
    R.effects = { wide: 0, laser: 0, sticky: 0, slow: 0 };
    R.daze = 0;
    if (R.lives <= 0) { gameOver(); return; }
    R.balls = [newHeldBall()];
    R.launched = false;
    R.nextBomb = 0;
    if (!byBomb) scr.message("Ouch!", 800);
    updateHud();
    scr.hold(800);
  }
  function checkClear() {
    if (R.state !== "play") return;
    if (R.boss ? !R.boss.dead : R.left > 0) return;
    R.state = "clear";
    R.score += SCORE.clear;
    updateHud();
    scr.stop();
    A.sfx.win();
    if (R.kind === "custom") { setTimeout(() => finishCustom(true), 500); return; }
    const n = R.level + 1;
    if (R.kind === "campaign") {
      // Unlock the next level for this player.
      const next = Math.min(BB.LEVELS.length, n + 1);
      if (R.player.id) { if ((progress[R.player.id] || 1) < next) { progress[R.player.id] = next; saveProgress(); } }
      else guestFurthest = Math.max(guestFurthest, next);
    }
    if (n >= BB.LEVELS.length) { setTimeout(() => finishRun("won"), 500); return; }
    setTimeout(() => {
      if (A.currentScreen !== "bb-play") return;
      scr.showPanel({
        html: `<h2>${R.boss ? "Boss beaten!" : `Level ${n} cleared!`}</h2>
          <p class="big-score">${R.score}</p>
          <p class="note">Up next: level ${n + 1}, ${esc(BB.LEVELS[n].name)}${BB.LEVELS[n].boss ? " (boss)" : ""}</p>`,
        buttons: [{ label: "Next level", cls: "big", run: nextLevel }, { label: "Stop here", cls: "ghost", run: () => finishRun("stopped") }]
      });
    }, 600);
  }
  function nextLevel() {
    R.level++;
    loadLevel();
    scr.start(update, render);
  }
  function gameOver() {
    R.state = "over";
    updateHud();
    scr.stop();
    if (R.kind === "custom") setTimeout(() => finishCustom(false), 400);
    else setTimeout(() => finishRun("over"), 400);
  }

  // how: "over" (out of balls), "stopped" (chose to stop between levels) or "won" (beat level 30).
  function finishRun(how) {
    const daily = R.kind === "daily";
    const res = Act.scores.submit(ID, R.diff, R.player, R.score, { daily });
    if (res.newBest) scr.burst("New best!");
    if (how === "won") A.sfx.win();
    const list = daily ? Act.scores.dailyTop(ID) : Act.scores.top(ID, R.diff);
    const n = R.level + 1, lvName = LEVELS[R.diff].name;
    const from = daily || how === "won" ? 0 : how === "stopped" ? R.level + 1 : R.level;
    const again = {
      label: daily || how === "won" ? "Play again" : how === "stopped" ? `Play level ${from + 1}` : `Try level ${n} again`,
      cls: "big",
      run: () => startRun({ kind: R.kind, diff: R.diff, player: R.player, level: from, twist: twistArg() })
    };
    setTimeout(() => {
      if (A.currentScreen !== "bb-play") return;
      scr.showPanel({
        html: `<h2>${how === "won" ? "You beat Brick Bash!" : how === "stopped" ? "Nice run!" : "Game over"}</h2>
          <p class="big-score">${R.score}</p>
          ${daily ? `<p class="note">Daily twist: ${esc(R.twistName)}</p>` : ""}
          <p class="note">${how === "won" ? "All 30 levels!" : `Reached level ${n}`}${R.player.id && !daily ? ` · your best on ${lvName}: <b>${res.best}</b>` : ""}</p>
          <h3 class="label">${daily ? "Today's top scores" : `Top scores on ${lvName}`}</h3>
          ${Act.topListHtml(list, res.rank)}`,
        buttons: [again, { label: daily ? "Menu" : "Levels", cls: "ghost", run: () => (daily ? showMenu() : showLevels()) }]
      });
    }, res.newBest ? 900 : 300);
  }

  function finishCustom(won) {
    const lv = R.custom, p = R.player;
    let newBest = false;
    // Best score on a household level (not for test runs from the editor, or guests).
    if (!R.fromEditor && p.id && custom.includes(lv) && (!lv.best || R.score > lv.best.score)) {
      lv.best = { score: R.score, id: p.id, name: p.name, avatar: p.avatar };
      saveCustom();
      newBest = true;
      scr.burst("New best!");
    }
    if (!won) A.sfx.lose();
    const backBtn = R.fromEditor
      ? { label: "Back to editor", cls: "ghost", run: () => { A.setAccent(ACCENT); A.show("bb-editor"); } }
      : { label: "Our levels", cls: "ghost", run: showOurs };
    setTimeout(() => {
      if (A.currentScreen !== "bb-play") return;
      scr.showPanel({
        html: `<h2>${won ? "Level cleared!" : "Out of balls"}</h2>
          <p class="big-score">${R.score}</p>
          <p class="note">${esc(lv.name)}${lv.best && !R.fromEditor ? ` · best: <b>${lv.best.score}</b> by ${esc(lv.best.name)}` : ""}</p>`,
        buttons: [{ label: "Play again", cls: "big", run: restart }, backBtn]
      });
    }, newBest ? 900 : 300);
  }

  /* ---------- HUD ---------- */
  let hudText = "";
  function updateHud() {
    const hearts = R.lives > 5 ? `♥×${R.lives}` : "♥".repeat(Math.max(0, R.lives));
    const where = R.kind === "custom" ? `<span class="lvname">${esc(R.custom.name)}</span>` : `<span>Lv</span><b>${R.level + 1}</b>`;
    const html = `${where}<span>Score</span><b>${R.score}</b><span class="lives">${hearts}</span>`;
    if (html !== hudText) { scr.hud.innerHTML = html; hudText = html; }
  }

  /* ---------- Drawing ---------- */
  const FONT = px => `${px}px "Gochi Hand", "Comic Sans MS", cursive`;
  function brickFill(t, color) {
    if (COLORS[color]) return COLORS[color];
    return { 2: "#c8cfc4", 3: "#a9b5ab", X: "#ff8a65", "#": "#5f7166", "?": "#f3d36b" }[t] || "#f2f0e6";
  }
  function rrect(c, x, y, w, h, r) {
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h);
  }
  function drawBrick(c, x, y, w, h, br) {
    const g = 1.5;
    x += g; y += g; w -= g * 2; h -= g * 2;
    c.globalAlpha = 0.92;
    c.fillStyle = brickFill(br.t, br.color);
    rrect(c, x, y, w, h, 3); c.fill();
    c.globalAlpha = 0.35; c.fillStyle = "#fff";
    c.fillRect(x + 2, y + 1.5, w - 4, Math.max(1.5, h * 0.16));
    c.globalAlpha = 1;
    c.strokeStyle = "rgba(38,61,48,.55)"; c.lineWidth = 1.5;
    rrect(c, x, y, w, h, 3); c.stroke();
    c.lineCap = "round";
    if (br.t === "2" || br.t === "3") {
      // Tough bricks: a band for each extra hit they can take, and cracks for each hit taken.
      c.strokeStyle = "rgba(38,61,48,.35)"; c.lineWidth = 1.5;
      for (let k = 1; k < br.max; k++) { c.beginPath(); c.moveTo(x + 3, y + h * k / br.max); c.lineTo(x + w - 3, y + h * k / br.max); c.stroke(); }
      const taken = br.max - br.hp;
      c.strokeStyle = "#263d30"; c.lineWidth = 1.6;
      if (taken >= 1) { c.beginPath(); c.moveTo(x + w * 0.3, y); c.lineTo(x + w * 0.42, y + h * 0.45); c.lineTo(x + w * 0.34, y + h * 0.7); c.lineTo(x + w * 0.45, y + h); c.stroke(); }
      if (taken >= 2) { c.beginPath(); c.moveTo(x + w * 0.75, y); c.lineTo(x + w * 0.64, y + h * 0.5); c.lineTo(x + w * 0.78, y + h); c.moveTo(x + w * 0.64, y + h * 0.5); c.lineTo(x + w * 0.9, y + h * 0.4); c.stroke(); }
    } else if (br.t === "X") {
      c.strokeStyle = "#7a2e1c"; c.lineWidth = 1.6;
      const cx = x + w / 2, cy = y + h / 2, s = h * 0.38;
      c.beginPath();
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4; c.moveTo(cx - Math.cos(a) * s * 1.3, cy - Math.sin(a) * s); c.lineTo(cx + Math.cos(a) * s * 1.3, cy + Math.sin(a) * s); }
      c.stroke();
    } else if (br.t === "#") {
      c.strokeStyle = "rgba(242,240,230,.22)"; c.lineWidth = 1.5;
      c.save(); rrect(c, x, y, w, h, 3); c.clip();
      c.beginPath();
      for (let k = -h; k < w; k += 6) { c.moveTo(x + k, y + h); c.lineTo(x + k + h, y); }
      c.stroke(); c.restore();
    } else if (br.t === "?") {
      star(c, x + w / 2, y + h / 2, h * 0.42, "#8a5a34");
    }
    if (br.boom) { c.fillStyle = "#c0392b"; c.beginPath(); c.arc(x + w - 4, y + 4, 2.2, 0, Math.PI * 2); c.fill(); }
  }
  function star(c, cx, cy, r, color) {
    c.strokeStyle = color; c.lineWidth = 1.6;
    c.beginPath();
    for (let k = 0; k <= 10; k++) {
      const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r;
      c[k ? "lineTo" : "moveTo"](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    c.stroke();
  }
  function paintLayer() {
    const d = scr.size.dpr;
    lctx.setTransform(d, 0, 0, d, 0, 0);
    lctx.clearRect(0, 0, W(), H());
    for (let r = 0; r < GRID_ROWS; r++) for (let c = 0; c < COLS; c++) {
      const br = R.grid[r][c];
      if (br) { const rc = brickRect(r, c); drawBrick(lctx, rc.x, rc.y, rc.w, rc.h, br); }
    }
    R.bricksDirty = false;
  }

  const flipped = () => R.twist === 2; // daily twist: everything upside down, paddle at the top
  // Text stays readable when the field is drawn upside down.
  function text(ctx, str, x, y, px, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = color; ctx.font = FONT(px); ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.translate(x, y);
    if (flipped()) ctx.scale(1, -1);
    ctx.fillText(str, 0, 0);
    ctx.restore();
  }

  function render() {
    if (!R || !R.grid) return;
    const ctx = scr.ctx, w = W(), h = H();
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    if (flipped()) { ctx.translate(0, h); ctx.scale(1, -1); }
    // Field walls.
    ctx.strokeStyle = "rgba(242,240,230,.55)"; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath();
    if (F.x > 2) { ctx.moveTo(F.x, h); ctx.lineTo(F.x, F.top + 1.5); ctx.lineTo(F.x + F.w, F.top + 1.5); ctx.lineTo(F.x + F.w, h); }
    else { ctx.moveTo(0, F.top + 1.5); ctx.lineTo(w, F.top + 1.5); }
    ctx.stroke();

    if (R.bricksDirty) paintLayer();
    ctx.drawImage(layer, 0, 0, w, h);
    if (R.boss) drawBoss(ctx);
    for (const k of R.blasts) {
      const a = (R.t - k.t) / 0.35;
      ctx.globalAlpha = 0.6 * (1 - a); ctx.fillStyle = "#ffd9a0";
      ctx.beginPath(); ctx.arc(k.x, k.y, F.cw * (0.6 + a * 1.2), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    for (const k of R.caps) drawCap(ctx, k);
    for (const k of R.bombs) {
      ctx.fillStyle = "#f29a9a"; ctx.strokeStyle = "#263d30"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(k.x, k.y, k.r, k.r * (1.1 + Math.sin(R.t * 12) * 0.12), 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.strokeStyle = "#ff8a65"; ctx.lineWidth = 3;
    for (const k of R.bolts) { ctx.beginPath(); ctx.moveTo(k.x, k.y); ctx.lineTo(k.x, k.y + F.ch); ctx.stroke(); }
    dustFx.draw(ctx);
    for (const b of R.balls) drawBall(ctx, b);
    drawPaddle(ctx);

    // A ball waiting on the paddle: the aim arrow, and what to do.
    const held = R.balls.find(b => b.held);
    if (held && R.state === "play") {
      const a = aimAngle(), len = F.cw * 2.6;
      ctx.strokeStyle = "rgba(242,240,230,.7)"; ctx.lineWidth = 2.5; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(held.x, held.y); ctx.lineTo(held.x + Math.sin(a) * len, held.y - Math.cos(a) * len); ctx.stroke();
      ctx.setLineDash([]);
      const midY = (F.padY + F.gridY + GRID_ROWS * F.ch) / 2 + F.ch * 2;
      if (!R.launched) {
        const title = R.kind === "custom" ? R.custom.name : `Level ${R.level + 1}: ${R.def.name}`;
        text(ctx, title, w / 2, midY - 30, Math.round(Math.min(30, F.cw * 1.1)), ACCENT, 0.9);
      }
      text(ctx, "Tap to launch", w / 2, midY + 6, 20, "#f2f0e6", 0.75);
    }
    ctx.restore();
  }

  function drawBoss(ctx) {
    const boss = R.boss;
    if (boss.dead) return;
    const pulse = 0.65 + Math.sin(R.t * 6) * 0.35;
    for (const cell of boss.cells) {
      if (cell.dead) continue;
      const rc = bossCellRect(cell);
      if (cell === boss.weak) {
        // The weak spot: a glowing brick.
        ctx.save();
        ctx.shadowColor = "#fff6a8"; ctx.shadowBlur = 14 * pulse;
        ctx.fillStyle = "#fff6a8"; ctx.globalAlpha = 0.75 + 0.25 * pulse;
        rrect(ctx, rc.x + 1.5, rc.y + 1.5, rc.w - 3, rc.h - 3, 3); ctx.fill();
        ctx.restore();
        star(ctx, rc.x + rc.w / 2, rc.y + rc.h / 2, rc.h * 0.4, "#c0392b");
      } else {
        drawBrick(ctx, rc.x, rc.y, rc.w, rc.h, { t: COLORS[cell.color] ? "n" : cell.color, color: cell.color, hp: cell.hp, max: cell.max });
        // The other places the weak spot can be are the monster's eyes (and mouth), looking at the paddle.
        if (cell.weakOK) {
          const look = Math.max(-1, Math.min(1, (R.pad.x - (rc.x + rc.w / 2)) / (F.w / 2)));
          ctx.fillStyle = "#263d30";
          ctx.beginPath(); ctx.arc(rc.x + rc.w / 2 + look * rc.w * 0.18, rc.y + rc.h * 0.58, rc.h * 0.27, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    if (boss.flash > R.t) {
      ctx.globalAlpha = 0.5; ctx.fillStyle = "#fff";
      for (const cell of boss.cells) if (!cell.dead) { const rc = bossCellRect(cell); ctx.fillRect(rc.x, rc.y, rc.w, rc.h); }
      ctx.globalAlpha = 1;
    }
    // Health bar along the top of the field.
    const bx = F.x + F.cw, bw = F.w - F.cw * 2, by = F.top + F.ch * 0.45, bh = F.ch * 0.6, gap = 3;
    const seg = (bw - gap * (boss.max - 1)) / boss.max;
    for (let k = 0; k < boss.max; k++) {
      ctx.fillStyle = k < boss.health ? "#f29a9a" : "rgba(242,240,230,.15)";
      rrect(ctx, bx + k * (seg + gap), by, seg, bh, 3); ctx.fill();
    }
  }

  function drawBall(ctx, b) {
    ctx.fillStyle = "#f2f0e6";
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(38,61,48,.5)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(b.x - b.r * 0.25, b.y - b.r * 0.25, b.r * 0.45, Math.PI, Math.PI * 1.6); ctx.stroke();
  }

  // Falling power-ups: a chalk pill with a little picture.
  function drawCap(ctx, k) {
    const p = POWERS[k.type], w = F.cw * 0.9, h = F.ch * 0.9, x = k.x, y = k.y;
    ctx.fillStyle = p.color; ctx.strokeStyle = "#263d30"; ctx.lineWidth = 1.5;
    rrect(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#263d30"; ctx.lineWidth = 1.8; ctx.lineCap = "round";
    const s = h * 0.32;
    ctx.beginPath();
    if (k.type === "multi") { for (const dx of [-s * 1.3, 0, s * 1.3]) { ctx.moveTo(x + dx + s * 0.45, y); ctx.arc(x + dx, y, s * 0.45, 0, Math.PI * 2); } ctx.fill(); }
    else if (k.type === "wide") { ctx.moveTo(x - s * 1.8, y); ctx.lineTo(x + s * 1.8, y); ctx.moveTo(x - s, y - s * 0.7); ctx.lineTo(x - s * 1.8, y); ctx.lineTo(x - s, y + s * 0.7); ctx.moveTo(x + s, y - s * 0.7); ctx.lineTo(x + s * 1.8, y); ctx.lineTo(x + s, y + s * 0.7); ctx.stroke(); }
    else if (k.type === "laser") { ctx.moveTo(x + s * 0.5, y - s * 1.2); ctx.lineTo(x - s * 0.4, y + s * 0.1); ctx.lineTo(x + s * 0.4, y - s * 0.1); ctx.lineTo(x - s * 0.5, y + s * 1.2); ctx.stroke(); }
    else if (k.type === "sticky") { ctx.moveTo(x - s * 1.5, y - s * 0.6); ctx.lineTo(x + s * 1.5, y - s * 0.6); ctx.moveTo(x - s * 0.7, y - s * 0.6); ctx.lineTo(x - s * 0.7, y + s * 0.5); ctx.moveTo(x + s * 0.5, y - s * 0.6); ctx.lineTo(x + s * 0.5, y + s * 0.9); ctx.stroke(); }
    else if (k.type === "slow") { ctx.arc(x, y, s, 0, Math.PI * 2); ctx.moveTo(x, y); ctx.lineTo(x, y - s * 0.7); ctx.moveTo(x, y); ctx.lineTo(x + s * 0.5, y); ctx.stroke(); }
    else { ctx.moveTo(x, y + s); ctx.bezierCurveTo(x - s * 2, y - s * 0.4, x - s * 0.6, y - s * 1.6, x, y - s * 0.5); ctx.bezierCurveTo(x + s * 0.6, y - s * 1.6, x + s * 2, y - s * 0.4, x, y + s); ctx.fill(); }
  }

  function drawPaddle(ctx) {
    const w = padW(), h = F.padH, x = R.pad.x - w / 2, y = F.padY;
    const theme = A.getTheme(R.themeId);
    ctx.save();
    if (R.daze > R.t) ctx.globalAlpha = 0.45 + 0.2 * Math.sin(R.t * 20);
    ctx.fillStyle = "#f2f0e6";
    rrect(ctx, x, y, w, h, h / 2); ctx.fill();
    // A stripe in the picture theme's color.
    ctx.strokeStyle = (theme && theme.accent) || ACCENT; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x + h / 2, y + h / 2); ctx.lineTo(x + w - h / 2, y + h / 2); ctx.stroke();
    if (R.effects.laser > R.t) {
      ctx.fillStyle = "#ff8a65";
      for (const sgn of [-1, 1]) ctx.fillRect(R.pad.x + sgn * w * 0.4 - 3, y - 6, 6, 8);
    }
    if (R.effects.sticky > R.t) {
      ctx.fillStyle = POWERS.sticky.color;
      for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(x + w * (0.15 + k * 0.175), y + 1, 2.5, 0, Math.PI * 2); ctx.fill(); }
    }
    // Small timers for the power-ups that wear off, in a row under the paddle.
    const on = ["wide", "laser", "sticky", "slow"].filter(eff => R.effects[eff] > R.t);
    on.forEach((eff, k) => {
      const left = R.effects[eff] - R.t;
      const cx = R.pad.x + (k - (on.length - 1) / 2) * 17, cy = y + h + 10;
      ctx.strokeStyle = POWERS[eff].color; ctx.lineWidth = 3; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(cx, cy, 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, left / POWERS[eff].time)); ctx.stroke();
    });
    ctx.restore();
  }

  /* ---------- Register with the arcade ---------- */
  A.registerGame({
    id: ID,
    name: "Brick Bash",
    accent: ACCENT,
    twists: TWISTS,
    icon: `<rect x="6" y="7" width="10" height="6" rx="1"/><rect class="acc" x="19" y="7" width="10" height="6" rx="1"/><rect x="32" y="7" width="10" height="6" rx="1"/>
    <rect class="acc" x="12" y="16" width="10" height="6" rx="1"/><rect x="25" y="16" width="10" height="6" rx="1"/>
    <circle cx="22" cy="31" r="2.6"/><path d="M15 41 H33"/>`,
    open: showMenu,
    _round: () => R, // read-only peek at the run in progress, for testing
    badge: () => (todayTwist() ? "Daily twist" : null),
    tileStat(playerId) {
      const best = Act.scores.bestAny(ID, playerId), lv = progress[playerId];
      if (!best && !lv) return null;
      return `Level ${lv || 1}` + (best ? ` · Best ${best}` : "");
    },
    resetStats() {
      Act.scores.reset(ID);
      progress = {}; saveProgress();
      for (const lv of custom) lv.best = null;
      saveCustom();
    },
    forgetPlayer(id) {
      Act.scores.forgetPlayer(ID, id);
      delete progress[id]; delete prefs[id];
      saveProgress(); savePrefs();
      for (const lv of custom) if (lv.best && lv.best.id === id) lv.best = null;
      saveCustom();
    }
  });
})();

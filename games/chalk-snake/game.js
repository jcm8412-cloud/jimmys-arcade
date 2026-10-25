/* Chalk Snake: classic Snake with power-up foods, the daily twist, and a 2-player battle mode played
   with the phone flat between the players. Built on the shared action kit (Arcade.Action).
   Saved data: high scores via Arcade.Action.scores; chalk-snake:battle {playerId: wins};
   chalk-snake:prefs {pad: {level: bool}, battleLevel, battleLen}. Guests aren't recorded. */
(function () {
  const A = window.Arcade, Act = A.Action;
  const $ = id => document.getElementById(id);
  const esc = A.esc;
  const ID = "chalk-snake";
  const ACCENT = "#c6f26b";

  const LEVELS = {
    easy: { name: "Easy", desc: "Slow, walls wrap around, 3 lives", interval: 0.19, wrap: true, start: 3, lives: 3, time: 120 },
    medium: { name: "Medium", desc: "Normal speed, solid walls, 2 lives", interval: 0.135, wrap: false, start: 4, lives: 2, time: 120 },
    hard: { name: "Hard", desc: "Faster, one life", interval: 0.1, wrap: false, start: 4, lives: 1, time: 0 },
    impossible: { name: "Impossible", desc: "Fast, and faster as you grow", interval: 0.085, wrap: false, start: 5, lives: 1, time: 0, speedUp: true }
  };
  const TWISTS = ["Runaway apples", "Shrinking board", "Speedy apples", "Portals"];
  const SPECIALS = [["golden", 30], ["chili", 25], ["ghost", 25], ["scissors", 20]];
  const EFFECT_TIME = 5;      // seconds for golden slow-down, chili and ghost pepper
  const SPECIAL_LIFE = 6;     // a special food disappears after this long
  const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
  const FLIP = { up: "down", down: "up", left: "right", right: "left" };
  const P_COLORS = ["#f3d36b", "#9fd3e8"];

  /* ---------- Preferences ---------- */
  const prefs = Object.assign({ pad: { easy: true, medium: false, hard: false, impossible: false }, battleLevel: "medium", battleLen: 3 },
    A.store.get("chalk-snake:prefs", {}));
  const savePrefs = () => A.store.set("chalk-snake:prefs", prefs);
  let battleWins = A.store.get("chalk-snake:battle", {});
  const saveBattle = () => A.store.set("chalk-snake:battle", battleWins);

  /* ---------- Menu screens ---------- */
  const home = `<button class="icon-btn" data-home aria-label="Home"></button>`;
  const back = `<button class="back-link" data-cs-back>‹ Chalk Snake</button>`;
  const seg = (id, items) => `<div class="seg" role="radiogroup" id="${id}">${items.map(([v, label]) => `<button type="button" role="radio" data-v="${v}">${label}</button>`).join("")}</div>`;
  const levelSeg = id => seg(id, Object.entries(LEVELS).map(([k, l]) => [k, l.name]));
  $("game-root").insertAdjacentHTML("beforeend", `
  <section class="screen cs menu" id="cs-menu" hidden>
    <header class="topbar"><div class="tb-left">${home}</div><h2></h2><div class="tb-right"></div></header>
    <h1 class="title">Chalk <span>Snake</span></h1>
    <p class="tagline">Eat, grow, and don't bump into anything!</p>
    <div class="menu-buttons">
      <button class="btn big" id="cs-btn-play">Play</button>
      <button class="btn big daily" id="cs-btn-daily" hidden></button>
      <button class="btn big" id="cs-btn-battle">Battle (2 players)</button>
      <button class="btn ghost" id="cs-btn-top">Top scores</button>
    </div>
    <p class="note center-text" id="cs-menu-best"></p>
  </section>

  <section class="screen cs" id="cs-levels" hidden>
    <header class="topbar"><div class="tb-left">${home}${back}</div><h2>Pick a level</h2><div class="tb-right"></div></header>
    <div class="playing-as" id="cs-playing-as"></div>
    <div class="levels" id="cs-level-list"></div>
  </section>

  <section class="screen cs" id="cs-setup" hidden>
    <header class="topbar"><div class="tb-left">${home}${back}</div><h2>Battle</h2><div class="tb-right"></div></header>
    <p class="note">Lay the phone flat between you. Each player swipes on their own half.</p>
    <h3 class="label">Pick two players</h3>
    <div id="cs-picker"></div>
    <h3 class="label">Speed and walls</h3>${levelSeg("cs-battle-level")}
    <h3 class="label">Match</h3>${seg("cs-battle-len", [["3", "Best of 3"], ["5", "Best of 5"]])}
    <p class="err" id="cs-setup-err" aria-live="polite"></p>
    <button class="btn big" id="cs-start">Start battle</button>
  </section>

  <section class="screen cs" id="cs-top" hidden>
    <header class="topbar"><div class="tb-left">${home}${back}</div><h2>Top scores</h2><div class="tb-right"></div></header>
    ${seg("cs-top-level", Object.entries(LEVELS).map(([k, l]) => [k, l.name]).concat([["daily", "Today"]]))}
    <div id="cs-top-list"></div>
  </section>`);

  // The game screen comes from the shared action kit.
  const scr = Act.createScreen({
    id: "cs-play", cls: "cs",
    onRestart: () => restart(),
    onQuit: () => A.goHome(),
    onResize: (w, h) => { if (R) fitGrid(w, h); }
  });
  scr.controls.innerHTML = `<div class="pad" id="cs-pad">
    <button type="button" data-dir="up" aria-label="Up">▲</button><button type="button" data-dir="left" aria-label="Left">◀</button>
    <button type="button" data-dir="down" aria-label="Down">▼</button><button type="button" data-dir="right" aria-label="Right">▶</button></div>`;

  function paintSeg(id, value) {
    $(id).querySelectorAll("button").forEach(b => b.setAttribute("aria-checked", String(b.dataset.v === String(value))));
  }
  function bindSeg(id, onPick) {
    $(id).querySelectorAll("button").forEach(b => b.addEventListener("click", () => { onPick(b.dataset.v); paintSeg(id, b.dataset.v); }));
  }

  /* ---------- Menu ---------- */
  const todayTwist = () => { const d = Act.daily(); return d && d.gameId === ID ? d : null; };
  function showMenu() {
    A.setAccent(ACCENT);
    const d = todayTwist();
    $("cs-btn-daily").hidden = !d;
    if (d) $("cs-btn-daily").innerHTML = `Daily twist<small>${esc(d.name)}</small>`;
    const p = A.players.get(A.lastPlayerId());
    const best = p ? Act.scores.bestAny(ID, p.id) : 0;
    $("cs-menu-best").textContent = p && best ? `${p.name}'s best: ${best}` : "";
    A.show("cs-menu");
  }
  document.querySelectorAll("[data-cs-back]").forEach(b => b.addEventListener("click", showMenu));
  $("cs-btn-play").addEventListener("click", () => A.whoIsPlaying({ onDone: showLevels, onBack: showMenu, backLabel: "Chalk Snake" }));
  $("cs-btn-daily").addEventListener("click", () => A.whoIsPlaying({
    onDone: p => startSolo({ mode: "daily", level: "medium", player: p, twist: todayTwist() }), onBack: showMenu, backLabel: "Chalk Snake"
  }));
  $("cs-btn-battle").addEventListener("click", showSetup);
  $("cs-btn-top").addEventListener("click", () => showTop("easy"));

  function showLevels() {
    const p = A.session.player;
    $("cs-playing-as").innerHTML = `${A.avatarSvg(p)}<span>Playing: <b>${esc(p.name)}</b></span>
      <button class="btn ghost" id="cs-switch">Switch</button>`;
    $("cs-switch").addEventListener("click", () =>
      A.whoIsPlaying({ force: true, onDone: showLevels, onBack: showLevels, backLabel: "Levels" }));
    const box = $("cs-level-list");
    box.innerHTML = "";
    for (const [id, lv] of Object.entries(LEVELS)) {
      const best = Act.scores.best(ID, id, p.id);
      const card = document.createElement("div");
      card.className = "level-card" + (id === "impossible" ? " impossible" : "");
      card.innerHTML = `<button class="level" type="button"><b>${lv.name}</b><small>${lv.desc}</small>
          <span class="best">${p.id ? `Best<br><span>${best}</span>` : ""}</span></button>
        <button class="pad-chip" type="button" aria-pressed="${prefs.pad[id]}">Arrow pad: ${prefs.pad[id] ? "on" : "off"}</button>`;
      card.querySelector(".level").addEventListener("click", () => startSolo({ mode: "solo", level: id, player: p }));
      card.querySelector(".pad-chip").addEventListener("click", e => {
        prefs.pad[id] = !prefs.pad[id];
        savePrefs();
        e.currentTarget.setAttribute("aria-pressed", String(prefs.pad[id]));
        e.currentTarget.textContent = `Arrow pad: ${prefs.pad[id] ? "on" : "off"}`;
      });
      box.appendChild(card);
    }
    A.setAccent(ACCENT);
    A.show("cs-levels");
  }

  let picker = null;
  function showSetup() {
    A.setAccent(ACCENT);
    $("cs-setup-err").textContent = "";
    picker = A.playerPicker($("cs-picker"), { min: 2, max: 2, initial: A.store.get("chalk-snake:lastSetup", []), onChange: () => { $("cs-setup-err").textContent = ""; } });
    paintSeg("cs-battle-level", prefs.battleLevel);
    paintSeg("cs-battle-len", prefs.battleLen);
    A.show("cs-setup");
  }
  bindSeg("cs-battle-level", v => { prefs.battleLevel = v; savePrefs(); });
  bindSeg("cs-battle-len", v => { prefs.battleLen = +v; savePrefs(); });
  $("cs-start").addEventListener("click", () => {
    if (picker.count() < 2) { $("cs-setup-err").textContent = "Pick two players."; return; }
    A.store.set("chalk-snake:lastSetup", picker.entries());
    startBattle(picker.get());
  });

  function showTop(level) {
    paintSeg("cs-top-level", level);
    const list = level === "daily" ? Act.scores.dailyTop(ID) : Act.scores.top(ID, level);
    const d = todayTwist();
    $("cs-top-list").innerHTML = (level === "daily" ? `<p class="note">${d ? `Today's twist: ${esc(d.name)}` : "Chalk Snake isn't today's daily twist."}</p>` : "")
      + Act.topListHtml(list, -1);
    A.setAccent(ACCENT);
    A.show("cs-top");
  }
  bindSeg("cs-top-level", v => showTop(v));

  /* ---------- Rounds ----------
     R: { mode ("solo" | "daily" | "battle"), level, cfg, cols, rows, cell, ox, oy, bounds, snakes, foods,
          t (game seconds), score, lives, timeLeft, nextSpecial, themeId, twist, portals, nextShrink,
          players, wins, len (battle) } */
  let R = null;
  let lastStart = null; // how to restart the same kind of round
  const dustFx = Act.dust(50);
  const popups = [];

  function startSolo({ mode, level, player, twist }) {
    lastStart = () => startSolo({ mode, level, player, twist });
    const cfg = LEVELS[level];
    R = {
      mode, level, cfg, player, twist: twist ? twist.twist : -1, twistName: twist ? twist.name : "",
      score: 0, lives: cfg.lives, timeLeft: cfg.time, t: 0, foods: [], portals: [],
      themeId: A.resolveTheme(A.settings.theme)
    };
    A.noteThemeUsed(R.themeId);
    beginRound();
  }

  function startBattle(players) {
    const level = prefs.battleLevel;
    lastStart = () => startBattle(players);
    R = {
      mode: "battle", level, cfg: LEVELS[level], players, wins: [0, 0], len: prefs.battleLen,
      t: 0, foods: [], portals: [], twist: -1, themeId: A.resolveTheme(A.settings.theme)
    };
    A.noteThemeUsed(R.themeId);
    beginRound();
  }

  function restart() { if (lastStart) lastStart(); }

  // Lay out the grid for the stage size, then start (or restart) a round.
  function beginRound() {
    A.setAccent(ACCENT);
    $("cs-pad").hidden = !(R.mode !== "battle" && prefs.pad[R.level]);
    scr.section.classList.toggle("battle", R.mode === "battle");
    scr.show();
    requestAnimationFrame(() => {
      setupBoard();
      scr.start(update, render);
    });
  }

  function setupBoard() {
    const { w, h } = scr.size;
    const cols = Math.max(14, Math.min(26, Math.round(w / 24)));
    const cell = Math.floor(w / cols);
    let rows = Math.max(12, Math.floor(h / cell));
    if (R.mode === "battle" && rows % 2) rows--;
    Object.assign(R, { cols, rows, t: 0, foods: [], portals: [], nextSpecial: 7 + Math.random() * 5, nextShrink: 15 });
    R.bounds = { x0: 0, y0: 0, x1: cols - 1, y1: rows - 1 };
    fitGrid(w, h);
    if (R.mode === "battle") {
      R.snakes = [
        makeSnake(0, Math.floor(cols / 2), rows - 3, "up"),
        makeSnake(1, Math.floor(cols / 2) - 1, 2, "down")
      ];
    } else {
      R.snakes = [makeSnake(0, Math.floor(cols / 2), Math.floor(rows * 0.65), "up")];
    }
    if (R.twist === 3) placePortals();
    spawnFood("apple");
    dustFx.clear();
    popups.length = 0;
    updateHud();
  }

  function fitGrid(w, h) {
    R.cell = Math.floor(Math.min(w / R.cols, h / R.rows));
    R.ox = Math.floor((w - R.cell * R.cols) / 2);
    R.oy = Math.floor((h - R.cell * R.rows) / 2);
  }

  function makeSnake(player, x, y, dir) {
    const d = DIRS[dir], body = [];
    for (let i = 0; i < R.cfg.start; i++) body.push({ x: x - d.x * i, y: y - d.y * i });
    return { player, body, prev: body.map(c => ({ ...c })), dir, queue: [], grow: 0, alive: true, timer: 0, effects: { slow: 0, chili: 0, ghost: 0 }, speedMult: 1, moves: 0 };
  }

  /* ---------- Input ---------- */
  function turn(snake, dir) {
    if (!snake || !snake.alive || !scr.running) return;
    const last = snake.queue.length ? snake.queue[snake.queue.length - 1] : snake.dir;
    if (dir === last || (dir === FLIP[last] && snake.body.length > 1)) return; // never straight back into yourself
    if (snake.queue.length < 2) snake.queue.push(dir);
  }
  // Swipes are read on the canvas, not the whole stage, so buttons over it (Paused, end-of-round panels) still get their clicks.
  Act.swipes(scr.canvas, {
    onSwipe(dir, info) {
      if (!R) return;
      if (R.mode === "battle") {
        // Top half belongs to the far player: their swipes are read from their side of the table.
        if (info.y < scr.size.h / 2) turn(R.snakes[1], FLIP[dir]); else turn(R.snakes[0], dir);
      } else turn(R.snakes[0], dir);
    }
  });
  $("cs-pad").addEventListener("pointerdown", e => {
    const b = e.target.closest("[data-dir]");
    if (b && R) { e.preventDefault(); turn(R.snakes[0], b.dataset.dir); }
  });
  const KEYS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
  const WASD = { w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right" };
  document.addEventListener("keydown", e => {
    if (A.currentScreen !== "cs-play" || !R || A.dialogOpen()) return;
    if (e.key === " ") { e.preventDefault(); if (scr.running) scr.pause(); else if (scr.active) scr.resume(); return; }
    if (KEYS[e.key]) { e.preventDefault(); turn(R.snakes[0], KEYS[e.key]); }
    else if (WASD[e.key]) { e.preventDefault(); turn(R.mode === "battle" ? R.snakes[1] : R.snakes[0], WASD[e.key]); }
  });

  /* ---------- Rules ---------- */
  const inBounds = (x, y) => x >= R.bounds.x0 && x <= R.bounds.x1 && y >= R.bounds.y0 && y <= R.bounds.y1;
  const occupied = (x, y) => R.snakes.some(s => s.body.some(c => c.x === x && c.y === y))
    || R.foods.some(f => f.x === x && f.y === y) || R.portals.some(p => p.x === x && p.y === y);
  function freeCell(awayFrom) {
    for (let tries = 0; tries < 400; tries++) {
      const x = R.bounds.x0 + Math.floor(Math.random() * (R.bounds.x1 - R.bounds.x0 + 1));
      const y = R.bounds.y0 + Math.floor(Math.random() * (R.bounds.y1 - R.bounds.y0 + 1));
      if (occupied(x, y)) continue;
      if (awayFrom && R.snakes.some(s => s.alive && Math.abs(s.body[0].x - x) + Math.abs(s.body[0].y - y) < awayFrom)) continue;
      return { x, y };
    }
    return null;
  }
  function spawnFood(type) {
    const c = freeCell(type === "apple" ? 0 : 3);
    if (c) R.foods.push({ type, x: c.x, y: c.y, until: type === "apple" ? Infinity : R.t + SPECIAL_LIFE, born: R.t });
  }
  function pickSpecial() {
    const total = SPECIALS.reduce((n, [, w]) => n + w, 0);
    let r = Math.random() * total;
    for (const [type, w] of SPECIALS) { if ((r -= w) < 0) return type; }
    return "golden";
  }
  // Portals: two linked pairs. Entering one comes out of its partner.
  function placePortals() {
    R.portals = [];
    for (const color of ["#9fd3e8", "#f29a9a"]) {
      const a = freeCell(4);
      if (!a) continue;
      const first = { x: a.x, y: a.y, color };
      R.portals.push(first);
      const b = freeCell(4);
      if (!b) { R.portals.pop(); continue; }
      const second = { x: b.x, y: b.y, color };
      R.portals.push(second);
      first.pair = R.portals.length - 1;
      second.pair = R.portals.length - 2;
    }
  }

  function interval(s) {
    let v = R.cfg.interval;
    if (R.cfg.speedUp) v *= Math.max(0.55, 1 - 0.012 * (s.body.length - R.cfg.start));
    v *= s.speedMult;
    if (s.effects.slow > R.t) v *= 1.6;
    if (s.effects.chili > R.t) v *= 0.6;
    return v;
  }

  function update(dt) {
    R.t += dt;
    if (R.mode !== "battle" && R.cfg.time) {
      R.timeLeft -= dt;
      if (R.timeLeft <= 0) { R.timeLeft = 0; endSolo("Time's up!"); return; }
    }
    // Special foods come and go.
    R.foods = R.foods.filter(f => f.until > R.t);
    if (!R.foods.some(f => f.type !== "apple") && R.t >= R.nextSpecial) {
      spawnFood(pickSpecial());
      R.nextSpecial = R.t + SPECIAL_LIFE + 7 + Math.random() * 5;
    }
    if (!R.foods.some(f => f.type === "apple")) spawnFood("apple");
    if (R.twist === 1 && R.t >= R.nextShrink) shrinkBoard();

    for (const s of R.snakes) {
      if (!s.alive) continue;
      s.timer += dt;
      const iv = interval(s);
      if (s.timer >= iv) {
        s.timer -= iv;
        step(s);
        if (!R || scr.running === false) return;
      }
    }
    if (R.mode === "battle") checkBattle();
    dustFx.update(dt);
    for (let i = popups.length - 1; i >= 0; i--) if ((popups[i].age += dt) > 0.9) popups.splice(i, 1);
    updateHud();
  }

  function step(s) {
    s.prev = s.body.map(c => ({ ...c }));
    if (s.queue.length) s.dir = s.queue.shift();
    const d = DIRS[s.dir];
    let x = s.body[0].x + d.x, y = s.body[0].y + d.y;
    if (!inBounds(x, y)) {
      if (!R.cfg.wrap) return crash(s);
      const b = R.bounds;
      if (x < b.x0) x = b.x1; else if (x > b.x1) x = b.x0;
      if (y < b.y0) y = b.y1; else if (y > b.y1) y = b.y0;
    }
    const portal = R.portals.find(p => p.x === x && p.y === y);
    if (portal && portal.pair != null) { const o = R.portals[portal.pair]; x = o.x; y = o.y; s.prev = s.body.map(c => ({ ...c })); }
    const tailMoves = s.grow === 0;
    // Hitting yourself (unless the ghost pepper is working) or the other snake.
    const ghost = s.effects.ghost > R.t;
    for (const o of R.snakes) {
      if (!o.alive && o !== s) continue;
      const body = o === s && tailMoves ? o.body.slice(0, -1) : o.body;
      if (o === s && ghost) continue;
      if (body.some(c => c.x === x && c.y === y)) return crash(s);
    }
    s.body.unshift({ x, y });
    if (s.grow > 0) s.grow--; else s.body.pop();
    s.moves++;
    const fi = R.foods.findIndex(f => f.x === x && f.y === y);
    if (fi >= 0) eat(s, R.foods.splice(fi, 1)[0]);
    if (s.effects.chili > R.t) {
      const c = cellCenter(s.body[s.body.length - 1]);
      dustFx.emit(c.x, c.y, "#f2f0e6", 2);
    }
    if (R.twist === 0 && s.moves % 2 === 0) runAway(s);
  }

  function eat(s, f) {
    const double = s.effects.chili > R.t ? 2 : 1;
    const at = cellCenter(f);
    let text = "";
    if (f.type === "apple") {
      s.grow += 1;
      addScore(1 * double);
      text = double > 1 ? "+2" : "+1";
      if (R.twist === 2) s.speedMult = Math.max(0.45, s.speedMult * 0.95);
    } else if (f.type === "golden") {
      addScore(5 * double);
      s.effects.slow = R.t + EFFECT_TIME;
      text = `+${5 * double} Slow-mo!`;
    } else if (f.type === "chili") {
      s.effects.chili = R.t + EFFECT_TIME;
      text = "Speed! x2";
    } else if (f.type === "ghost") {
      s.effects.ghost = R.t + EFFECT_TIME;
      text = "Ghost!";
    } else if (f.type === "scissors") {
      const keep = Math.max(2, s.body.length - 3);
      s.body.length = keep;
      s.grow = 0;
      text = "Snip!";
    }
    popups.push({ x: at.x, y: at.y, text, age: 0 });
    dustFx.emit(at.x, at.y, "#f3d36b", 6);
    A.sfx.right();
  }
  const addScore = n => { if (R.mode !== "battle") R.score += n; };

  // Runaway apples: the apple hops one cell away from a nearby snake head.
  function runAway(s) {
    const apple = R.foods.find(f => f.type === "apple");
    if (!apple) return;
    const h = s.body[0];
    const dist = (x, y) => Math.abs(x - h.x) + Math.abs(y - h.y);
    if (dist(apple.x, apple.y) > 6) return;
    let best = null;
    for (const d of Object.values(DIRS)) {
      const x = apple.x + d.x, y = apple.y + d.y;
      if (!inBounds(x, y) || occupied(x, y)) continue;
      if (dist(x, y) > dist(apple.x, apple.y) && (!best || dist(x, y) > dist(best.x, best.y))) best = { x, y };
    }
    if (best) { apple.x = best.x; apple.y = best.y; }
  }

  // Shrinking board: every 15 seconds the walls move in one ring (waiting while something is in the way).
  function shrinkBoard() {
    const b = R.bounds;
    if (b.x1 - b.x0 < 9 || b.y1 - b.y0 < 9) { R.nextShrink = Infinity; return; }
    const ring = (x, y) => x === b.x0 || x === b.x1 || y === b.y0 || y === b.y1;
    if (R.snakes.some(s => s.body.some(c => ring(c.x, c.y)))) { R.nextShrink = R.t + 1; return; }
    R.bounds = { x0: b.x0 + 1, y0: b.y0 + 1, x1: b.x1 - 1, y1: b.y1 - 1 };
    R.foods = R.foods.filter(f => !ring(f.x, f.y));
    R.portals = R.portals.filter(p => !ring(p.x, p.y));
    R.nextShrink = R.t + 15;
    scr.message("Squeeze!", 800);
  }

  function crash(s) {
    A.buzz();
    A.sfx.lose();
    const c = cellCenter(s.body[0]);
    dustFx.emit(c.x, c.y, "#f29a9a", 12);
    if (R.mode === "battle") { s.alive = false; return; }
    R.lives--;
    updateHud();
    if (R.lives <= 0) { endSolo("Game over!"); return; }
    scr.message("Ouch!", 900);
    const fresh = makeSnake(0, Math.floor(R.cols / 2), Math.floor(R.rows * 0.65), "up");
    scr.hold(1000, () => {
      R.snakes[0] = fresh;
      // Move anything sitting where the new snake appears.
      R.foods = R.foods.filter(f => !fresh.body.some(c => c.x === f.x && c.y === f.y));
    });
  }

  /* ---------- Battle ---------- */
  function checkBattle() {
    const [a, b] = R.snakes;
    if (a.alive && b.alive && a.body[0].x === b.body[0].x && a.body[0].y === b.body[0].y) { a.alive = b.alive = false; }
    const alive = R.snakes.filter(s => s.alive);
    if (alive.length > 1) return;
    scr.stop();
    const name = i => R.players[i].name;
    if (!alive.length) {
      scr.showPanel({
        split: { top: `<h2>Draw!</h2><p>Both snakes crashed.</p>`, bottom: `<h2>Draw!</h2><p>Both snakes crashed.</p>` },
        buttons: [{ label: "Replay round", cls: "big", run: () => beginRound() }]
      });
      return;
    }
    const w = alive[0].player;
    R.wins[w]++;
    const need = Math.floor(R.len / 2) + 1;
    const score = i => `${R.wins[i]} – ${R.wins[1 - i]}`;
    if (R.wins[w] >= need) {
      const winner = R.players[w];
      if (winner.id) { battleWins[winner.id] = (battleWins[winner.id] || 0) + 1; saveBattle(); }
      A.sfx.win();
      const line = i => (i === w ? `<h2>You win!</h2><p>${score(i)}</p>` : `<h2>${esc(name(w))} wins</h2><p>${score(i)}</p>`);
      scr.showPanel({
        split: { top: line(1), bottom: line(0) },
        buttons: [{ label: "Play again", cls: "big", run: () => startBattle(R.players) }, { label: "Menu", cls: "ghost", run: showMenu }]
      });
    } else {
      const line = i => (i === w ? `<h2>Round to you!</h2><p>${score(i)}</p>` : `<h2>Round to ${esc(name(w))}</h2><p>${score(i)}</p>`);
      scr.showPanel({ split: { top: line(1), bottom: line(0) }, buttons: [{ label: "Next round", cls: "big", run: () => beginRound() }] });
    }
  }

  /* ---------- End of a solo round ---------- */
  function endSolo(title) {
    scr.stop();
    const daily = R.mode === "daily";
    const res = Act.scores.submit(ID, R.level, R.player, R.score, { daily });
    if (res.newBest) { scr.burst("New best!"); A.sfx.win(); }
    const list = daily ? Act.scores.dailyTop(ID) : Act.scores.top(ID, R.level);
    const bestLine = R.player.id && !daily ? `<p class="note">Your best on ${LEVELS[R.level].name}: <b>${res.best}</b></p>` : "";
    setTimeout(() => {
      if (A.currentScreen !== "cs-play") return;
      scr.showPanel({
        html: `<h2>${title}</h2>
          ${daily ? `<p class="note">Daily twist: ${esc(R.twistName)}</p>` : ""}
          <p class="big-score">${R.score}</p>${bestLine}
          <h3 class="label">${daily ? "Today's top 5" : `Top 5 on ${LEVELS[R.level].name}`}</h3>
          ${Act.topListHtml(list, res.rank)}`,
        buttons: [{ label: "Play again", cls: "big", run: () => restart() }, { label: "Menu", cls: "ghost", run: () => (daily ? showMenu() : showLevels()) }]
      });
    }, res.newBest ? 900 : 300);
  }

  /* ---------- HUD ---------- */
  let hudText = "";
  function updateHud() {
    let html;
    if (R.mode === "battle") html = `<span>First to ${Math.floor(R.len / 2) + 1}</span>`;
    else {
      const lives = `<span class="lives" aria-label="${R.lives} lives">${"♥".repeat(Math.max(0, R.lives))}<span class="gone">${"♥".repeat(R.cfg.lives - Math.max(0, R.lives))}</span></span>`;
      const secs = Math.ceil(R.timeLeft);
      const time = R.cfg.time ? `<span>${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}</span>` : "";
      html = `<b>${R.score}</b>${lives}${time}${R.mode === "daily" ? `<span class="twist">${esc(R.twistName)}</span>` : ""}`;
    }
    if (html !== hudText) { scr.hud.innerHTML = html; hudText = html; }
  }

  /* ---------- Drawing ---------- */
  const cellCenter = c => ({ x: R.ox + (c.x + 0.5) * R.cell, y: R.oy + (c.y + 0.5) * R.cell });
  const FONT = px => `${px}px "Gochi Hand", "Comic Sans MS", cursive`;

  function render(alpha) {
    const ctx = scr.ctx, { w, h } = scr.size;
    if (!R || !R.snakes) return;
    ctx.clearRect(0, 0, w, h);
    const cs = R.cell, b = R.bounds;
    // Walls (and the area the shrinking board has taken).
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.fillRect(R.ox, R.oy, R.cols * cs, R.rows * cs);
    ctx.fillStyle = "rgba(47,74,58,.9)";
    ctx.fillRect(R.ox + b.x0 * cs, R.oy + b.y0 * cs, (b.x1 - b.x0 + 1) * cs, (b.y1 - b.y0 + 1) * cs);
    ctx.save();
    ctx.setLineDash(R.cfg.wrap ? [6, 8] : []);
    ctx.strokeStyle = R.cfg.wrap ? "rgba(242,240,230,.35)" : "rgba(242,240,230,.8)";
    ctx.lineWidth = 3;
    ctx.strokeRect(R.ox + b.x0 * cs + 1.5, R.oy + b.y0 * cs + 1.5, (b.x1 - b.x0 + 1) * cs - 3, (b.y1 - b.y0 + 1) * cs - 3);
    ctx.restore();
    if (R.mode === "battle") {
      ctx.save();
      ctx.setLineDash([4, 10]);
      ctx.strokeStyle = "rgba(242,240,230,.15)";
      ctx.beginPath(); ctx.moveTo(R.ox, R.oy + R.rows * cs / 2); ctx.lineTo(R.ox + R.cols * cs, R.oy + R.rows * cs / 2); ctx.stroke();
      ctx.restore();
    }
    for (const p of R.portals) drawPortal(ctx, p);
    for (const f of R.foods) drawFood(ctx, f);
    const theme = R.themeId;
    for (const s of R.snakes) drawSnake(ctx, s, alpha, theme);
    dustFx.draw(ctx);
    // Little "+1" style pop-ups.
    ctx.textAlign = "center";
    for (const p of popups) {
      ctx.globalAlpha = 1 - p.age / 0.9;
      ctx.fillStyle = "#f3d36b";
      ctx.font = FONT(Math.round(cs * 0.8));
      ctx.fillText(p.text, p.x, p.y - cs * 0.6 - p.age * 30);
    }
    ctx.globalAlpha = 1;
    if (R.mode === "battle") drawBattleScores(ctx);
  }

  function drawBattleScores(ctx) {
    const { w, h } = scr.size;
    ctx.save();
    ctx.font = FONT(26);
    ctx.textAlign = "left";
    for (const i of [0, 1]) {
      ctx.save();
      if (i === 1) { ctx.translate(w, h); ctx.rotate(Math.PI); } // faces the far player
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = P_COLORS[i];
      ctx.fillText(`${R.players[i].name}: ${R.wins[i]}`, 10, h - 12);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawPortal(ctx, p) {
    const c = cellCenter(p), r = R.cell * 0.42;
    ctx.save();
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 3;
    for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.arc(c.x, c.y, r * (1 - k * 0.45), R.t * 3 + k, R.t * 3 + k + Math.PI * 1.5); ctx.stroke(); }
    ctx.restore();
  }

  function drawFood(ctx, f) {
    const c = cellCenter(f), r = R.cell * 0.4;
    ctx.save();
    if (f.until !== Infinity && f.until - R.t < 1.5 && Math.floor(R.t * 8) % 2) ctx.globalAlpha = 0.35; // about to vanish
    ctx.lineWidth = Math.max(2, R.cell * 0.09);
    ctx.lineCap = ctx.lineJoin = "round";
    switch (f.type) {
      case "apple":
      case "golden": {
        const gold = f.type === "golden";
        ctx.fillStyle = gold ? "#f3d36b" : "#f07a6a";
        ctx.beginPath(); ctx.arc(c.x, c.y + r * 0.1, r * 0.85, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#8a5a34"; ctx.beginPath(); ctx.moveTo(c.x, c.y - r * 0.6); ctx.lineTo(c.x + r * 0.15, c.y - r); ctx.stroke();
        ctx.fillStyle = "#b8e986"; ctx.beginPath(); ctx.ellipse(c.x + r * 0.4, c.y - r * 0.8, r * 0.3, r * 0.15, -0.5, 0, Math.PI * 2); ctx.fill();
        if (gold) {
          ctx.strokeStyle = "#fff6c8";
          const s = (Math.sin(R.t * 6) + 1) * 0.15 + 0.9;
          for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + R.t; ctx.beginPath(); ctx.moveTo(c.x + Math.cos(a) * r * 1.1, c.y + Math.sin(a) * r * 1.1); ctx.lineTo(c.x + Math.cos(a) * r * 1.35 * s, c.y + Math.sin(a) * r * 1.35 * s); ctx.stroke(); }
        }
        break;
      }
      case "chili":
      case "ghost": {
        ctx.fillStyle = f.type === "chili" ? "#ff5b4a" : "rgba(242,240,230,.85)";
        ctx.beginPath();
        ctx.moveTo(c.x - r * 0.6, c.y - r * 0.5);
        ctx.quadraticCurveTo(c.x + r * 1.1, c.y - r * 0.7, c.x + r * 0.5, c.y + r);
        ctx.quadraticCurveTo(c.x + r * 0.2, c.y + r * 0.2, c.x - r * 0.6, c.y - r * 0.1);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#b8e986"; ctx.beginPath(); ctx.moveTo(c.x - r * 0.6, c.y - r * 0.3); ctx.lineTo(c.x - r * 0.95, c.y - r * 0.75); ctx.stroke();
        if (f.type === "ghost") { ctx.fillStyle = "#263d30"; ctx.beginPath(); ctx.arc(c.x - r * 0.05, c.y - r * 0.2, r * 0.12, 0, Math.PI * 2); ctx.arc(c.x + r * 0.35, c.y - r * 0.25, r * 0.12, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      case "scissors": {
        ctx.strokeStyle = "#f2f0e6";
        ctx.beginPath(); ctx.moveTo(c.x - r * 0.8, c.y - r * 0.8); ctx.lineTo(c.x + r * 0.5, c.y + r * 0.3); ctx.moveTo(c.x + r * 0.8, c.y - r * 0.8); ctx.lineTo(c.x - r * 0.5, c.y + r * 0.3); ctx.stroke();
        ctx.strokeStyle = "#9fd3e8";
        ctx.beginPath(); ctx.arc(c.x - r * 0.55, c.y + r * 0.6, r * 0.3, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(c.x + r * 0.55, c.y + r * 0.6, r * 0.3, 0, Math.PI * 2); ctx.stroke();
        break;
      }
    }
    ctx.restore();
  }

  /* The snake's look comes from the picture theme (pumpkin-headed snake, snowball snake, and so on). */
  const BALLOON = ["#f29a9a", "#f3d36b", "#9fd3e8", "#b8e986", "#d7b4f3"];
  function drawSnake(ctx, s, alpha, theme) {
    const n = s.body.length, cs = R.cell;
    ctx.save();
    if (!s.alive) ctx.globalAlpha = 0.3;
    else if (s.effects.ghost > R.t) ctx.globalAlpha = 0.45 + 0.1 * Math.sin(R.t * 10);
    // Interpolate each segment from its last position (skip jumps from wrapping or portals).
    const pts = s.body.map((c, i) => {
      const p = s.prev[i] || c;
      const jump = Math.abs(p.x - c.x) + Math.abs(p.y - c.y) > 1;
      const k = jump ? 1 : alpha;
      return { x: R.ox + (p.x + (c.x - p.x) * k + 0.5) * cs, y: R.oy + (p.y + (c.y - p.y) * k + 0.5) * cs };
    });
    const r = cs * 0.45;
    const outline = R.mode === "battle" ? P_COLORS[s.player] : null;
    for (let i = n - 1; i >= 0; i--) {
      const p = pts[i], head = i === 0, sr = head ? r : r * (0.92 - 0.25 * (i / Math.max(1, n - 1)));
      if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, sr + 2.5, 0, Math.PI * 2); ctx.stroke(); }
      segment(ctx, theme, p.x, p.y, sr, i, head, DIRS[s.dir]);
    }
    ctx.restore();
  }

  function segment(ctx, theme, x, y, r, i, head, d) {
    const dot = (dx, dy, rr, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x + dx, y + dy, rr, 0, Math.PI * 2); ctx.fill(); };
    const eyes = color => { const ex = -d.y * r * 0.38, ey = d.x * r * 0.38, fx = d.x * r * 0.25, fy = d.y * r * 0.25; dot(fx + ex, fy + ey, r * 0.16, color); dot(fx - ex, fy - ey, r * 0.16, color); };
    ctx.lineWidth = Math.max(2, r * 0.18);
    switch (theme) {
      case "snowman":
        dot(0, 0, r, "#f2f0e6");
        if (!head && i % 2 === 1) dot(0, 0, r * 0.14, "#263d30");
        if (head) {
          eyes("#263d30");
          ctx.fillStyle = "#f2a65a";
          ctx.beginPath(); ctx.moveTo(x + d.x * r * 0.2 - d.y * r * 0.18, y + d.y * r * 0.2 + d.x * r * 0.18); ctx.lineTo(x + d.x * r * 1.4, y + d.y * r * 1.4); ctx.lineTo(x + d.x * r * 0.2 + d.y * r * 0.18, y + d.y * r * 0.2 - d.x * r * 0.18); ctx.fill();
        }
        break;
      case "balloons":
        dot(0, 0, r, BALLOON[i % BALLOON.length]);
        dot(-r * 0.3, -r * 0.3, r * 0.2, "rgba(255,255,255,.5)");
        if (head) eyes("#263d30");
        break;
      case "monster":
        dot(0, 0, r, "#b8e986");
        if (!head) dot(r * 0.2, -r * 0.2, r * 0.22, "#7fb35a");
        else {
          ctx.strokeStyle = "#7fb35a";
          ctx.beginPath(); ctx.moveTo(x - d.y * r * 0.6, y + d.x * r * 0.6); ctx.lineTo(x - d.y * r * 0.9 - d.x * r * 0.6, y + d.x * r * 0.9 - d.y * r * 0.6);
          ctx.moveTo(x + d.y * r * 0.6, y - d.x * r * 0.6); ctx.lineTo(x + d.y * r * 0.9 - d.x * r * 0.6, y - d.x * r * 0.9 - d.y * r * 0.6); ctx.stroke();
          dot(d.x * r * 0.2, d.y * r * 0.2, r * 0.42, "#f2f0e6");
          dot(d.x * r * 0.35, d.y * r * 0.35, r * 0.2, "#263d30");
        }
        break;
      case "pumpkin":
        ctx.fillStyle = "#f5a142";
        ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.85, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(160,80,20,.6)"; ctx.beginPath(); ctx.ellipse(x, y, r * 0.4, r * 0.85, 0, 0, Math.PI * 2); ctx.stroke();
        if (head) {
          ctx.fillStyle = "#263d30";
          const ex = -d.y * r * 0.4, ey = d.x * r * 0.4, fx = d.x * r * 0.2, fy = d.y * r * 0.2;
          for (const sgn of [1, -1]) { ctx.beginPath(); ctx.moveTo(x + fx + sgn * ex, y + fy + sgn * ey - r * 0.2); ctx.lineTo(x + fx + sgn * ex - r * 0.15, y + fy + sgn * ey + r * 0.1); ctx.lineTo(x + fx + sgn * ex + r * 0.15, y + fy + sgn * ey + r * 0.1); ctx.fill(); }
          ctx.strokeStyle = "#7fb35a"; ctx.beginPath(); ctx.moveTo(x - d.x * r * 0.6, y - d.y * r * 0.6); ctx.lineTo(x - d.x * r * 1.05, y - d.y * r * 1.05); ctx.stroke();
        }
        break;
      case "rocket":
        if (head) {
          ctx.fillStyle = "#f2f0e6";
          ctx.beginPath(); ctx.moveTo(x + d.x * r * 1.3, y + d.y * r * 1.3); ctx.lineTo(x - d.y * r * 0.9 - d.x * r * 0.7, y + d.x * r * 0.9 - d.y * r * 0.7); ctx.lineTo(x + d.y * r * 0.9 - d.x * r * 0.7, y - d.x * r * 0.9 - d.y * r * 0.7); ctx.fill();
          dot(0, 0, r * 0.28, "#ff8a65");
        } else {
          const flame = ["#f3d36b", "#f5a142", "#ff8a65"][i % 3];
          dot(0, 0, r * 0.85, flame);
        }
        break;
      default: // classic
        dot(0, 0, r, "#f2f0e6");
        dot(0, 0, r * 0.62, "#2f4a3a");
        dot(0, 0, r * 0.45, "#f3d36b");
        if (head) { dot(0, 0, r, "#f2f0e6"); eyes("#263d30"); }
    }
  }

  /* ---------- Register with the arcade ---------- */
  A.registerGame({
    id: ID,
    name: "Chalk Snake",
    accent: ACCENT,
    twists: TWISTS,
    icon: `<path d="M8 38 C8 30 18 30 18 24 C18 18 8 18 8 12 C8 6 18 6 24 6"/>
      <path class="acc" d="M24 6 C32 6 36 10 36 14"/><circle class="accf" cx="37" cy="17" r="4"/>
      <circle cx="40" cy="38" r="3"/><path d="M40 35 v-3"/>`,
    open: showMenu,
    _round: () => R, // read-only peek at the round in progress, for testing
    badge: () => (todayTwist() ? "Daily twist" : null),
    tileStat(playerId) {
      const best = Act.scores.bestAny(ID, playerId);
      return best ? `Best: ${best}` : null;
    },
    resetStats() { Act.scores.reset(ID); battleWins = {}; saveBattle(); },
    forgetPlayer(id) {
      Act.scores.forgetPlayer(ID, id);
      delete battleWins[id];
      saveBattle();
      A.store.set("chalk-snake:lastSetup", A.store.get("chalk-snake:lastSetup", []).filter(e => e.id !== id));
    }
  });
})();

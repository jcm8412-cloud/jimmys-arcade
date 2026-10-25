/* Critter Crossing: hop a critter across roads, rivers and train tracks. Endless mode (the world scrolls
   up forever, with weather that changes every 50 rows) and 15 rescue missions with up to 3 stars.
   Built on the shared action kit (Arcade.Action).
   High score: endless points (rows hopped plus 5 per coin), per player and level.
   Saved data: critter-crossing:missions {playerId: [stars per mission]}, critter-crossing:prefs
   {playerId: {critter, diff}}. Guests aren't recorded. */
(function () {
  const A = window.Arcade, Act = A.Action, CC = window.CC;
  const $ = id => document.getElementById(id);
  const esc = A.esc;
  const ID = "critter-crossing";
  const ACCENT = "#9ff0c8";
  const COLS = 9;                 // cells across
  const MARGIN = 5;               // lane objects loop this many cells beyond each side, out of sight
  const LOOP = COLS + MARGIN * 2;
  const COIN = 5;                 // points per coin
  const WEATHER = ["sunny", "rain", "fog", "night"];
  const WEATHER_NAMES = { sunny: "Sunny!", rain: "Rain! Logs are slippery", fog: "Fog!", night: "Night time!" };
  const TWISTS = ["Backwards day: cars speed up when you slow down", "Giant critter", "Always night"];
  const CAR_COLORS = ["#f29a9a", "#9fd3e8", "#f3d36b", "#d7b4f3", "#ff8a65", "#b8e986"];
  const FACE = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }; // turns for the critter drawings

  const CRITTERS = {
    frog: { name: "Frog", desc: "The regular hopper", hop: 0.13 },
    chicken: { name: "Chicken", desc: "Swipe up for a double-long hop", hop: 0.13 },
    turtle: { name: "Turtle", desc: "Never knocked off a log, but hops slower", hop: 0.21 },
    duck: { name: "Duck", desc: "Floats in water for 2 seconds", hop: 0.13 }
  };

  // speed: traffic and river speed. hit: half the width of the critter's bump box, in cells.
  // gap: extra space between cars. logTol: how far past a log's end you can stand. creep: how fast the
  // eraser at the bottom of the screen catches up in endless mode (rows per second).
  const LEVELS = {
    easy: { name: "Easy", desc: "Slow traffic, gentle bumps, 3 lives", speed: 0.6, hit: 0.22, lives: 3, gap: 1.2, logTol: 0.3, creep: 0.16 },
    medium: { name: "Medium", desc: "Normal traffic, 2 lives", speed: 0.85, hit: 0.3, lives: 2, gap: 0.5, logTol: 0.15, creep: 0.26 },
    hard: { name: "Hard", desc: "Busy roads, 1 life", speed: 1, hit: 0.35, lives: 1, gap: 0, logTol: 0.08, creep: 0.36 },
    impossible: { name: "Impossible", desc: "Rush hour all the time, 1 life", speed: 1.25, hit: 0.4, lives: 1, gap: -0.3, logTol: 0.04, creep: 0.48 }
  };

  let missions = A.store.get("critter-crossing:missions", {});
  let prefs = A.store.get("critter-crossing:prefs", {});
  const saveMissions = () => A.store.set("critter-crossing:missions", missions);
  const savePrefs = () => A.store.set("critter-crossing:prefs", prefs);
  let guestPrefs = { critter: "frog", diff: "easy" }, guestStars = [];
  const prefsOf = p => (p && p.id ? Object.assign({ critter: "frog", diff: "easy" }, prefs[p.id]) : guestPrefs);
  function setPref(p, key, value) {
    if (p && p.id) { prefs[p.id] = Object.assign(prefsOf(p), { [key]: value }); savePrefs(); } else guestPrefs[key] = value;
  }
  const starsOf = p => (p && p.id ? missions[p.id] || [] : guestStars);

  /* ---------- Menu screens ---------- */
  const home = `<button class="icon-btn" data-home aria-label="Home"></button>`;
  const back = `<button class="back-link" data-cc-back>‹ Critter Crossing</button>`;
  const seg = (id, items) => `<div class="seg" role="radiogroup" id="${id}">${items.map(([v, label]) => `<button type="button" role="radio" data-v="${v}">${label}</button>`).join("")}</div>`;
  const diffItems = Object.entries(LEVELS).map(([k, l]) => [k, l.name]);
  $("game-root").insertAdjacentHTML("beforeend", `
  <section class="screen cc menu" id="cc-menu" hidden>
    <header class="topbar"><div class="tb-left">${home}</div><h2></h2><div class="tb-right"></div></header>
    <h1 class="title">Critter <span>Crossing</span></h1>
    <p class="tagline">Hop across roads, rivers and train tracks!</p>
    <div class="menu-buttons">
      <button class="btn big" id="cc-btn-endless">Endless</button>
      <button class="btn big daily" id="cc-btn-daily" hidden></button>
      <button class="btn big" id="cc-btn-missions">Rescue missions</button>
      <button class="btn ghost" id="cc-btn-top">Top scores</button>
    </div>
  </section>

  <section class="screen cc" id="cc-missions" hidden>
    <header class="topbar"><div class="tb-left">${home}${back}</div><h2>Rescue missions</h2><div class="tb-right"></div></header>
    <div class="playing-as" id="cc-m-playing"></div>
    ${seg("cc-m-diff", diffItems)}
    <div class="cc-mlist" id="cc-mlist"></div>
  </section>

  <section class="screen cc" id="cc-pick" hidden>
    <header class="topbar"><div class="tb-left">${home}<button class="back-link" id="cc-pick-back"></button></div><h2>Pick a critter</h2><div class="tb-right"></div></header>
    <p class="note center-text" id="cc-pick-what"></p>
    <div id="cc-pick-diff-wrap">${seg("cc-pick-diff", diffItems)}</div>
    <div class="cc-critters" id="cc-critters" role="radiogroup" aria-label="Critter"></div>
    <p class="note center-text" id="cc-pick-note"></p>
    <button class="btn big" id="cc-go">Go!</button>
  </section>

  <section class="screen cc" id="cc-top" hidden>
    <header class="topbar"><div class="tb-left">${home}${back}</div><h2>Top scores</h2><div class="tb-right"></div></header>
    ${seg("cc-top-level", diffItems.concat([["daily", "Today"]]))}
    <div id="cc-top-list"></div>
  </section>`);

  const scr = Act.createScreen({
    id: "cc-play", cls: "cc",
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
    $("cc-btn-daily").hidden = !d;
    if (d) $("cc-btn-daily").innerHTML = `Daily twist<small>${esc(d.name)}</small>`;
    A.show("cc-menu");
  }
  document.querySelectorAll("[data-cc-back]").forEach(b => b.addEventListener("click", showMenu));
  $("cc-btn-endless").addEventListener("click", () => A.whoIsPlaying({ onDone: () => showPick({ mode: "endless" }), onBack: showMenu, backLabel: "Critter Crossing" }));
  $("cc-btn-daily").addEventListener("click", () => A.whoIsPlaying({ onDone: () => showPick({ mode: "daily" }), onBack: showMenu, backLabel: "Critter Crossing" }));
  $("cc-btn-missions").addEventListener("click", () => A.whoIsPlaying({ onDone: showMissions, onBack: showMenu, backLabel: "Critter Crossing" }));
  $("cc-btn-top").addEventListener("click", () => showTop("easy"));

  const starText = n => "★".repeat(n) + "☆".repeat(3 - n);
  const GOAL_NAMES = { home: "Bring the baby home", stars: "Collect the stars", letter: "Deliver the letter" };
  function showMissions() {
    const p = A.session.player;
    $("cc-m-playing").innerHTML = `${A.avatarSvg(p)}<span>Playing: <b>${esc(p.name)}</b></span>
      <button class="btn ghost" id="cc-switch">Switch</button>`;
    $("cc-switch").addEventListener("click", () => A.whoIsPlaying({ force: true, onDone: showMissions, onBack: showMissions, backLabel: "Missions" }));
    paintSeg("cc-m-diff", prefsOf(p).diff);
    const stars = starsOf(p), box = $("cc-mlist");
    box.innerHTML = "";
    CC.MISSIONS.forEach((m, i) => {
      const open = i === 0 || (stars[i - 1] || 0) > 0;
      const b = document.createElement("button");
      b.className = "cc-mission";
      b.disabled = !open;
      b.innerHTML = `<span class="num">${i + 1}</span><span class="txt"><b>${esc(m.name)}</b><small>${open ? esc(m.story) : "Finish the mission before to unlock"}</small></span>
        <span class="stars">${starText(stars[i] || 0)}</span>`;
      b.setAttribute("aria-label", `Mission ${i + 1}: ${m.name}. ${open ? `${stars[i] || 0} of 3 stars` : "locked"}`);
      b.addEventListener("click", () => showPick({ mode: "mission", mission: i }));
      box.appendChild(b);
    });
    A.setAccent(ACCENT);
    A.show("cc-missions");
  }
  $("cc-m-diff").querySelectorAll("button").forEach(b => b.addEventListener("click", () => { setPref(A.session.player, "diff", b.dataset.v); paintSeg("cc-m-diff", b.dataset.v); }));

  /* ---------- Critter picker (before every run) ---------- */
  let pickOpts = null;
  const crittersEl = $("cc-critters");
  for (const [k, c] of Object.entries(CRITTERS)) {
    crittersEl.insertAdjacentHTML("beforeend", `<button type="button" role="radio" data-v="${k}">
      <canvas width="112" height="112" aria-hidden="true"></canvas><b>${c.name}</b><small>${c.desc}</small></button>`);
  }
  crittersEl.querySelectorAll("button").forEach(b => {
    const cv = b.querySelector("canvas"), c = cv.getContext("2d");
    c.scale(2, 2);
    drawCritter(c, b.dataset.v, 28, 30, 40, "up", {});
    b.addEventListener("click", () => { setPref(A.session.player, "critter", b.dataset.v); paintPick(); });
  });
  $("cc-pick-diff").querySelectorAll("button").forEach(b => b.addEventListener("click", () => { setPref(A.session.player, "diff", b.dataset.v); paintPick(); }));
  function showPick(opts) {
    pickOpts = opts;
    const m = opts.mode === "mission" ? CC.MISSIONS[opts.mission] : null;
    $("cc-pick-back").textContent = m ? "‹ Missions" : "‹ Critter Crossing";
    $("cc-pick-what").textContent = m ? `Mission ${opts.mission + 1}: ${m.name}. ${m.story}` : opts.mode === "daily" ? `Daily twist: ${todayTwist() ? todayTwist().name : ""}` : "Endless: how far can you hop?";
    $("cc-pick-diff-wrap").hidden = opts.mode !== "endless";
    paintPick();
    A.setAccent(ACCENT);
    A.show("cc-pick");
  }
  function paintPick() {
    const p = A.session.player, pr = prefsOf(p);
    paintSeg("cc-critters", pr.critter);
    paintSeg("cc-pick-diff", pr.diff);
    let note = "";
    if (pickOpts.mode === "endless" && p.id) note = `${LEVELS[pr.diff].name}: your best is ${Act.scores.best(ID, pr.diff, p.id)}`;
    if (pickOpts.mode === "mission") note = `Level: ${LEVELS[pr.diff].name}`;
    $("cc-pick-note").textContent = note;
  }
  $("cc-pick-back").addEventListener("click", () => (pickOpts.mode === "mission" ? showMissions() : showMenu()));
  $("cc-go").addEventListener("click", () => {
    const p = A.session.player, pr = prefsOf(p);
    if (pickOpts.mode === "mission") startRun({ mode: "mission", mission: pickOpts.mission, diff: pr.diff, critter: pr.critter, player: p });
    else if (pickOpts.mode === "daily") startRun({ mode: "daily", diff: "medium", critter: pr.critter, player: p, twist: todayTwist() });
    else startRun({ mode: "endless", diff: pr.diff, critter: pr.critter, player: p });
  });

  function showTop(level) {
    paintSeg("cc-top-level", level);
    const list = level === "daily" ? Act.scores.dailyTop(ID) : Act.scores.top(ID, level);
    const d = todayTwist();
    $("cc-top-list").innerHTML = (level === "daily" ? `<p class="note">${d ? `Today's twist: ${esc(d.name)}` : "Critter Crossing isn't today's daily twist."}</p>` : "")
      + `<p class="note">Endless mode: one point per row, ${COIN} per coin.</p>` + Act.topListHtml(list, -1);
    A.setAccent(ACCENT);
    A.show("cc-top");
  }
  $("cc-top-level").querySelectorAll("button").forEach(b => b.addEventListener("click", () => showTop(b.dataset.v)));

  /* ---------- Run state ----------
     R: { mode ("endless" | "daily" | "mission"), diff, cfg, critter, player, twist, twistName, mission (index),
          lanes [row] (see makeLane), gen (endless lane generator), finishRow (missions), camY (row at the
          bottom of the screen), P (the critter), score, coins, maxRow, lives, weather, t, started, lastHop,
          state ("play" | "won" | "over") }
     P: { x (center, in cells), row, hop {x0, y0, x1, y1, t, dur, dbl} | null, face, queued, inv (safe until),
          float (duck: sinks at this time), baby, letter } */
  let R = null;
  const dustFx = Act.dust(50);
  const F = {};

  function startRun(opts) {
    const cfg = LEVELS[opts.diff];
    R = {
      mode: opts.mode, diff: opts.diff, cfg, critter: opts.critter, player: opts.player, mission: opts.mission,
      twist: opts.twist ? opts.twist.twist : -1, twistName: opts.twist ? opts.twist.name : "", opts,
      lanes: [], gen: { type: "grass", left: 0 }, finishRow: Infinity, camY: 0,
      score: 0, coins: 0, maxRow: 0, lives: cfg.lives, weather: "sunny", t: 0, started: false, lastHop: 0, creepPause: 0,
      state: "play"
    };
    R.P = { x: Math.floor(COLS / 2) + 0.5, row: 1, hop: null, face: "up", queued: null, inv: 0, float: 0, baby: false, letter: false };
    if (R.mode === "mission") buildMission(CC.MISSIONS[R.mission]);
    R.weather = weatherAt(R.P.row);
    A.setAccent(ACCENT);
    scr.show();
    requestAnimationFrame(() => {
      layout();
      ensureLanes();
      updateHud();
      scr.start(update, render);
    });
  }
  function restart() { if (R) startRun(R.opts); }

  /* ---------- The world ----------
     lane: { type ("grass" | "road" | "river" | "track" | "finish"), row, dir, speed (cells per second),
             objs [{x (0..LOOP), len, color}], trees Map(col -> "tree" | "rock"), coins Set(col), stars Set(col),
             baby (col), mailbox (col), train {state ("wait" | "warn" | "pass"), t, x} } */
  function rng32(seed) {
    return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function makeLane(type, row, rnd, below, scale) {
    const L = { type, row, dir: rnd() < 0.5 ? -1 : 1, speed: 0, objs: [], trees: new Map(), coins: new Set(), stars: new Set() };
    const cfg = R.cfg;
    // Lanes next to each other of the same kind go opposite ways.
    if (below && below.type === type && (type === "road" || type === "river")) L.dir = -below.dir;
    if (type === "road") {
      L.speed = (1.2 + rnd() * 1.4) * cfg.speed * scale;
      fill(L, rnd, () => (rnd() < 0.3 ? 2 : 1), len => 2.4 + cfg.gap + rnd() * 3.5);
      L.objs.forEach(o => { o.color = CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)]; });
      if (R.mode === "endless" || R.mode === "daily") for (let c = 0; c < COLS; c++) if (rnd() < 0.025) L.coins.add(c);
    } else if (type === "river") {
      L.speed = (0.7 + rnd() * 0.9) * Math.sqrt(cfg.speed) * scale;
      const minLen = R.diff === "easy" ? 3 : 2;
      fill(L, rnd, () => minLen + Math.floor(rnd() * (5 - minLen)), () => 1.3 + rnd() * 1.5);
    } else if (type === "track") {
      L.speed = 18 * Math.sqrt(cfg.speed);
      L.train = { state: "wait", t: 1.5 + rnd() * 5, x: 0 };
    } else {
      // Grass: a few trees or rocks, never boxing the critter in. Obstacles are at least 3 apart and never
      // one cell from an edge, so every gap is 2+ cells wide and always has a way up.
      if (row > 2 && type === "grass") {
        const want = rnd() < 0.3 ? 0 : rnd() < 0.65 ? 1 : 2 + (rnd() < 0.3 ? 1 : 0);
        for (let k = 0; k < want * 4 && L.trees.size < want; k++) {
          const c = Math.floor(rnd() * COLS);
          if (c === 1 || c === COLS - 2) continue;
          if ([...L.trees.keys()].some(o => Math.abs(o - c) < 3)) continue;
          L.trees.set(c, rnd() < 0.7 ? "tree" : "rock");
        }
      }
      if (R.mode === "endless" || R.mode === "daily") for (let c = 0; c < COLS; c++) if (!L.trees.has(c) && rnd() < 0.06) L.coins.add(c);
    }
    return L;
  }
  // Put objects around the lane's loop with the given lengths and gaps (the gap across the wrap too).
  function fill(L, rnd, lenFn, gapFn) {
    let x = rnd() * 3;
    for (;;) {
      const len = lenFn();
      if (x + len > LOOP) break;
      L.objs.push({ x, len });
      x += len + gapFn(len);
    }
    while (L.objs.length > 1 && LOOP - (L.objs[L.objs.length - 1].x + L.objs[L.objs.length - 1].len) + L.objs[0].x < gapFn(0) * 0.8) L.objs.pop();
  }
  const objX = (L, o) => ((o.x % LOOP) + LOOP) % LOOP - MARGIN; // left edge in cells (0 = left side of the field)

  // Endless lanes come in short runs of the same kind, in random order. They get faster further up.
  function nextType(row) {
    if (row < 3) return "grass";
    const g = R.gen;
    if (g.left > 0) { g.left--; return g.type; }
    let opts = [["grass", 3], ["road", 4]];
    if (row > 6) opts.push(["river", 3]);
    if (row > 14) opts.push(["track", 1.3]);
    opts = opts.filter(o => o[0] !== g.type); // never two runs of the same kind back to back
    let roll = Math.random() * opts.reduce((s, o) => s + o[1], 0);
    const type = opts.find(o => (roll -= o[1]) < 0)[0];
    const len = { grass: 1 + (Math.random() < 0.4 ? 1 : 0), road: 1 + Math.floor(Math.random() * 4), river: 1 + Math.floor(Math.random() * 3), track: 1 + (Math.random() < 0.3 ? 1 : 0) }[type];
    g.type = type; g.left = len - 1;
    return type;
  }
  function ensureLanes() {
    if (R.mode === "mission") return;
    const top = Math.ceil(R.camY + (F.rows || 20) + 3);
    while (R.lanes.length <= top) {
      const row = R.lanes.length;
      R.lanes.push(makeLane(nextType(row), row, Math.random, R.lanes[row - 1], 1 + Math.min(row, 400) / 400));
    }
  }
  function buildMission(m) {
    const rnd = rng32(1000 + R.mission * 7919);
    const scale = 0.9 + R.mission * 0.03;
    [...m.lanes].forEach((ch, row) => {
      R.lanes.push(makeLane({ g: "grass", r: "road", w: "river", t: "track" }[ch], row, rnd, R.lanes[row - 1], scale));
    });
    R.finishRow = R.lanes.length;
    const fin = makeLane("finish", R.finishRow, rnd, null, 1);
    R.lanes.push(fin);
    for (let k = 1; k <= 12; k++) R.lanes.push(makeLane("finish", R.finishRow + k, rnd, null, 1)); // scenery past the finish
    const grassRows = R.lanes.filter(L => L.type === "grass" && L.row > 1);
    const freeCol = L => { let c; do c = Math.floor(rnd() * COLS); while (L.trees.has(c)); return c; };
    if (m.goal === "home") {
      const L = grassRows[Math.floor(grassRows.length / 2)];
      L.baby = freeCol(L);
    } else if (m.goal === "stars") {
      for (let k = 0; k < m.stars; k++) {
        const L = grassRows[Math.floor((k + 0.5) * grassRows.length / m.stars) % grassRows.length];
        let c = freeCol(L);
        while (L.stars.has(c)) c = freeCol(L);
        L.stars.add(c);
      }
      R.starsLeft = m.stars;
    } else {
      fin.mailbox = Math.floor(rnd() * COLS);
      R.P.letter = true;
    }
    R.P.row = 0;
    R.camY = -0.5;
  }
  const lane = row => R.lanes[row] || null;
  function weatherAt(row) {
    if (R.twist === 2) return "night";
    if (R.mode === "mission") return CC.MISSIONS[R.mission].weather || "sunny";
    return WEATHER[Math.floor(Math.max(0, row) / 50) % WEATHER.length];
  }

  /* ---------- Geometry ---------- */
  const W = () => scr.size.w, H = () => scr.size.h;
  function layout() {
    F.cell = Math.min(W() / COLS, H() / 10.5);
    F.x = (W() - F.cell * COLS) / 2;
    F.rows = H() / F.cell;
    night.width = Math.round(W() * scr.size.dpr);
    night.height = Math.round(H() * scr.size.dpr);
  }
  const sx = x => F.x + x * F.cell;                           // cell x -> screen x
  const sy = row => H() - (row - R.camY + 1) * F.cell;        // top of a row on screen

  /* ---------- Input: tap to hop forward, swipe to hop that way. One touch, one hop. ---------- */
  let touch = null;
  scr.stage.addEventListener("pointerdown", e => {
    // Only presses on the game itself count. Grabbing the pointer for a press on a button over it (Paused,
    // end-of-round panels) would send the click to the stage instead, and the button would never get it.
    if (!R || e.target !== scr.canvas) return;
    touch = { id: e.pointerId, x: e.clientX, y: e.clientY, fired: false };
    try { scr.stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    e.preventDefault();
  });
  scr.stage.addEventListener("pointermove", e => {
    if (!touch || touch.id !== e.pointerId || touch.fired) return;
    const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    touch.fired = true;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"), true);
  });
  scr.stage.addEventListener("pointerup", e => {
    if (touch && touch.id === e.pointerId && !touch.fired) move("up", false);
    touch = null;
  });
  scr.stage.addEventListener("pointercancel", () => { touch = null; });
  const KEYS = { ArrowUp: "up", w: "up", W: "up", " ": "up", ArrowDown: "down", s: "down", S: "down", ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
  document.addEventListener("keydown", e => {
    if (A.currentScreen !== "cc-play" || A.dialogOpen() || !KEYS[e.key]) return;
    e.preventDefault();
    if (!e.repeat) move(KEYS[e.key], e.shiftKey); // Shift+Up: the chicken's double hop
  });

  /* ---------- Hopping ---------- */
  function move(dir, swipe) {
    if (!R || !scr.running || R.state !== "play") return;
    const P = R.P;
    if (P.hop) { P.queued = [dir, swipe]; return; } // one hop waits its turn, so quick taps aren't lost
    hop(dir, R.critter === "chicken" && dir === "up" && swipe);
  }
  function hop(dir, dbl) {
    const P = R.P;
    const dx = dir === "left" ? -1 : dir === "right" ? 1 : 0;
    let dy = dir === "up" ? (dbl ? 2 : 1) : dir === "down" ? -1 : 0;
    P.face = dir;
    let tx = P.x + dx;
    if (tx < 0.45 || tx > COLS - 0.45) return bump();
    const target = row => {
      if (row < 0 || row > R.finishRow || (R.mode !== "mission" && row < R.camY - 0.2)) return null;
      const L = lane(row);
      if (!L) return null;
      const x = L.type === "river" ? tx : Math.floor(tx) + 0.5; // land on a cell, except on logs
      if (L.trees.has(Math.floor(x))) return null;
      return x;
    };
    let x = target(P.row + dy);
    if (x == null && dbl) { dy = 1; dbl = false; x = target(P.row + 1); }
    if (x == null) return bump();
    P.hop = { x0: P.x, y0: P.row, x1: x, y1: P.row + dy, t: 0, dur: CRITTERS[R.critter].hop * (dbl ? 1.6 : 1), dbl };
    R.started = true;
    R.lastHop = R.t;
  }
  function bump() { R.P.wobble = R.t + 0.15; }
  function land() {
    const P = R.P, h = P.hop;
    P.x = h.x1; P.row = h.y1; P.hop = null;
    const L = lane(P.row), col = Math.floor(P.x);
    if (L.type !== "river") P.float = 0;
    if (L.coins.has(col)) { L.coins.delete(col); R.coins++; A.sfx.right(); dustFx.emit(sx(P.x), sy(P.row) + F.cell / 2, "#f3d36b", 6); }
    if (L.stars.has(col)) { L.stars.delete(col); R.starsLeft--; A.sfx.right(); scr.message(R.starsLeft ? `${R.starsLeft} to go!` : "All the stars!", 800); }
    if (L.baby === col && !P.baby) { L.baby = undefined; P.baby = true; A.sfx.right(); scr.message("Got the baby!", 900); }
    if (P.row > R.maxRow) R.maxRow = P.row;
    const w = weatherAt(P.row);
    if (w !== R.weather) { R.weather = w; scr.message(WEATHER_NAMES[w], 1300); }
    if (P.row === R.finishRow) checkFinish(col);
    if (R.state === "play" && P.queued) { const [d, s] = P.queued; P.queued = null; move(d, s); }
  }

  /* ---------- Update ---------- */
  function update(dt) {
    if (R.state !== "play") return;
    R.t += dt;
    ensureLanes();
    const lo = Math.floor(R.camY) - 2, hi = Math.ceil(R.camY + F.rows) + 2;
    for (let r = Math.max(0, lo); r <= hi && r < R.lanes.length; r++) moveLane(R.lanes[r], dt);
    const P = R.P;
    if (P.hop) {
      P.hop.t += dt;
      if (P.hop.t >= P.hop.dur) land();
    } else ride(dt);
    if (R.state === "play") collide();
    if (R.state === "play") moveCamera(dt);
    R.score = R.mode === "mission" ? 0 : R.maxRow + R.coins * COIN;
    dustFx.update(dt);
    updateHud();
  }
  // Daily twist "backwards day": cars crawl while you keep hopping and speed up when you dawdle.
  const roadFactor = () => (R.twist === 0 ? 0.5 + 1.1 * Math.min(1, (R.t - R.lastHop) / 3) : 1);
  function moveLane(L, dt) {
    if (L.type === "road" || L.type === "river") {
      const v = L.dir * L.speed * (L.type === "road" ? roadFactor() : 1) * dt;
      for (const o of L.objs) o.x += v;
    } else if (L.type === "track") {
      const tr = L.train;
      tr.t -= dt;
      if (tr.state === "wait" && tr.t <= 1.3) tr.state = "warn";         // the red light blinks first
      if (tr.state === "warn" && tr.t <= 0) { tr.state = "pass"; tr.x = L.dir > 0 ? -13 : COLS + 1; }
      if (tr.state === "pass") {
        tr.x += L.dir * L.speed * dt;
        if (tr.x > COLS + 2 || tr.x < -14) { tr.state = "wait"; tr.t = 3 + Math.random() * 6; }
      }
    }
  }
  const logUnder = (L, x) => L.objs.find(o => { const ox = objX(L, o); return x >= ox - R.cfg.logTol && x <= ox + o.len + R.cfg.logTol; });
  // Standing on a river lane: ride a log, or fall in.
  function ride(dt) {
    const P = R.P, L = lane(P.row);
    if (!L || L.type !== "river") return;
    const log = logUnder(L, P.x);
    if (log) {
      P.x += L.dir * L.speed * dt;
      if (R.weather === "rain" && R.critter !== "turtle") P.x += L.dir * 0.35 * dt; // slippery logs
      if (P.x < 0.15 || P.x > COLS - 0.15) {
        if (R.critter === "turtle") P.x = Math.max(0.5, Math.min(COLS - 0.5, P.x)); // the turtle holds on
        else return die("Swept away!");
      }
      P.float = 0;
      return;
    }
    if (R.critter === "duck") {
      if (!P.float) { P.float = R.t + 2; scr.message("Paddle!", 700); }
      if (R.t < P.float) return;
    }
    die("Splash!");
  }
  function collide() {
    const P = R.P;
    if (R.t < P.inv) return;
    const h = P.hop;
    if (h && h.dbl && h.t < h.dur * 0.8) return; // the chicken is up in the air
    const f = h ? h.t / h.dur : 1;
    const x = h ? h.x0 + (h.x1 - h.x0) * f : P.x, row = Math.round(h ? h.y0 + (h.y1 - h.y0) * f : P.row);
    const L = lane(row);
    if (!L) return;
    const hw = R.cfg.hit + (R.twist === 1 ? 0.22 : 0);
    const hits = (ox, len) => x + hw > ox && x - hw < ox + len;
    if (L.type === "road" && L.objs.some(o => hits(objX(L, o), o.len))) return die("Bumped!");
    if (L.type === "track" && L.train.state === "pass" && hits(L.train.x, 12)) return die("Bumped by a train!");
  }
  function moveCamera(dt) {
    const P = R.P;
    const py = P.hop ? P.hop.y0 + (P.hop.y1 - P.hop.y0) * (P.hop.t / P.hop.dur) : P.row;
    const target = py - F.rows * 0.3;
    if (R.mode === "mission") {
      const t = Math.max(-0.5, Math.min(R.finishRow + 2 - F.rows, target));
      R.camY += (t - R.camY) * Math.min(1, dt * 5);
      return;
    }
    if (target > R.camY) R.camY += (target - R.camY) * Math.min(1, dt * 5);
    // The eraser: if you stand still too long, the bottom of the screen catches up with you.
    if (R.started && R.t > R.creepPause) R.camY += R.cfg.creep * (1 + Math.min(R.maxRow, 400) / 800) * dt;
    if (py < R.camY - 0.25) die("The eraser got you!");
  }

  /* ---------- Bumps, splashes, and the end ---------- */
  function die(reason) {
    if (R.state !== "play") return;
    const P = R.P;
    R.lives--;
    A.sfx.lose();
    A.buzz();
    dustFx.emit(sx(P.x), sy(P.row) + F.cell / 2, "#f2f0e6", 12);
    if (R.lives <= 0) { gameOver(reason); return; }
    respawn();
    scr.message(reason, 1000);
    updateHud();
    scr.hold(900);
  }
  // Back on the nearest safe grass, a little blinky so nothing bumps you straight away.
  function respawn() {
    const P = R.P;
    const minRow = R.mode === "mission" ? 0 : Math.ceil(R.camY + 1);
    let row = Math.max(minRow, P.hop ? P.hop.y0 : P.row);
    const safe = r => { const L = lane(r); return L && (L.type === "grass" || L.type === "finish"); };
    let found = null;
    for (let r = row; r >= minRow && found == null; r--) if (safe(r)) found = r;
    for (let r = row + 1; found == null && r < row + 30; r++) { if (!lane(r)) ensureLanes(); if (safe(r)) found = r; }
    const L = lane(found);
    let col = Math.max(0, Math.min(COLS - 1, Math.floor(P.x)));
    for (let d = 0; L.trees.has(col); d++) col = Math.max(0, Math.min(COLS - 1, col + (d % 2 ? d : -d)));
    Object.assign(P, { x: col + 0.5, row: found, hop: null, queued: null, inv: R.t + 2, float: 0 });
    R.creepPause = R.t + 2.5;
    if (R.mode !== "mission") R.camY = Math.min(R.camY, found - 2);
  }

  function checkFinish(col) {
    const m = CC.MISSIONS[R.mission];
    if (m.goal === "home" && !R.P.baby) { scr.message("Find the baby first!", 1000); return; }
    if (m.goal === "stars" && R.starsLeft > 0) { scr.message(`${R.starsLeft} more star${R.starsLeft > 1 ? "s" : ""} to find!`, 1000); return; }
    if (m.goal === "letter" && col !== lane(R.finishRow).mailbox) { scr.message("Hop onto the mailbox!", 900); return; }
    missionDone();
  }
  // Par time for 3 stars; up to 1.6 times that for 2 stars; any finish is 1 star.
  function parTime(m) { return 6 + m.lanes.length * 1.1 + (m.goal === "stars" ? m.stars * 2.5 : 0) + (m.goal === "home" ? 3 : 0); }
  function missionDone() {
    R.state = "won";
    scr.stop();
    A.sfx.win();
    const m = CC.MISSIONS[R.mission], par = parTime(m), secs = R.t;
    const got = secs <= par ? 3 : secs <= par * 1.6 ? 2 : 1;
    const list = starsOf(R.player).slice();
    const before = list[R.mission] || 0;
    if (got > before) {
      list[R.mission] = got;
      if (R.player.id) { missions[R.player.id] = list; saveMissions(); } else guestStars = list;
    }
    if (got > before && before) scr.burst("New best!");
    const next = R.mission + 1 < CC.MISSIONS.length ? R.mission + 1 : -1;
    setTimeout(() => {
      if (A.currentScreen !== "cc-play") return;
      scr.showPanel({
        html: `<h2>Mission complete!</h2>
          <p class="cc-stars">${starText(got)}</p>
          <p class="note">${esc(m.name)} in <b>${Math.round(secs)}</b> seconds. ${got < 3 ? `3 stars: ${Math.round(par)} seconds or less.` : "Super speedy!"}</p>`,
        buttons: [
          ...(next >= 0 ? [{ label: "Next mission", cls: "big", run: () => showPick({ mode: "mission", mission: next }) }] : []),
          { label: "Play again", cls: next >= 0 ? "" : "big", run: restart },
          { label: "Missions", cls: "ghost", run: showMissions }
        ]
      });
    }, 500);
  }

  function gameOver(reason) {
    R.state = "over";
    scr.stop();
    updateHud();
    if (R.mode === "mission") {
      setTimeout(() => {
        if (A.currentScreen !== "cc-play") return;
        scr.showPanel({
          html: `<h2>${esc(reason)}</h2><p class="note">${esc(CC.MISSIONS[R.mission].name)}: out of lives. Have another go!</p>`,
          buttons: [{ label: "Try again", cls: "big", run: restart }, { label: "Missions", cls: "ghost", run: showMissions }]
        });
      }, 500);
      return;
    }
    const daily = R.mode === "daily";
    const res = Act.scores.submit(ID, R.diff, R.player, R.score, { daily });
    if (res.newBest) scr.burst("New best!");
    const list = daily ? Act.scores.dailyTop(ID) : Act.scores.top(ID, R.diff), lvName = LEVELS[R.diff].name;
    setTimeout(() => {
      if (A.currentScreen !== "cc-play") return;
      scr.showPanel({
        html: `<h2>${esc(reason)}</h2>
          <p class="big-score">${R.score}</p>
          ${daily ? `<p class="note">Daily twist: ${esc(R.twistName)}</p>` : ""}
          <p class="note">${R.maxRow} rows and ${R.coins} coin${R.coins === 1 ? "" : "s"}${R.player.id && !daily ? ` · your best on ${lvName}: <b>${res.best}</b>` : ""}</p>
          <h3 class="label">${daily ? "Today's top scores" : `Top scores on ${lvName}`}</h3>
          ${Act.topListHtml(list, res.rank)}`,
        buttons: [{ label: "Play again", cls: "big", run: restart }, { label: "Pick a critter", cls: "ghost", run: () => showPick({ mode: R.mode }) }]
      });
    }, res.newBest ? 900 : 400);
  }

  /* ---------- HUD ---------- */
  let hudText = "";
  function updateHud() {
    const hearts = `<span class="lives">${"♥".repeat(Math.max(0, R.lives))}</span>`;
    let html;
    if (R.mode === "mission") {
      const m = CC.MISSIONS[R.mission];
      const goal = m.goal === "stars" ? `★ ${m.stars - R.starsLeft}/${m.stars}` : m.goal === "home" ? (R.P.baby ? "Baby: got it!" : "Find the baby") : "To the mailbox";
      html = `<span class="goal">${goal}</span><span>${Math.floor(R.t)}s</span>${hearts}`;
    } else html = `<span>Score</span><b>${R.score}</b><span class="coins">● ${R.coins}</span>${hearts}`;
    if (html !== hudText) { scr.hud.innerHTML = html; hudText = html; }
  }

  /* ---------- Drawing ---------- */
  const night = document.createElement("canvas"), nctx = night.getContext("2d");
  // A little hash so trees, tufts and ripples stay put for each row.
  const hashRow = (row, k) => { let h = Math.imul(row + 7, 2654435761) ^ Math.imul(k + 3, 40503); h ^= h >>> 13; return ((Math.imul(h, 1274126177) >>> 0) % 1000) / 1000; };
  function rrect(c, x, y, w, h, r) { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }

  function render() {
    if (!R || !F.cell) return;
    const ctx = scr.ctx, w = W(), h = H(), cs = F.cell;
    ctx.clearRect(0, 0, w, h);
    const lo = Math.floor(R.camY) - 1, hi = Math.ceil(R.camY + F.rows) + 1;
    const fog = R.weather === "fog", P = R.P;
    const pp = critterPos();
    for (let r = lo; r <= hi; r++) drawLaneBack(ctx, r);
    for (let r = Math.min(hi, R.lanes.length - 1); r >= Math.max(0, lo); r--) drawLaneThings(ctx, R.lanes[r], fog ? pp : null);
    // The field's edges, when the screen is wider than the field.
    if (F.x > 1) {
      ctx.fillStyle = "rgba(20,32,25,.55)";
      ctx.fillRect(0, 0, F.x, h); ctx.fillRect(F.x + COLS * cs, 0, F.x + 1, h);
    }
    dustFx.draw(ctx);
    drawPlayer(ctx, pp);
    if (R.weather === "rain") drawRain(ctx);
    if (fog) {
      const g = ctx.createRadialGradient(pp.sx, pp.sy, cs * 1.6, pp.sx, pp.sy, cs * 4.2);
      g.addColorStop(0, "rgba(205,214,208,0)"); g.addColorStop(1, "rgba(205,214,208,.72)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    if (R.weather === "night") drawNight(ctx, pp, lo, hi);
    if (R.mode !== "mission") drawEraser(ctx, pp);
  }
  function critterPos() {
    const P = R.P, h = P.hop, f = h ? h.t / h.dur : 0;
    const x = h ? h.x0 + (h.x1 - h.x0) * f : P.x, row = h ? h.y0 + (h.y1 - h.y0) * f : P.row;
    return { x, row, sx: sx(x), sy: sy(row) + F.cell / 2, lift: h ? Math.sin(Math.PI * f) : 0 };
  }

  function drawLaneBack(ctx, r) {
    const cs = F.cell, y = sy(r), w = W();
    const L = r >= 0 ? lane(r) : null, type = L ? L.type : "grass";
    if (type === "grass" || type === "finish") {
      ctx.fillStyle = r % 2 ? "rgba(184,233,134,.10)" : "rgba(184,233,134,.07)";
      ctx.fillRect(0, y, w, cs + 0.5);
      ctx.strokeStyle = "rgba(184,233,134,.35)"; ctx.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        const tx = sx(hashRow(r, k) * COLS), ty = y + cs * (0.3 + hashRow(r, k + 9) * 0.5);
        ctx.beginPath(); ctx.moveTo(tx - 3, ty + 3); ctx.lineTo(tx - 1, ty - 3); ctx.moveTo(tx + 1, ty + 3); ctx.lineTo(tx + 3, ty - 2); ctx.stroke();
      }
      if (type === "finish" && r === R.finishRow) {
        // Checkered finish line along the top of the row.
        const sq = cs / 4;
        for (let k = 0; k * sq < w; k++) for (let j = 0; j < 2; j++) {
          ctx.fillStyle = (k + j) % 2 ? "rgba(242,240,230,.75)" : "rgba(38,61,48,.6)";
          ctx.fillRect(k * sq, y + j * sq, sq, sq);
        }
      }
    } else if (type === "road") {
      ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.fillRect(0, y, w, cs + 0.5);
      const above = lane(r + 1);
      if (above && above.type === "road") {
        ctx.strokeStyle = "rgba(242,240,230,.4)"; ctx.lineWidth = 2; ctx.setLineDash([cs * 0.35, cs * 0.3]);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); ctx.setLineDash([]);
      }
    } else if (type === "river") {
      ctx.fillStyle = "rgba(127,190,220,.25)"; ctx.fillRect(0, y, w, cs + 0.5);
      ctx.strokeStyle = "rgba(159,211,232,.45)"; ctx.lineWidth = 1.5;
      const shift = (R.t * L.dir * L.speed * cs * 0.5) % (cs * 2);
      for (let k = -1; k < COLS + 2; k += 2) {
        const wx = sx(k) + shift + hashRow(r, k) * cs, wy = y + cs * (0.3 + hashRow(r, k + 4) * 0.4);
        ctx.beginPath(); ctx.moveTo(wx, wy); ctx.quadraticCurveTo(wx + cs * 0.2, wy - 4, wx + cs * 0.4, wy); ctx.quadraticCurveTo(wx + cs * 0.6, wy + 4, wx + cs * 0.8, wy); ctx.stroke();
      }
    } else if (type === "track") {
      ctx.fillStyle = "rgba(0,0,0,.16)"; ctx.fillRect(0, y, w, cs + 0.5);
      ctx.strokeStyle = "rgba(185,170,150,.5)"; ctx.lineWidth = 3;
      for (let k = 0; k * cs * 0.5 < w; k++) { const x = k * cs * 0.5 + cs * 0.1; ctx.beginPath(); ctx.moveTo(x, y + cs * 0.15); ctx.lineTo(x, y + cs * 0.85); ctx.stroke(); }
      ctx.strokeStyle = "rgba(242,240,230,.55)"; ctx.lineWidth = 2;
      for (const f of [0.3, 0.7]) { ctx.beginPath(); ctx.moveTo(0, y + cs * f); ctx.lineTo(w, y + cs * f); ctx.stroke(); }
    }
  }

  // Fog: cars only show up when they're close. p = the critter's position (or null when it's clear).
  function fogAlpha(p, row, ox, len) {
    if (!p) return 1;
    const gx = Math.max(0, ox - p.x, p.x - (ox + len)), d = Math.hypot(gx, row - p.row);
    return Math.max(0, Math.min(1, (3.2 - d) / 1.2));
  }
  function drawLaneThings(ctx, L, fogP) {
    const cs = F.cell, y = sy(L.row);
    for (const [c, kind] of L.trees) drawTree(ctx, sx(c + 0.5), y + cs / 2, cs, kind);
    for (const c of L.coins) {
      const cx = sx(c + 0.5), cy = y + cs / 2, r = cs * 0.17;
      ctx.fillStyle = "#f3d36b"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#8a5a34"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2); ctx.stroke();
    }
    for (const c of L.stars) drawStar(ctx, sx(c + 0.5), y + cs / 2, cs * 0.3 * (1 + Math.sin(R.t * 5) * 0.08));
    if (L.baby != null) drawCritter(ctx, R.critter, sx(L.baby + 0.5), y + cs / 2 + Math.sin(R.t * 6) * 2, cs * 0.45, "down", {});
    if (L.mailbox != null) drawMailbox(ctx, sx(L.mailbox + 0.5), y + cs / 2, cs);
    if (L.type === "road") for (const o of L.objs) {
      const ox = objX(L, o);
      if (ox > COLS + 0.5 || ox + o.len < -0.5) continue;
      const a = fogAlpha(fogP, L.row, ox, o.len);
      if (a > 0) drawCar(ctx, sx(ox), y, o.len * cs, cs, o.color, L.dir, a);
    } else if (L.type === "river") for (const o of L.objs) {
      const ox = objX(L, o);
      if (ox > COLS + 0.5 || ox + o.len < -0.5) continue;
      drawLog(ctx, sx(ox), y, o.len * cs, cs);
    } else if (L.type === "track") {
      const tr = L.train;
      // Warning light at the side of the track, blinking before and while a train passes.
      const on = tr.state !== "wait" && Math.floor(R.t * 6) % 2 === 0;
      const lx = Math.max(sx(0) + cs * 0.2, 10), ly = y + cs * 0.5;
      ctx.fillStyle = "#3a4a40"; ctx.fillRect(lx - 2, ly - cs * 0.05, 4, cs * 0.45);
      ctx.fillStyle = on ? "#ff5a4f" : "rgba(242,154,154,.35)";
      ctx.beginPath(); ctx.arc(lx, ly - cs * 0.12, cs * 0.13, 0, Math.PI * 2); ctx.fill();
      if (tr.state === "pass") {
        const a = fogAlpha(fogP, L.row, tr.x, 12);
        if (a > 0) drawTrain(ctx, sx(tr.x), y, 12 * cs, cs, L.dir, a);
      }
    }
  }

  function drawTree(ctx, cx, cy, cs, kind) {
    if (kind === "rock") {
      ctx.fillStyle = "#9aa59c"; ctx.strokeStyle = "#5f7166"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx, cy + cs * 0.05, cs * 0.34, cs * 0.26, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      return;
    }
    ctx.fillStyle = "#8a5a34"; ctx.fillRect(cx - cs * 0.05, cy, cs * 0.1, cs * 0.35);
    ctx.fillStyle = "#7fb35a"; ctx.strokeStyle = "#4f7a3a"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy - cs * 0.05, cs * 0.36, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.beginPath(); ctx.arc(cx - cs * 0.12, cy - cs * 0.17, cs * 0.12, 0, Math.PI * 2); ctx.fill();
  }
  function drawStar(ctx, cx, cy, r) {
    ctx.fillStyle = "#f3d36b"; ctx.strokeStyle = "#8a5a34"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k <= 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; ctx[k ? "lineTo" : "moveTo"](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    ctx.fill(); ctx.stroke();
  }
  function drawMailbox(ctx, cx, cy, cs) {
    ctx.fillStyle = "#8a5a34"; ctx.fillRect(cx - cs * 0.04, cy, cs * 0.08, cs * 0.4);
    ctx.fillStyle = "#f29a9a"; ctx.strokeStyle = "#263d30"; ctx.lineWidth = 2;
    rrect(ctx, cx - cs * 0.3, cy - cs * 0.3, cs * 0.6, cs * 0.36, cs * 0.12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#c0392b"; ctx.fillRect(cx + cs * 0.18, cy - cs * 0.42, cs * 0.05, cs * 0.18);
    // A bouncing arrow so kids can spot it.
    ctx.strokeStyle = "#f3d36b"; ctx.lineWidth = 3; const ay = cy - cs * 0.62 + Math.sin(R.t * 6) * 3;
    ctx.beginPath(); ctx.moveTo(cx, ay - cs * 0.18); ctx.lineTo(cx, ay); ctx.moveTo(cx - 5, ay - 5); ctx.lineTo(cx, ay); ctx.lineTo(cx + 5, ay - 5); ctx.stroke();
  }
  function drawCar(ctx, x, y, len, cs, color, dir, alpha) {
    ctx.save(); ctx.globalAlpha = alpha;
    const top = y + cs * 0.17, hgt = cs * 0.66;
    ctx.fillStyle = color; ctx.strokeStyle = "#263d30"; ctx.lineWidth = 2;
    rrect(ctx, x + cs * 0.06, top, len - cs * 0.12, hgt, cs * 0.16); ctx.fill(); ctx.stroke();
    // Windows, toward the front.
    ctx.fillStyle = "rgba(38,61,48,.55)";
    const front = dir > 0 ? x + len - cs * 0.42 : x + cs * 0.16;
    rrect(ctx, front, top + hgt * 0.18, cs * 0.26, hgt * 0.64, 3); ctx.fill();
    if (len > cs * 1.5) { ctx.fillStyle = "rgba(242,240,230,.35)"; ctx.fillRect(dir > 0 ? x + cs * 0.2 : x + cs * 0.75, top + hgt * 0.2, len - cs * 1.05, hgt * 0.6); }
    // Headlights.
    ctx.fillStyle = "#fff6a8";
    const hx = dir > 0 ? x + len - cs * 0.1 : x + cs * 0.1;
    for (const f of [0.22, 0.78]) { ctx.beginPath(); ctx.arc(hx, top + hgt * f, cs * 0.06, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  function drawLog(ctx, x, y, len, cs) {
    const top = y + cs * 0.18, hgt = cs * 0.64;
    ctx.fillStyle = "#a0714a"; ctx.strokeStyle = "#5c3b22"; ctx.lineWidth = 2;
    rrect(ctx, x + cs * 0.04, top, len - cs * 0.08, hgt, hgt / 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "rgba(92,59,34,.6)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x + cs * 0.4, top + hgt * 0.35); ctx.lineTo(x + len - cs * 0.5, top + hgt * 0.35); ctx.moveTo(x + cs * 0.6, top + hgt * 0.68); ctx.lineTo(x + len - cs * 0.35, top + hgt * 0.68); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x + len - cs * 0.22, top + hgt / 2, cs * 0.1, hgt * 0.32, 0, 0, Math.PI * 2); ctx.stroke();
  }
  function drawTrain(ctx, x, y, len, cs, dir, alpha) {
    ctx.save(); ctx.globalAlpha = alpha;
    const top = y + cs * 0.1, hgt = cs * 0.8;
    ctx.fillStyle = "#9fb0c0"; ctx.strokeStyle = "#263d30"; ctx.lineWidth = 2;
    rrect(ctx, x, top, len, hgt, cs * 0.18); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(38,61,48,.5)";
    for (let k = 0.6; k < 11.5; k += 1.3) rrect(ctx, x + k * cs, top + hgt * 0.25, cs * 0.7, hgt * 0.4, 3), ctx.fill();
    ctx.fillStyle = "#f29a9a"; ctx.fillRect(dir > 0 ? x + len - cs * 0.5 : x + cs * 0.1, top + 3, cs * 0.4, hgt - 6);
    ctx.restore();
  }

  function drawPlayer(ctx, p) {
    const P = R.P, cs = F.cell;
    let alpha = R.t < P.inv && Math.floor(R.t * 10) % 2 ? 0.35 : 1;
    let size = cs * 0.78 * (1 + p.lift * 0.18) * (R.twist === 1 ? 1.5 : 1);
    let ox = 0;
    if (P.wobble > R.t) ox = Math.sin(R.t * 80) * 3;
    if (P.float) {
      // The duck paddling: ripples and a timer until it sinks.
      const left = Math.max(0, P.float - R.t) / 2;
      ctx.strokeStyle = "rgba(242,240,230,.6)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.sx, p.sy, cs * (0.42 + (R.t * 0.6) % 0.15), 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "#f29a9a"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.sx, p.sy, cs * 0.52, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left); ctx.stroke();
      size *= 0.9;
    }
    // Shadow while hopping.
    if (p.lift) { ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(p.sx, p.sy + cs * 0.25, cs * 0.25, cs * 0.1, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.save(); ctx.globalAlpha = alpha;
    drawCritter(ctx, R.critter, p.sx + ox, p.sy - p.lift * cs * 0.15, size, P.face, { baby: P.baby, letter: P.letter });
    ctx.restore();
  }

  /* Critters are drawn from above, facing up, then turned to face the way they hop. */
  function drawCritter(c, type, cx, cy, s, face, extra) {
    c.save();
    c.translate(cx, cy);
    c.rotate(FACE[face] || 0);
    c.lineWidth = Math.max(1.5, s * 0.05); c.strokeStyle = "#263d30";
    const eye = (x, y, r) => { c.fillStyle = "#f2f0e6"; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke(); c.fillStyle = "#263d30"; c.beginPath(); c.arc(x, y - r * 0.2, r * 0.5, 0, Math.PI * 2); c.fill(); };
    if (type === "frog") {
      c.fillStyle = "#8fd16a";
      for (const sgn of [-1, 1]) { c.beginPath(); c.ellipse(sgn * s * 0.34, s * 0.28, s * 0.14, s * 0.2, sgn * 0.5, 0, Math.PI * 2); c.fill(); c.stroke(); }
      c.beginPath(); c.ellipse(0, s * 0.04, s * 0.36, s * 0.4, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      eye(-s * 0.17, -s * 0.28, s * 0.12); eye(s * 0.17, -s * 0.28, s * 0.12);
    } else if (type === "chicken") {
      c.fillStyle = "#f2f0e6";
      c.beginPath(); c.ellipse(0, s * 0.05, s * 0.34, s * 0.4, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = "#e05a4f"; c.beginPath(); c.ellipse(0, -s * 0.12, s * 0.07, s * 0.16, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#f5a142"; c.beginPath(); c.moveTo(-s * 0.08, -s * 0.33); c.lineTo(s * 0.08, -s * 0.33); c.lineTo(0, -s * 0.5); c.closePath(); c.fill();
      c.fillStyle = "#263d30"; for (const sgn of [-1, 1]) { c.beginPath(); c.arc(sgn * s * 0.15, -s * 0.24, s * 0.05, 0, Math.PI * 2); c.fill(); }
    } else if (type === "turtle") {
      c.fillStyle = "#b8e986";
      for (const [x, y] of [[-0.3, -0.25], [0.3, -0.25], [-0.3, 0.3], [0.3, 0.3]]) { c.beginPath(); c.arc(x * s, y * s, s * 0.1, 0, Math.PI * 2); c.fill(); c.stroke(); }
      c.beginPath(); c.arc(0, -s * 0.42, s * 0.13, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = "#5f9a45"; c.beginPath(); c.ellipse(0, s * 0.03, s * 0.34, s * 0.38, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.strokeStyle = "rgba(38,61,48,.6)"; c.beginPath();
      for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; c[k ? "lineTo" : "moveTo"](Math.cos(a) * s * 0.15, s * 0.03 + Math.sin(a) * s * 0.17); }
      c.closePath(); c.stroke();
    } else {
      c.fillStyle = "#f3d36b";
      c.beginPath(); c.ellipse(0, s * 0.06, s * 0.33, s * 0.4, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = "#f5a142"; c.beginPath(); c.ellipse(0, -s * 0.38, s * 0.15, s * 0.1, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = "#263d30"; for (const sgn of [-1, 1]) { c.beginPath(); c.arc(sgn * s * 0.15, -s * 0.2, s * 0.05, 0, Math.PI * 2); c.fill(); }
    }
    if (extra.baby) { c.fillStyle = "#f2f0e6"; c.beginPath(); c.arc(0, s * 0.15, s * 0.14, 0, Math.PI * 2); c.fill(); c.stroke(); c.fillStyle = "#263d30"; c.beginPath(); c.arc(-s * 0.05, s * 0.1, s * 0.03, 0, Math.PI * 2); c.arc(s * 0.05, s * 0.1, s * 0.03, 0, Math.PI * 2); c.fill(); }
    if (extra.letter) { c.fillStyle = "#f2f0e6"; c.fillRect(-s * 0.16, s * 0.08, s * 0.32, s * 0.22); c.strokeRect(-s * 0.16, s * 0.08, s * 0.32, s * 0.22); c.beginPath(); c.moveTo(-s * 0.16, s * 0.08); c.lineTo(0, s * 0.2); c.lineTo(s * 0.16, s * 0.08); c.stroke(); }
    c.restore();
  }

  function drawRain(ctx) {
    const w = W(), h = H();
    ctx.strokeStyle = "rgba(159,211,232,.45)"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k < 60; k++) {
      const x = (k * 97 + R.t * 40) % (w + 40) - 20, y = (k * 211 + R.t * 520) % (h + 40) - 20;
      ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 12);
    }
    ctx.stroke();
  }
  // Night: a dark layer with holes for headlights, train lights and a glow around the critter.
  function drawNight(ctx, p, lo, hi) {
    const d = scr.size.dpr, cs = F.cell, w = W(), h = H();
    nctx.setTransform(d, 0, 0, d, 0, 0);
    nctx.globalCompositeOperation = "source-over";
    nctx.clearRect(0, 0, w, h);
    nctx.fillStyle = "rgba(8,12,24,.86)"; nctx.fillRect(0, 0, w, h);
    nctx.globalCompositeOperation = "destination-out";
    const hole = (x, y, r) => { const g = nctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)"); nctx.fillStyle = g; nctx.beginPath(); nctx.arc(x, y, r, 0, Math.PI * 2); nctx.fill(); };
    hole(p.sx, p.sy, cs * 1.5);
    for (let r = Math.max(0, lo); r <= hi && r < R.lanes.length; r++) {
      const L = R.lanes[r], y = sy(r) + cs / 2;
      if (L.type === "road") for (const o of L.objs) {
        const ox = objX(L, o);
        if (ox > COLS + 2 || ox + o.len < -2) continue;
        const fx = sx(L.dir > 0 ? ox + o.len : ox);
        hole(fx + L.dir * cs * 0.9, y, cs * 1.1);
      }
      if (L.type === "track") {
        if (L.train.state !== "wait") hole(Math.max(sx(0) + cs * 0.2, 10), y - cs * 0.12, cs * 0.6);
        if (L.train.state === "pass") hole(sx(L.dir > 0 ? L.train.x + 12 : L.train.x) + L.dir * cs, y, cs * 1.6);
      }
      if (L.mailbox != null || (L.type === "finish" && r === R.finishRow)) hole(sx(L.mailbox != null ? L.mailbox + 0.5 : COLS / 2), y, cs * (L.mailbox != null ? 0.9 : 0.6));
    }
    ctx.drawImage(night, 0, 0, w, h);
  }
  // The chalk eraser along the bottom of the screen in endless mode.
  function drawEraser(ctx, p) {
    const cs = F.cell, w = W(), h = H(), eh = cs * 0.42;
    const danger = p.row - R.camY < 1.2;
    ctx.fillStyle = "rgba(242,240,230,.12)"; ctx.fillRect(0, h - eh - cs * 0.25, w, cs * 0.25);
    ctx.fillStyle = danger && Math.floor(R.t * 6) % 2 ? "#c0392b" : "#8a5a34";
    ctx.fillRect(0, h - eh, w, eh * 0.45);
    ctx.fillStyle = "#6b7a72"; ctx.fillRect(0, h - eh * 0.55, w, eh * 0.55);
  }

  /* ---------- Register with the arcade ---------- */
  A.registerGame({
    id: ID,
    name: "Critter Crossing",
    accent: ACCENT,
    twists: TWISTS,
    icon: `<path d="M4 16 H44 M4 32 H44"/><path d="M8 24 H14 M20 24 H26 M32 24 H38" stroke-dasharray="1 0"/>
    <circle class="acc" cx="24" cy="40" r="4"/><circle class="accf" cx="22.5" cy="38.5" r="1"/><circle class="accf" cx="25.5" cy="38.5" r="1"/>
    <rect x="30" y="8" width="11" height="6" rx="2"/>`,
    open: showMenu,
    _round: () => R, // read-only peek at the run in progress, for testing
    badge: () => (todayTwist() ? "Daily twist" : null),
    tileStat(playerId) {
      const best = Act.scores.bestAny(ID, playerId), stars = (missions[playerId] || []).reduce((s, n) => s + (n || 0), 0);
      if (!best && !stars) return null;
      return [best ? `Best: ${best}` : "", stars ? `★ ${stars}` : ""].filter(Boolean).join(" · ");
    },
    resetStats() { Act.scores.reset(ID); missions = {}; saveMissions(); },
    forgetPlayer(id) {
      Act.scores.forgetPlayer(ID, id);
      delete missions[id]; delete prefs[id];
      saveMissions(); savePrefs();
    }
  });
})();

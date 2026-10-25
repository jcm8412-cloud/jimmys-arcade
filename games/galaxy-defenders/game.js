/* Galaxy Defenders: a space shooter. Steer the ship (it fires by itself) through sectors of 5 alien waves
   and a boss, picking an upgrade card after every wave. 1 player, or 2-player co-op on one screen.
   Built on the shared action kit (Arcade.Action).
   High score: points in one run, per player and level (single player only).
   Saved data: galaxy-defenders:sectors {playerId: {level: highest sector reached}} (co-op runs count too),
   galaxy-defenders:lastSetup and galaxy-defenders:coopLevel. Guests aren't recorded. */
(function () {
  const A = window.Arcade, Act = A.Action;
  const $ = id => document.getElementById(id);
  const esc = A.esc;
  const ID = "galaxy-defenders";
  const ACCENT = "#b79cff";
  const WAVES = 5;                // waves per sector; then the boss
  const SHIP_COLORS = ["#9fd3e8", "#f3d36b"];
  const TWISTS = ["Aliens twice as fast, huge shots", "Every upgrade is a surprise", "One-hit run, triple points"];
  const POINTS = { grunt: 10, dodger: 15, splitter: 15, small: 5, diver: 20, shield: 25 };

  // speed: alien movement. fire: alien shots per second (wave 1). shot: alien shot speed, as a share of the
  // screen height per second. hit: the ship's bump radius (px). boss: boss health. dive: time between dives.
  const LEVELS = {
    easy: { name: "Easy", desc: "Slower aliens, 3 lives", speed: 0.78, fire: 0.58, shot: 0.23, lives: 3, hit: 7, boss: 0.82, dive: 1.25 },
    medium: { name: "Medium", desc: "A fair fight, 3 lives", speed: 0.9, fire: 0.75, shot: 0.26, lives: 3, hit: 8, boss: 1, dive: 1 },
    hard: { name: "Hard", desc: "Busy skies, 3 lives", speed: 1.1, fire: 1.05, shot: 0.32, lives: 3, hit: 10, boss: 1.25, dive: 0.8 },
    impossible: { name: "Impossible", desc: "A storm of aliens, 2 lives", speed: 1.3, fire: 1.4, shot: 0.38, lives: 2, hit: 11, boss: 1.5, dive: 0.65 }
  };

  const UPGRADES = {
    double: { name: "Double shot", desc: "One more cannon", max: 3 },
    spread: { name: "Spread shot", desc: "Shots fan out", max: 2 },
    rapid: { name: "Faster fire", desc: "Shoot more often", max: 4 },
    pierce: { name: "Piercing shots", desc: "Shots go through aliens", max: 3 },
    side: { name: "Side cannons", desc: "Shoot out to the sides", max: 2 },
    drone: { name: "Drone buddy", desc: "A helper that shoots too", max: 2 },
    shield: { name: "Shield bubble", desc: "Blocks one hit", max: 3 },
    magnet: { name: "Magnet", desc: "Pulls in score gems", max: 2 },
    life: { name: "Extra life", desc: "One more life", max: 6, chance: 0.2 } // one of the cards after about 1 wave in 5 (it used to be about 1 in 3)
  };

  // Each sector ends with a different boss, each with its own attack patterns. After the fifth they come round again, tougher.
  const BOSSES = [
    { name: "Mothership Mo", color: "#9fd3e8", shape: "saucer", patterns: ["fan", "summon"] },
    { name: "Squiddo", color: "#d7b4f3", shape: "squid", patterns: ["aimed", "rain", "laser"] },
    { name: "Star Crab", color: "#ff8a65", shape: "crab", patterns: ["spiral", "fan", "charge"] },
    { name: "Comet King", color: "#f3d36b", shape: "king", patterns: ["laser", "aimed", "rain"] },
    { name: "Galaxy Brain", color: "#f29a9a", shape: "brain", patterns: ["spiral", "laser", "summon"] }
  ];

  let sectors = A.store.get("galaxy-defenders:sectors", {});
  const saveSectors = () => A.store.set("galaxy-defenders:sectors", sectors);
  const bestSector = (pid, level) => (pid && sectors[pid] && sectors[pid][level]) || 0;
  const bestSectorAny = pid => Math.max(0, ...Object.values((pid && sectors[pid]) || {}));

  /* ---------- Menu screens ---------- */
  const home = `<button class="icon-btn" data-home aria-label="Home"></button>`;
  const back = `<button class="back-link" data-gd-back>‹ Galaxy Defenders</button>`;
  const seg = (id, items) => `<div class="seg" role="radiogroup" id="${id}">${items.map(([v, label]) => `<button type="button" role="radio" data-v="${v}">${label}</button>`).join("")}</div>`;
  const diffItems = Object.entries(LEVELS).map(([k, l]) => [k, l.name]);
  $("game-root").insertAdjacentHTML("beforeend", `
  <section class="screen gd menu" id="gd-menu" hidden>
    <header class="topbar"><div class="tb-left">${home}</div><h2></h2><div class="tb-right"></div></header>
    <h1 class="title">Galaxy <span>Defenders</span></h1>
    <p class="tagline">Steer your ship. It fires all by itself!</p>
    <div class="menu-buttons">
      <button class="btn big" id="gd-btn-play">1 player</button>
      <button class="btn big daily" id="gd-btn-daily" hidden></button>
      <button class="btn big" id="gd-btn-coop">2 players (team up)</button>
      <button class="btn ghost" id="gd-btn-top">Top scores</button>
    </div>
  </section>

  <section class="screen gd" id="gd-levels" hidden>
    <header class="topbar"><div class="tb-left">${home}${back}</div><h2>Pick a level</h2><div class="tb-right"></div></header>
    <div class="playing-as" id="gd-playing-as"></div>
    <div class="levels" id="gd-level-list"></div>
  </section>

  <section class="screen gd" id="gd-setup" hidden>
    <header class="topbar"><div class="tb-left">${home}${back}</div><h2>2 players</h2><div class="tb-right"></div></header>
    <p class="note">Two ships, one team. The first player steers on the left half of the screen, the second on the right. Upgrades go to both ships.</p>
    ${seg("gd-coop-level", diffItems)}
    <h3 class="label">Pick two players</h3>
    <div id="gd-picker"></div>
    <p class="err" id="gd-setup-err" aria-live="polite"></p>
    <button class="btn big" id="gd-start">Start</button>
  </section>

  <section class="screen gd" id="gd-top" hidden>
    <header class="topbar"><div class="tb-left">${home}${back}</div><h2>Top scores</h2><div class="tb-right"></div></header>
    ${seg("gd-top-level", diffItems.concat([["daily", "Today"]]))}
    <div id="gd-top-list"></div>
  </section>`);

  const scr = Act.createScreen({
    id: "gd-play", cls: "gd",
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
    $("gd-btn-daily").hidden = !d;
    if (d) $("gd-btn-daily").innerHTML = `Daily twist<small>${esc(d.name)}</small>`;
    A.show("gd-menu");
  }
  document.querySelectorAll("[data-gd-back]").forEach(b => b.addEventListener("click", showMenu));
  $("gd-btn-play").addEventListener("click", () => A.whoIsPlaying({ onDone: showLevels, onBack: showMenu, backLabel: "Galaxy Defenders" }));
  $("gd-btn-daily").addEventListener("click", () => A.whoIsPlaying({
    onDone: p => startRun({ level: "medium", players: [p], twist: todayTwist() }), onBack: showMenu, backLabel: "Galaxy Defenders"
  }));
  $("gd-btn-coop").addEventListener("click", showSetup);
  $("gd-btn-top").addEventListener("click", () => showTop("easy"));

  function showLevels() {
    const p = A.session.player;
    $("gd-playing-as").innerHTML = `${A.avatarSvg(p)}<span>Playing: <b>${esc(p.name)}</b></span>
      <button class="btn ghost" id="gd-switch">Switch</button>`;
    $("gd-switch").addEventListener("click", () => A.whoIsPlaying({ force: true, onDone: showLevels, onBack: showLevels, backLabel: "Levels" }));
    const box = $("gd-level-list");
    box.innerHTML = "";
    for (const [id, lv] of Object.entries(LEVELS)) {
      const best = Act.scores.best(ID, id, p.id), sec = bestSector(p.id, id);
      const b = document.createElement("button");
      b.className = "level" + (id === "impossible" ? " impossible" : "");
      b.innerHTML = `<b>${lv.name}</b><small>${lv.desc}</small>
        <span class="stats" aria-hidden="true"><span>${best}</span><span>${sec || "–"}</span><i>best</i><i>sector</i></span>`;
      b.setAttribute("aria-label", `${lv.name}: ${lv.desc}. Best score ${best}, furthest sector ${sec || "none yet"}.`);
      b.addEventListener("click", () => startRun({ level: id, players: [p] }));
      box.appendChild(b);
    }
    A.setAccent(ACCENT);
    A.show("gd-levels");
  }

  let picker = null, coopLevel = A.store.get("galaxy-defenders:coopLevel", "easy");
  function showSetup() {
    A.setAccent(ACCENT);
    paintSeg("gd-coop-level", coopLevel);
    $("gd-setup-err").textContent = "";
    picker = A.playerPicker($("gd-picker"), { min: 2, max: 2, initial: A.store.get("galaxy-defenders:lastSetup", []), onChange: () => { $("gd-setup-err").textContent = ""; } });
    A.show("gd-setup");
  }
  $("gd-coop-level").querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
    coopLevel = b.dataset.v; A.store.set("galaxy-defenders:coopLevel", coopLevel); paintSeg("gd-coop-level", coopLevel);
  }));
  $("gd-start").addEventListener("click", () => {
    if (picker.count() < 2) { $("gd-setup-err").textContent = "Pick 2 players."; return; }
    A.store.set("galaxy-defenders:lastSetup", picker.entries());
    startRun({ level: coopLevel, players: picker.get() });
  });

  function showTop(level) {
    paintSeg("gd-top-level", level);
    const list = level === "daily" ? Act.scores.dailyTop(ID) : Act.scores.top(ID, level);
    const d = todayTwist();
    $("gd-top-list").innerHTML = (level === "daily" ? `<p class="note">${d ? `Today's twist: ${esc(d.name)}` : "Galaxy Defenders isn't today's daily twist."}</p>` : "")
      + `<p class="note">Points in one run, playing alone.</p>` + Act.topListHtml(list, -1);
    A.setAccent(ACCENT);
    A.show("gd-top");
  }
  $("gd-top-level").querySelectorAll("button").forEach(b => b.addEventListener("click", () => showTop(b.dataset.v)));

  /* ---------- Run state ----------
     R: { opts, level, cfg, twist, twistName, coop, ships, up {double, spread, rapid, pierce, side, drone, magnet},
          sector, wave (1–5, or 6 for the boss), aliens, boss, shots (ours), bolts (theirs), lasers, gems,
          score, t, waveT, form {t, sway, descend}, state ("play" | "pick" | "over"), picker (co-op: who picks next) }
     ship: { idx, profile, color, x, vx, lives, shield, inv, alive, fireT, volley, droneT }
     alien: { type, col, row, x, y, r, hp, state ("enter" | "form" | "dive" | "free"), t, fromX, fromY, vx, vy,
              dodge, dodgeTo, dodgeT, shield, flash } */
  let R = null;
  const dustFx = Act.dust(80);
  const F = {};

  function startRun(opts) {
    const cfg = LEVELS[opts.level];
    const twist = opts.twist ? opts.twist.twist : -1;
    R = {
      opts, level: opts.level, cfg, twist, twistName: opts.twist ? opts.twist.name : "", coop: opts.players.length > 1,
      up: { double: 0, spread: 0, rapid: 0, pierce: 0, side: 0, drone: 0, magnet: 0 },
      sector: 1, wave: 1, aliens: [], boss: null, shots: [], bolts: [], lasers: [], gems: [],
      score: 0, t: 0, waveT: 0, state: "play", picker: 0, shieldHint: false,
      stars: Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), s: 0.3 + Math.random() * 0.7 }))
    };
    R.ships = opts.players.map((p, i) => ({
      idx: i, profile: p, color: SHIP_COLORS[i], x: 0, vx: 0, lastX: 0, target: null,
      lives: twist === 2 ? 1 : cfg.lives, shield: 0, inv: 0, alive: true, fireT: 0.3, volley: 0, droneT: 0.2
    }));
    A.setAccent(ACCENT);
    scr.section.classList.toggle("coop", R.coop);
    scr.show();
    requestAnimationFrame(startWave);
  }
  function restart() { if (R) startRun(R.opts); }

  /* ---------- Geometry ---------- */
  const W = () => scr.size.w, H = () => scr.size.h;
  function layout() {
    F.shipY = H() - Math.max(40, H() * 0.07);
    F.cols = W() >= 600 ? 8 : 6;
    F.sp = Math.min((W() - 40) / F.cols, 56);
    for (const s of R.ships || []) s.x = Math.max(20, Math.min(W() - 20, s.x));
  }
  const fast = () => (R.twist === 0 ? 2 : 1);                   // daily twist: aliens twice as fast
  const points = n => n * R.sector * (R.twist === 2 ? 3 : 1);   // daily twist: triple points

  /* ---------- Waves ---------- */
  const diff = () => (R.sector - 1) * WAVES + (R.wave - 1);      // 0, 1, 2… across the whole run
  function startWave() {
    R.aliens = []; R.bolts = []; R.lasers = []; R.boss = null; R.shots = [];
    R.form = { t: 0, descend: 0 };
    R.waveT = 0; R.fireAcc = 0; R.diveT = 2.5; R.state = "play";
    scr.start(update, render); // sizes the canvas (and calls layout) first, then the countdown
    if (!R.placed) { R.placed = true; R.ships.forEach((s, i) => { s.x = s.lastX = W() * (R.coop ? (i ? 0.7 : 0.3) : 0.5); }); }
    if (R.wave > WAVES) {
      const k = (R.sector - 1) % BOSSES.length, def = BOSSES[k];
      const hp = Math.round(70 * (1 + 0.6 * (R.sector - 1)) * R.cfg.boss);
      R.boss = { def, x: W() / 2, y: -80, baseY: Math.max(90, H() * 0.16), w: Math.min(W() * 0.42, 190), h: Math.min(W() * 0.26, 110),
        hp, max: hp, t: 0, pi: 0, pt: -1.5, flash: 0, dead: false, shotT: 0, beamT: 0 };
      R.banner = `Boss: ${def.name}!`;
    } else {
      spawnFormation();
      R.banner = `Sector ${R.sector} · Wave ${R.wave}`;
    }
    updateHud();
  }
  function spawnFormation() {
    const d = diff(), cols = F.cols, rows = Math.min(5, 2 + Math.floor(d / 2));
    const kinds = ["grunt"];
    if (d >= 1) kinds.push("dodger");
    if (d >= 2) kinds.push("splitter");
    if (d >= 3) kinds.push("diver");
    if (d >= 5) kinds.push("shield");
    const hp = 1 + Math.floor((R.sector - 1) / 2);
    for (let row = 0; row < rows; row++) {
      // Each row is one kind; grunts are the most common, and the first wave is all grunts.
      const type = d === 0 || Math.random() < 0.35 ? "grunt" : kinds[Math.floor(Math.random() * kinds.length)];
      for (let col = 0; col < cols; col++) {
        R.aliens.push({ type, col, row, x: 0, y: 0, r: F.sp * 0.32, hp, state: "enter", t: -(row * cols + col) * 0.04,
          fromX: W() / 2 + (col - cols / 2) * F.sp * 1.6, fromY: -40 - row * 30, vx: 0, vy: 0,
          dodge: 0, dodgeTo: 0, dodgeT: 0, shield: type === "shield", flash: 0 });
      }
    }
    if (kinds.includes("shield") && !R.shieldHint && R.aliens.some(a => a.shield)) { R.shieldHint = true; R.hintT = 1.4; }
  }
  // Where an alien's place in the formation is right now.
  function slot(a) {
    const width = F.sp * (F.cols - 1), amp = Math.max(0, (W() - 40 - width) / 2);
    const fx = W() / 2 + Math.sin(R.form.t * 0.7) * amp;
    return { x: fx - width / 2 + a.col * F.sp + a.dodge, y: 70 + R.form.descend + a.row * F.sp * 0.85 };
  }

  /* ---------- Input: drag anywhere to steer (co-op: each player on their own half) ---------- */
  const drags = new Map(); // pointerId -> { ship, fx, sx }
  const local = e => { const r = scr.stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  scr.stage.addEventListener("pointerdown", e => {
    // Only presses on the sky itself steer. Grabbing the pointer for a press on the upgrade cards or the
    // Paused buttons would send the click to the stage instead, and the button would never get it.
    if (!R || e.target !== scr.canvas) return;
    const { x } = local(e);
    const s = R.coop ? R.ships[x < W() / 2 ? 0 : 1] : R.ships[0];
    if (!s || !s.alive) return;
    drags.set(e.pointerId, { ship: s.idx, fx: x, sx: s.x });
    try { scr.stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    e.preventDefault();
  });
  scr.stage.addEventListener("pointermove", e => {
    const d = drags.get(e.pointerId);
    if (!d || !R) return;
    // The ship moves with the finger (not under it), so small fingers don't hide it.
    R.ships[d.ship].target = d.sx + (local(e).x - d.fx) * 1.3;
  });
  const lift = e => drags.delete(e.pointerId);
  scr.stage.addEventListener("pointerup", lift);
  scr.stage.addEventListener("pointercancel", lift);
  const keysDown = new Set();
  document.addEventListener("keydown", e => {
    if (A.currentScreen !== "gd-play" || A.dialogOpen()) return;
    // Keys 1, 2 and 3 pick an upgrade card.
    if (R && R.state === "pick" && ["1", "2", "3"].includes(e.key)) {
      const card = $("gd-play-panel").querySelectorAll(".gd-card")[+e.key - 1];
      if (card && !$("gd-play-panel").hidden) { e.preventDefault(); pickCard(card.dataset.up); }
      return;
    }
    if (["ArrowLeft", "ArrowRight", "a", "d", "A", "D"].includes(e.key)) { keysDown.add(e.key.toLowerCase()); e.preventDefault(); }
  });
  document.addEventListener("keyup", e => keysDown.delete(e.key.toLowerCase()));

  /* ---------- Update ---------- */
  function update(dt) {
    if (R.state !== "play") return;
    R.t += dt; R.waveT += dt;
    if (R.banner) { scr.message(R.banner, 1200); R.banner = null; } // after the countdown, so they don't overlap
    if (R.hintT && (R.hintT -= dt) <= 0) { R.hintT = 0; scr.message("Shields! Move while shooting to hit them from the side", 2200); }
    for (const st of R.stars) st.y = (st.y + dt * 0.02 * st.s) % 1;
    moveShips(dt);
    if (R.boss) updateBoss(dt); else updateAliens(dt);
    updateShots(dt);
    if (R.state !== "play") return;
    updateBolts(dt);
    if (R.state !== "play") return;
    updateGems(dt);
    dustFx.update(dt);
    if (!R.boss && !R.aliens.length) waveCleared();
    updateHud();
  }

  function moveShips(dt) {
    for (const s of R.ships) {
      if (!s.alive) continue;
      let target = s.target;
      const keys = s.idx === 0 ? ["arrowleft", "arrowright"] : ["a", "d"];
      if (!R.coop && !keysDown.has("arrowleft") && !keysDown.has("arrowright")) { keys[0] = "a"; keys[1] = "d"; } // one player: either set
      if (keysDown.has(keys[0])) target = s.x - 900 * dt;
      if (keysDown.has(keys[1])) target = s.x + 900 * dt;
      if (target != null) {
        const max = 1600 * dt; // smooth, but quick enough to keep up with a finger
        s.x += Math.max(-max, Math.min(max, Math.max(20, Math.min(W() - 20, target)) - s.x));
        if (keysDown.size) s.target = null;
      }
      s.vx = s.vx * 0.7 + ((s.x - s.lastX) / dt) * 0.3;
      s.lastX = s.x;
      // Auto-fire.
      s.fireT -= dt;
      if (s.fireT <= 0) { volley(s); s.fireT += 0.34 * Math.pow(0.82, R.up.rapid); }
      if (R.up.drone) {
        s.droneT -= dt;
        if (s.droneT <= 0) {
          s.droneT += 0.45;
          for (let k = 0; k < R.up.drone; k++) shoot(s.x + (k ? 34 : -34), F.shipY - 4, 0, -H() * 0.9);
        }
      }
    }
  }
  function shoot(x, y, vx, vy) {
    R.shots.push({ x, y, vx, vy, r: R.twist === 0 ? 10 : 3.5, pierce: R.up.pierce, hit: null });
  }
  // One round of shots. Moving while shooting tilts the shots a little (that's how to hit shields from the side).
  function volley(s) {
    const vy = -H() * 0.95, y = F.shipY - 16;
    const tilt = Math.max(-0.35, Math.min(0.35, s.vx * 0.3 / Math.abs(vy))) * Math.abs(vy);
    const n = 1 + R.up.double;
    for (let i = 0; i < n; i++) shoot(s.x + (i - (n - 1) / 2) * 9, y, tilt, vy);
    for (let k = 1; k <= R.up.spread; k++) for (const sgn of [-1, 1]) {
      const a = sgn * 0.22 * k;
      shoot(s.x, y, tilt + Math.sin(a) * Math.abs(vy), vy * Math.cos(a));
    }
    if (R.up.side && s.volley % (R.up.side >= 2 ? 1 : 2) === 0) for (const sgn of [-1, 1]) {
      shoot(s.x + sgn * 14, F.shipY - 4, sgn * Math.sin(0.7) * Math.abs(vy), vy * Math.cos(0.7));
    }
    s.volley++;
  }

  function aliveShips() { return R.ships.filter(s => s.alive); }
  function nearestShip(x) { return aliveShips().sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0]; }

  function updateAliens(dt) {
    const sp = R.cfg.speed * fast();
    R.form.t += dt * sp;
    R.form.descend = Math.min(H() * (0.08 + Math.min(diff(), 10) * 0.012), R.form.descend + dt * 3 * sp);
    for (const a of R.aliens) {
      if (a.flash > 0) a.flash -= dt;
      const home = slot(a);
      if (a.state === "enter") {
        a.t += dt * sp * 1.2;
        const f = Math.max(0, Math.min(1, a.t));
        const e = 1 - Math.pow(1 - f, 3);
        a.x = a.fromX + (home.x - a.fromX) * e; a.y = a.fromY + (home.y - a.fromY) * e;
        if (f >= 1) a.state = "form";
      } else if (a.state === "form") {
        a.x = home.x; a.y = home.y;
      } else if (a.state === "dive") {
        // Swoop down, curving toward the nearest ship, then come back in from the top.
        const s = nearestShip(a.x), tx = s ? s.x : W() / 2;
        const want = Math.sign(tx - a.x) * Math.min(Math.abs(tx - a.x) * 2, 230 * sp);
        a.vx += (want - a.vx) * Math.min(1, dt * 2);
        a.x += a.vx * dt; a.y += a.vy * dt;
        if (a.y > H() + 30) { a.state = "enter"; a.t = 0; a.fromX = home.x; a.fromY = -30; }
      } else if (a.state === "free") {
        // Little splitter halves zip around the upper sky.
        a.x += a.vx * dt * sp; a.y += a.vy * dt * sp;
        if (a.x < 15 || a.x > W() - 15) a.vx = -a.vx;
        if (a.y < 50 || a.y > H() * 0.55) a.vy = -a.vy;
        a.x = Math.max(15, Math.min(W() - 15, a.x)); a.y = Math.max(50, Math.min(H() * 0.55, a.y));
      }
      // Dodgers slide sideways when a shot is lined up under them.
      if (a.type === "dodger" && a.state === "form") {
        if (R.t > a.dodgeT && R.shots.some(b => b.y > a.y && b.y - a.y < 220 && Math.abs(b.x - a.x) < a.r * 1.3)) {
          const dir = R.shots.find(b => b.y > a.y && Math.abs(b.x - a.x) < a.r * 1.3).x < a.x ? 1 : -1;
          a.dodgeTo = dir * F.sp * 0.75; a.dodgeT = R.t + 1.4 / sp; a.dodgeBack = R.t + 0.9;
        }
        if (a.dodgeBack && R.t > a.dodgeBack) { a.dodgeTo = 0; a.dodgeBack = 0; }
        a.dodge += (a.dodgeTo - a.dodge) * Math.min(1, dt * 8);
      }
      // Bumping into a ship.
      for (const s of R.ships) if (s.alive && R.t > s.inv && Math.hypot(a.x - s.x, a.y - F.shipY) < a.r + R.cfg.hit + 4) { killAlien(a, false); hitShip(s); }
    }
    R.aliens = R.aliens.filter(a => !a.dead);
    // Alien shots: slow blobs dropped from the formation.
    const d = diff();
    R.fireAcc += dt * R.cfg.fire * (1 + d * 0.12) * fast();
    while (R.fireAcc >= 1) {
      R.fireAcc -= 1;
      const shooters = R.aliens.filter(a => a.state === "form" && a.type !== "diver");
      if (shooters.length) { const a = shooters[Math.floor(Math.random() * shooters.length)]; bolt(a.x, a.y + a.r, 0, H() * R.cfg.shot); }
    }
    // Every so often one breaks off to dive at the ships (divers most of all).
    R.diveT -= dt * fast();
    if (R.diveT <= 0 && R.waveT > 2) {
      R.diveT = 3.2 * R.cfg.dive / (1 + d * 0.08);
      const ready = R.aliens.filter(a => a.state === "form");
      const divers = ready.filter(a => a.type === "diver");
      const pick = divers.length && Math.random() < 0.8 ? divers : d >= 4 ? ready : [];
      if (pick.length) { const a = pick[Math.floor(Math.random() * pick.length)]; a.state = "dive"; a.vx = 0; a.vy = H() * 0.32 * R.cfg.speed * fast(); }
    }
  }
  function bolt(x, y, vx, vy) { R.bolts.push({ x, y, vx: vx * (R.twist === 0 ? 1.4 : 1), vy: vy * (R.twist === 0 ? 1.4 : 1), r: 5 }); }

  function killAlien(a, scored) {
    if (a.dead) return;
    a.dead = true;
    const color = ALIEN_COLORS[a.type];
    dustFx.emit(a.x, a.y, color, 8);
    if (scored) {
      R.score += points(POINTS[a.type]);
      if (Math.random() < (a.type === "shield" ? 0.5 : 0.28)) R.gems.push({ x: a.x, y: a.y, vy: 90, value: points(10) });
    }
    if (a.type === "splitter") {
      // Splits into two small aliens.
      for (const sgn of [-1, 1]) R.aliens.push({ type: "small", x: a.x + sgn * a.r * 0.5, y: a.y, r: a.r * 0.6, hp: 1, state: "free", t: 0,
        vx: sgn * (90 + Math.random() * 50), vy: 40 + Math.random() * 40, dodge: 0, dodgeTo: 0, dodgeT: 0, shield: false, flash: 0 });
    }
    A.sfx.right();
  }

  function updateShots(dt) {
    const h = H();
    for (const b of R.shots) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y < -20 || b.x < -20 || b.x > W() + 20) { b.gone = true; continue; }
      if (R.boss) { hitBoss(b); continue; }
      for (const a of R.aliens) {
        if (a.dead || b.gone || (b.hit && b.hit.has(a))) continue;
        if (Math.hypot(a.x - b.x, a.y - b.y) > a.r + b.r) continue;
        // Shield aliens block straight shots from the front; a tilted shot knocks the shield away.
        if (a.shield) {
          if (Math.abs(b.vx) < Math.abs(b.vy) * 0.15) { b.gone = true; dustFx.emit(b.x, b.y, "#f2f0e6", 3); break; }
          a.shield = false; a.flash = 0.12; b.gone = true; dustFx.emit(a.x, a.y + a.r, "#9fd3e8", 6); break;
        }
        a.hp--; a.flash = 0.1;
        if (a.hp <= 0) killAlien(a, true);
        if (b.pierce > 0) { b.pierce--; (b.hit = b.hit || new Set()).add(a); } else { b.gone = true; break; }
      }
    }
    R.shots = R.shots.filter(b => !b.gone && b.y < h + 20);
    R.aliens = R.aliens.filter(a => !a.dead);
  }

  function updateBolts(dt) {
    for (const k of R.bolts) {
      k.x += k.vx * dt; k.y += k.vy * dt;
      if (k.y > H() + 20 || k.y < -40 || k.x < -40 || k.x > W() + 40) { k.gone = true; continue; }
      for (const s of R.ships) if (s.alive && R.t > s.inv && Math.hypot(k.x - s.x, k.y - F.shipY) < k.r + R.cfg.hit) { k.gone = true; hitShip(s); }
    }
    R.bolts = R.bolts.filter(k => !k.gone);
    for (const L of R.lasers) {
      if (R.t < L.on || R.t > L.off) continue;
      for (const s of R.ships) if (s.alive && R.t > s.inv && Math.abs(s.x - L.x) < 16 + R.cfg.hit) hitShip(s);
    }
    R.lasers = R.lasers.filter(L => R.t < L.off);
  }

  function updateGems(dt) {
    const reach = [0, 110, 200][R.up.magnet];
    for (const g of R.gems) {
      const s = nearestShip(g.x);
      const d = s ? Math.hypot(s.x - g.x, F.shipY - g.y) : Infinity;
      if (s && d < reach) { g.x += (s.x - g.x) / d * 380 * dt; g.y += (F.shipY - g.y) / d * 380 * dt; } else g.y += g.vy * dt;
      if (d < 26) { g.got = true; R.score += g.value; A.sfx.right(); dustFx.emit(g.x, g.y, "#f3d36b", 5); }
    }
    R.gems = R.gems.filter(g => !g.got && g.y < H() + 20);
  }

  function hitShip(s) {
    if (!s.alive || R.t < s.inv || R.state !== "play") return;
    // Clear nearby alien shots, so one mistake doesn't cost two lives.
    R.bolts = R.bolts.filter(k => Math.hypot(k.x - s.x, k.y - F.shipY) > 120);
    if (s.shield > 0) { s.shield--; s.inv = R.t + 1; scr.message("Shield!", 600); A.sfx.wrong(); return; }
    s.lives--;
    s.inv = R.t + 2.5;
    A.sfx.lose(); A.buzz();
    dustFx.emit(s.x, F.shipY, s.color, 14);
    if (s.lives <= 0) {
      s.alive = false;
      if (!aliveShips().length) return gameOver();
      scr.message(`${s.profile.name} is out!`, 1200);
    } else scr.message("Ouch!", 700);
  }

  /* ---------- Bosses ---------- */
  function updateBoss(dt) {
    const B = R.boss, sp = R.cfg.speed * fast();
    if (B.dead) return; // the gems are falling; the cards come next
    B.t += dt; B.pt += dt * fast();
    if (B.flash > 0) B.flash -= dt;
    // Glide in, then sway along the top (except while charging).
    if (B.y < B.baseY && B.pattern !== "charge") B.y = Math.min(B.baseY, B.y + 90 * dt);
    B.x = W() / 2 + Math.sin(B.t * 0.55 * sp) * Math.max(0, W() / 2 - B.w / 2 - 10);
    if (B.pt < 0) { B.pattern = null; return; }
    const pats = B.def.patterns;
    if (!B.pattern) { B.pattern = pats[B.pi % pats.length]; B.pi++; B.shotT = 0; B.done = false; }
    const p = B.pattern, shotV = H() * R.cfg.shot;
    B.shotT -= dt * fast();
    const target = nearestShip(B.x) || { x: W() / 2 };
    if (p === "fan" && B.shotT <= 0 && B.pt < 3) {
      B.shotT = 1;
      const n = 5 + Math.min(4, R.sector - 1);
      for (let k = 0; k < n; k++) { const a = (k / (n - 1) - 0.5) * 1.3; bolt(B.x, B.y + B.h / 3, Math.sin(a) * shotV * 1.2, Math.cos(a) * shotV * 1.2); }
    } else if (p === "aimed" && B.shotT <= 0 && B.pt < 3) {
      B.shotT = 0.35;
      const dx = target.x - B.x, dy = F.shipY - B.y, d = Math.hypot(dx, dy);
      bolt(B.x, B.y + B.h / 3, dx / d * shotV * 1.5, dy / d * shotV * 1.5);
    } else if (p === "rain" && B.shotT <= 0 && B.pt < 2.6) {
      B.shotT = 0.14 / R.cfg.speed;
      bolt(20 + Math.random() * (W() - 40), -10, 0, shotV * 1.1);
    } else if (p === "spiral" && B.shotT <= 0 && B.pt < 3) {
      B.shotT = 0.09;
      for (const off of [0, Math.PI]) { const a = B.pt * 3 + off; bolt(B.x, B.y, Math.cos(a) * shotV, Math.abs(Math.sin(a)) * shotV + shotV * 0.3); }
    } else if (p === "summon" && !B.done) {
      B.done = true;
      for (let k = 0; k < 3 + Math.min(2, R.sector - 1); k++) {
        R.aliens.push({ type: "diver", x: B.x + (k - 1) * 30, y: B.y + B.h / 2, r: F.sp * 0.3, hp: 1, state: "dive", t: 0,
          vx: (k - 1) * 60, vy: H() * 0.3 * R.cfg.speed * fast(), dodge: 0, dodgeTo: 0, dodgeT: 0, shield: false, flash: 0, minion: true });
      }
    } else if (p === "laser" && !B.done) {
      // A dashed warning line first, then the beam.
      B.done = true;
      const n = R.sector >= 3 ? 2 : 1;
      for (let k = 0; k < n; k++) R.lasers.push({ x: Math.max(20, Math.min(W() - 20, target.x + (k ? (Math.random() < 0.5 ? -90 : 90) : 0))), on: R.t + 1.1 / Math.sqrt(fast()), off: R.t + 1.1 / Math.sqrt(fast()) + 0.7 });
    } else if (p === "charge") {
      // Swoop down toward the ships and back up.
      const f = B.pt / 2.2;
      B.y = B.baseY + Math.sin(Math.min(1, f) * Math.PI) * (F.shipY - B.baseY - B.h * 0.7);
      for (const s of R.ships) if (s.alive && R.t > s.inv && Math.abs(s.x - B.x) < B.w * 0.42 && Math.abs(F.shipY - B.y) < B.h * 0.5) hitShip(s);
    }
    // Minions from "summon" use the alien code.
    if (R.aliens.length) updateMinions(dt);
    if (B.pt > (p === "charge" ? 2.4 : 3.2)) { B.pt = -1.3; B.pattern = null; if (p === "charge") B.y = B.baseY; }
  }
  function updateMinions(dt) {
    for (const a of R.aliens) {
      if (a.flash > 0) a.flash -= dt;
      const s = nearestShip(a.x), tx = s ? s.x : W() / 2;
      a.vx += (Math.sign(tx - a.x) * 200 - a.vx) * Math.min(1, dt * 1.5);
      a.x += a.vx * dt; a.y += a.vy * dt;
      if (a.y > H() + 30) a.dead = true;
      for (const sh of R.ships) if (sh.alive && R.t > sh.inv && Math.hypot(a.x - sh.x, a.y - F.shipY) < a.r + R.cfg.hit + 4) { killAlien(a, false); hitShip(sh); }
    }
    R.aliens = R.aliens.filter(a => !a.dead);
  }
  function hitBoss(b) {
    const B = R.boss;
    if (B.dead) return;
    for (const a of R.aliens) {
      if (!a.dead && Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r) { a.hp--; if (a.hp <= 0) killAlien(a, true); b.gone = true; return; }
    }
    const nx = (b.x - B.x) / (B.w / 2), ny = (b.y - B.y) / (B.h / 2);
    if (nx * nx + ny * ny > 1) return;
    b.gone = true;
    B.hp--; B.flash = 0.06;
    if (B.hp % 6 === 0) dustFx.emit(b.x, b.y, B.def.color, 2);
    if (B.hp <= 0) {
      B.dead = true;
      R.score += points(500);
      for (let k = 0; k < 6; k++) R.gems.push({ x: B.x + (Math.random() - 0.5) * B.w, y: B.y, vy: 70 + Math.random() * 40, value: points(20) });
      dustFx.emit(B.x, B.y, B.def.color, 30);
      R.bolts = []; R.lasers = []; R.aliens = [];
      A.sfx.win();
      scr.burst("Boss beaten!");
      // Let the gems fall for a moment before the upgrade cards.
      setTimeout(() => { if (R && R.boss === B && R.state === "play") { R.boss = null; waveCleared(); } }, 1600);
    }
  }

  /* ---------- Between waves: upgrade cards ---------- */
  function waveCleared() {
    if (R.state !== "play") return;
    R.state = "pick";
    const wasBoss = R.wave > WAVES;
    // Gems still falling are collected for free.
    for (const g of R.gems) R.score += g.value;
    R.gems = []; R.bolts = []; R.shots = [];
    if (wasBoss) {
      R.sector++; R.wave = 1;
      recordSector();
    } else R.wave++;
    scr.stop();
    updateHud();
    const lifeOk = R.twist !== 2 && aliveShips().some(s => s.lives < UPGRADES.life.max); // a one-hit run stays one hit
    const pool = Object.keys(UPGRADES).filter(k => {
      if (k === "life") return false; // extra lives get their own, rarer draw below
      if (k === "shield") return R.twist !== 2 && aliveShips().some(s => s.shield < UPGRADES.shield.max);
      return R.up[k] < UPGRADES[k].max;
    });
    const cards = [];
    // Extra life is one of the cards only now and then, the same chance however many other upgrades are left.
    if (lifeOk && Math.random() < UPGRADES.life.chance) cards.push("life");
    while (cards.length < 3 && pool.length) cards.splice(Math.floor(Math.random() * (cards.length + 1)), 0, pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    const title = wasBoss ? `Sector ${R.sector - 1} cleared!` : `Wave ${R.wave - 1} cleared!`;
    if (R.twist === 1 || !cards.length) {
      // Daily twist: the upgrade is a surprise.
      const k = cards[0];
      if (k) applyUpgrade(k);
      scr.message(k ? `${UPGRADES[k].name}!` : title, 1300);
      setTimeout(() => { if (R && R.state === "pick" && A.currentScreen === "gd-play") startWave(); }, 1300);
      return;
    }
    // Co-op: the players take turns picking (a player who's out skips their turn).
    if (R.coop && !R.ships[R.picker % 2].alive) R.picker++;
    const chooser = R.coop ? R.ships[R.picker % 2] : null;
    setTimeout(() => {
      if (!R || R.state !== "pick" || A.currentScreen !== "gd-play") return;
      scr.showPanel({
        html: `<h2>${title}</h2>
          <p class="note">${chooser ? `${esc(chooser.profile.name)} picks an upgrade for both ships` : "Pick an upgrade"}</p>
          <div class="gd-cards">${cards.map((k, i) => {
            const u = UPGRADES[k], lv = k === "life" || k === "shield" ? -1 : R.up[k];
            return `<button class="gd-card" data-up="${k}"><b>${u.name}</b><small>${u.desc}</small>${lv >= 0 ? `<i>${"●".repeat(lv + 1)}${"○".repeat(u.max - lv - 1)}</i>` : ""}<kbd>${i + 1}</kbd></button>`;
          }).join("")}</div>`,
        buttons: []
      });
      const cardEls = [...$("gd-play-panel").querySelectorAll(".gd-card")];
      cardEls.forEach(b => b.addEventListener("click", () => pickCard(b.dataset.up)));
      cardEls[0].focus({ preventScroll: true }); // so Enter (or Tab, then Enter) works on a keyboard
    }, wasBoss ? 300 : 500);
  }
  function pickCard(k) {
    if (!R || R.state !== "pick") return; // one pick per wave, even with a double tap
    applyUpgrade(k);
    R.picker++;
    startWave();
  }
  function applyUpgrade(k) {
    if (k === "life") for (const s of aliveShips()) s.lives = Math.min(UPGRADES.life.max, s.lives + 1);
    else if (k === "shield") for (const s of aliveShips()) s.shield = Math.min(UPGRADES.shield.max, s.shield + 1);
    else R.up[k] = Math.min(UPGRADES[k].max, R.up[k] + 1);
  }

  function recordSector() {
    for (const s of R.ships) {
      const id = s.profile.id;
      if (!id) continue;
      const rec = sectors[id] = sectors[id] || {};
      if ((rec[R.level] || 0) < R.sector) rec[R.level] = R.sector;
    }
    saveSectors();
  }

  function gameOver() {
    R.state = "over";
    scr.stop();
    recordSector();
    updateHud();
    const where = `Sector ${R.sector}, ${R.wave > WAVES ? "the boss" : `wave ${R.wave}`}`;
    const buttons = [{ label: "Play again", cls: "big", run: restart }, { label: "Menu", cls: "ghost", run: () => (R.coop || R.twist >= 0 ? showMenu() : showLevels()) }];
    if (R.coop) {
      A.sfx.lose();
      setTimeout(() => {
        if (A.currentScreen !== "gd-play") return;
        scr.showPanel({
          html: `<h2>Great teamwork!</h2><p class="big-score">${R.score}</p>
            <p class="note">${esc(R.ships[0].profile.name)} and ${esc(R.ships[1].profile.name)} reached ${where}.</p>`,
          buttons
        });
      }, 600);
      return;
    }
    const me = R.ships[0].profile, daily = R.twist >= 0;
    const res = Act.scores.submit(ID, R.level, me, R.score, { daily });
    if (res.newBest) scr.burst("New best!");
    A.sfx.lose();
    const list = daily ? Act.scores.dailyTop(ID) : Act.scores.top(ID, R.level), lvName = LEVELS[R.level].name;
    setTimeout(() => {
      if (A.currentScreen !== "gd-play") return;
      scr.showPanel({
        html: `<h2>Game over</h2>
          <p class="big-score">${R.score}</p>
          ${daily ? `<p class="note">Daily twist: ${esc(R.twistName)}</p>` : ""}
          <p class="note">Reached ${where}${me.id && !daily ? ` · your best on ${lvName}: <b>${res.best}</b>` : ""}</p>
          <h3 class="label">${daily ? "Today's top scores" : `Top scores on ${lvName}`}</h3>
          ${Act.topListHtml(list, res.rank)}`,
        buttons
      });
    }, res.newBest ? 900 : 500);
  }

  /* ---------- HUD ---------- */
  let hudText = "";
  function updateHud() {
    const where = `<span>S${R.sector}</span><span class="wave">${R.wave > WAVES ? "Boss" : `Wave ${R.wave}/${WAVES}`}</span>`;
    const lives = R.ships.map(s => `<span class="lives" style="color:${R.coop ? s.color : ""}">${s.alive ? (s.lives > 4 ? `♥×${s.lives}` : "♥".repeat(s.lives)) : "out"}</span>`).join("");
    const html = `${where}<b>${R.score}</b>${lives}`;
    if (html !== hudText) { scr.hud.innerHTML = html; hudText = html; }
  }

  /* ---------- Drawing ---------- */
  const ALIEN_COLORS = { grunt: "#b8e986", dodger: "#d7b4f3", splitter: "#f29a9a", small: "#f29a9a", diver: "#ff8a65", shield: "#9fd3e8" };
  function render() {
    if (!R || !F.shipY) return;
    const ctx = scr.ctx, w = W(), h = H();
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#f2f0e6";
    for (const st of R.stars) { ctx.globalAlpha = 0.15 + st.s * 0.3; ctx.fillRect(st.x * w, st.y * h, 1.5 + st.s, 1.5 + st.s); }
    ctx.globalAlpha = 1;
    for (const L of R.lasers) drawLaser(ctx, L);
    if (R.boss && !R.boss.dead) drawBoss(ctx, R.boss);
    for (const a of R.aliens) drawAlien(ctx, a);
    for (const g of R.gems) {
      ctx.fillStyle = "#f3d36b"; ctx.strokeStyle = "#8a5a34"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(g.x, g.y - 7); ctx.lineTo(g.x + 6, g.y); ctx.lineTo(g.x, g.y + 7); ctx.lineTo(g.x - 6, g.y); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.strokeStyle = "#f2f0e6"; ctx.lineCap = "round";
    for (const b of R.shots) {
      ctx.lineWidth = b.r * 1.4;
      const len = Math.max(6, b.r * 2.4), sp = Math.hypot(b.vx, b.vy);
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx / sp * len, b.y - b.vy / sp * len); ctx.stroke();
    }
    for (const k of R.bolts) {
      ctx.fillStyle = "#f29a9a"; ctx.beginPath(); ctx.arc(k.x, k.y, k.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.beginPath(); ctx.arc(k.x - 1.5, k.y - 1.5, k.r * 0.35, 0, Math.PI * 2); ctx.fill();
    }
    dustFx.draw(ctx);
    for (const s of R.ships) if (s.alive) drawShip(ctx, s);
    if (R.coop) {
      // A faint line between the two players' halves.
      ctx.strokeStyle = "rgba(242,240,230,.12)"; ctx.lineWidth = 2; ctx.setLineDash([6, 10]);
      ctx.beginPath(); ctx.moveTo(w / 2, h * 0.6); ctx.lineTo(w / 2, h); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  function eyes(ctx, x, y, r, look) {
    for (const sgn of [-1, 1]) {
      ctx.fillStyle = "#f2f0e6"; ctx.beginPath(); ctx.arc(x + sgn * r, y, r * 0.75, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#263d30"; ctx.beginPath(); ctx.arc(x + sgn * r + (look || 0) * r * 0.3, y + r * 0.2, r * 0.38, 0, Math.PI * 2); ctx.fill();
    }
  }
  function drawAlien(ctx, a) {
    const r = a.r, c = ALIEN_COLORS[a.type];
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.fillStyle = a.flash > 0 ? "#ffffff" : c; ctx.strokeStyle = "#263d30"; ctx.lineWidth = 2;
    const look = Math.sin(R.t * 2 + a.x * 0.01);
    if (a.type === "grunt") {
      ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.7); ctx.lineTo(-r * 0.6, -r * 1.15); ctx.moveTo(r * 0.4, -r * 0.7); ctx.lineTo(r * 0.6, -r * 1.15); ctx.stroke();
      ctx.beginPath(); ctx.arc(-r * 0.6, -r * 1.15, 2.5, 0, Math.PI * 2); ctx.arc(r * 0.6, -r * 1.15, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#263d30";
      ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, 0); ctx.lineTo(r, r * 0.55); ctx.lineTo(r * 0.5, r * 0.3); ctx.lineTo(0, r * 0.6); ctx.lineTo(-r * 0.5, r * 0.3); ctx.lineTo(-r, r * 0.55); ctx.closePath(); ctx.fill(); ctx.stroke();
      eyes(ctx, 0, -r * 0.15, r * 0.32, look);
    } else if (a.type === "dodger") {
      ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 1.1, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 1.1, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      eyes(ctx, 0, -r * 0.05, r * 0.3, a.dodge > 1 ? 1 : a.dodge < -1 ? -1 : look);
    } else if (a.type === "splitter") {
      for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.arc(sgn * r * 0.45, 0, r * 0.65, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.strokeStyle = "rgba(38,61,48,.6)"; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(0, -r * 0.6); ctx.lineTo(0, r * 0.6); ctx.stroke(); ctx.setLineDash([]);
      eyes(ctx, 0, -r * 0.05, r * 0.28, look);
    } else if (a.type === "small") {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      eyes(ctx, 0, -r * 0.1, r * 0.35, look);
    } else if (a.type === "diver") {
      ctx.beginPath(); ctx.moveTo(0, r * 1.1); ctx.lineTo(r * 1.1, -r * 0.7); ctx.lineTo(0, -r * 0.25); ctx.lineTo(-r * 1.1, -r * 0.7); ctx.closePath(); ctx.fill(); ctx.stroke();
      eyes(ctx, 0, -r * 0.05, r * 0.26, 0);
    } else {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      eyes(ctx, 0, -r * 0.2, r * 0.3, look);
      if (a.shield) {
        // The shield: a thick chalk arc across the front (bottom).
        ctx.strokeStyle = "#f2f0e6"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 1.25, Math.PI * 0.18, Math.PI * 0.82); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawShip(ctx, s) {
    const y = F.shipY, x = s.x;
    if (R.t < s.inv && Math.floor(R.t * 10) % 2) return; // blink while safe after a hit
    ctx.save();
    ctx.translate(x, y);
    // Flame.
    ctx.fillStyle = "#ff8a65"; ctx.beginPath(); ctx.moveTo(-6, 12); ctx.lineTo(0, 20 + Math.sin(R.t * 40) * 4); ctx.lineTo(6, 12); ctx.fill();
    ctx.fillStyle = s.color; ctx.strokeStyle = "#263d30"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(8, -2); ctx.lineTo(20, 10); ctx.lineTo(8, 12); ctx.lineTo(-8, 12); ctx.lineTo(-20, 10); ctx.lineTo(-8, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#263d30"; ctx.beginPath(); ctx.arc(0, -3, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f2f0e6"; ctx.beginPath(); ctx.arc(-1.3, -4.5, 1.6, 0, Math.PI * 2); ctx.fill();
    if (R.up.side) { ctx.fillStyle = "#f2f0e6"; ctx.fillRect(-17, 2, 5, 5); ctx.fillRect(12, 2, 5, 5); }
    if (s.shield > 0) {
      ctx.strokeStyle = "rgba(159,211,232,.8)"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.stroke();
      if (s.shield > 1) { ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(0, 0, 32, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    }
    ctx.restore();
    // Drone buddies hover beside the ship.
    for (let k = 0; k < R.up.drone; k++) {
      const dx = x + (k ? 34 : -34), dy = y - 2 + Math.sin(R.t * 4 + k) * 3;
      ctx.fillStyle = s.color; ctx.strokeStyle = "#263d30"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(dx, dy - 8); ctx.lineTo(dx + 6, dy); ctx.lineTo(dx, dy + 6); ctx.lineTo(dx - 6, dy); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    if (R.coop) {
      ctx.fillStyle = s.color; ctx.globalAlpha = 0.7; ctx.font = '14px "Patrick Hand", cursive'; ctx.textAlign = "center";
      ctx.fillText(s.profile.name, x, y + 34); ctx.globalAlpha = 1;
    }
  }

  function drawLaser(ctx, L) {
    if (R.t < L.on) {
      ctx.strokeStyle = "rgba(242,154,154,.7)"; ctx.lineWidth = 2; ctx.setLineDash([8, 8]);
      ctx.beginPath(); ctx.moveTo(L.x, 0); ctx.lineTo(L.x, H()); ctx.stroke(); ctx.setLineDash([]);
    } else {
      ctx.fillStyle = "rgba(242,154,154,.35)"; ctx.fillRect(L.x - 18, 0, 36, H());
      ctx.fillStyle = "#fff1f0"; ctx.fillRect(L.x - 6, 0, 12, H());
    }
  }

  function drawBoss(ctx, B) {
    const { x, y, w, h } = B, c = B.flash > 0 ? "#ffffff" : B.def.color;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = c; ctx.strokeStyle = "#263d30"; ctx.lineWidth = 3;
    const look = Math.max(-1, Math.min(1, ((nearestShip(x) || { x }).x - x) / 150));
    switch (B.def.shape) {
      case "saucer":
        ctx.fillStyle = "rgba(159,211,232,.45)"; ctx.beginPath(); ctx.ellipse(0, -h * 0.12, w * 0.26, h * 0.34, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
        ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, h * 0.05, w / 2, h * 0.24, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        for (let k = -2; k <= 2; k++) { ctx.fillStyle = Math.floor(B.t * 4 + k) % 2 ? "#f3d36b" : "#f2f0e6"; ctx.beginPath(); ctx.arc(k * w * 0.17, h * 0.1, 4, 0, Math.PI * 2); ctx.fill(); }
        eyes(ctx, 0, -h * 0.18, h * 0.1, look);
        break;
      case "squid":
        ctx.lineWidth = 5; ctx.strokeStyle = c;
        for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(k * w * 0.1, h * 0.1); ctx.quadraticCurveTo(k * w * 0.13 + Math.sin(B.t * 3 + k) * 10, h * 0.35, k * w * 0.12, h * 0.5); ctx.stroke(); }
        ctx.lineWidth = 3; ctx.strokeStyle = "#263d30";
        ctx.beginPath(); ctx.ellipse(0, -h * 0.08, w * 0.34, h * 0.36, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        eyes(ctx, 0, -h * 0.05, h * 0.12, look);
        break;
      case "crab":
        for (const sgn of [-1, 1]) {
          ctx.beginPath(); ctx.arc(sgn * w * 0.38, -h * 0.15, h * 0.2, sgn > 0 ? Math.PI * 0.9 : -Math.PI * 0.1, sgn > 0 ? Math.PI * 2.3 : Math.PI * 1.3); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(sgn * w * 0.12, -h * 0.2); ctx.lineTo(sgn * w * 0.14, -h * 0.42); ctx.stroke();
        }
        ctx.beginPath(); ctx.ellipse(0, h * 0.05, w * 0.32, h * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        eyes(ctx, 0, -h * 0.42, h * 0.09, look);
        break;
      case "king":
        ctx.fillStyle = "rgba(243,211,107,.35)";
        ctx.beginPath(); ctx.moveTo(-w * 0.2, -h * 0.1); ctx.lineTo(0, -h * 0.5 - Math.sin(B.t * 5) * 6); ctx.lineTo(w * 0.2, -h * 0.1); ctx.fill();
        ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, h * 0.05, h * 0.36, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#f3d36b"; ctx.beginPath(); ctx.moveTo(-h * 0.3, -h * 0.22); ctx.lineTo(-h * 0.3, -h * 0.45); ctx.lineTo(-h * 0.15, -h * 0.32); ctx.lineTo(0, -h * 0.5); ctx.lineTo(h * 0.15, -h * 0.32); ctx.lineTo(h * 0.3, -h * 0.45); ctx.lineTo(h * 0.3, -h * 0.22); ctx.closePath(); ctx.fill(); ctx.stroke();
        eyes(ctx, 0, h * 0.02, h * 0.11, look);
        ctx.beginPath(); ctx.arc(0, h * 0.18, h * 0.1, 0.2, Math.PI - 0.2); ctx.stroke();
        break;
      default: // brain
        ctx.beginPath(); ctx.ellipse(0, 0, w * 0.4, h * 0.42, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "rgba(38,61,48,.45)"; ctx.lineWidth = 2;
        for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * w * 0.13, -h * 0.35); ctx.quadraticCurveTo(k * w * 0.13 + 12, -h * 0.15, k * w * 0.13, h * 0.05); ctx.stroke(); }
        ctx.strokeStyle = "#263d30";
        eyes(ctx, 0, h * 0.15, h * 0.13, look);
    }
    ctx.restore();
    // Health bar along the top.
    const bw = Math.min(W() - 40, 320), bx = (W() - bw) / 2, by = 10;
    ctx.fillStyle = "rgba(242,240,230,.15)"; ctx.fillRect(bx, by, bw, 10);
    ctx.fillStyle = "#f29a9a"; ctx.fillRect(bx, by, bw * Math.max(0, B.hp / B.max), 10);
    ctx.fillStyle = "#f2f0e6"; ctx.font = '15px "Patrick Hand", cursive'; ctx.textAlign = "center";
    ctx.fillText(B.def.name, W() / 2, by + 26);
  }

  /* ---------- Register with the arcade ---------- */
  A.registerGame({
    id: ID,
    name: "Galaxy Defenders",
    accent: ACCENT,
    twists: TWISTS,
    icon: `<path class="acc" d="M14 10 h4 v3 h12 v-3 h4 v8 h-20 z M17 18 v3 M31 18 v3"/>
    <path d="M24 26 v5"/><path d="M18 42 l6 -8 l6 8 z"/>`,
    open: showMenu,
    _round: () => R, // read-only peek at the run in progress, for testing
    badge: () => (todayTwist() ? "Daily twist" : null),
    tileStat(playerId) {
      const best = Act.scores.bestAny(ID, playerId), sec = bestSectorAny(playerId);
      if (!best && !sec) return null;
      return [best ? `Best: ${best}` : "", sec ? `Sector ${sec}` : ""].filter(Boolean).join(" · ");
    },
    resetStats() { Act.scores.reset(ID); sectors = {}; saveSectors(); },
    forgetPlayer(id) {
      Act.scores.forgetPlayer(ID, id);
      delete sectors[id]; saveSectors();
      A.store.set("galaxy-defenders:lastSetup", A.store.get("galaxy-defenders:lastSetup", []).filter(e => e.id !== id));
    }
  });
})();

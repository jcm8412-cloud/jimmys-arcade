/* Pong Party: Pong with weird balls and power-ups, vs the computer (four levels), 2 players with the
   device flat between them, or 4 players on a tablet (3 lives each; a player who's out becomes a wall).
   Built on the shared action kit (Arcade.Action).
   High score: the longest rally (paddle hits in one point) against the computer, per player and level.
   Saved data: pong-party:record {playerId: {level: {w, l}}}, pong-party:wins {playerId: wins}
   (2- and 4-player matches), pong-party:lastSetup2 / lastSetup4. Guests aren't recorded. */
(function () {
  const A = window.Arcade, Act = A.Action;
  const $ = id => document.getElementById(id);
  const esc = A.esc;
  const ID = "pong-party";
  const ACCENT = "#7fdde8";
  const TARGET = 7;               // first to 7 points
  const LIVES_4P = 3;
  const MARGIN = 28;              // paddle line distance from the edge (px)
  const THICK = 14;               // paddle thickness (px)
  const MAX_ANGLE = Math.PI / 3;  // bounce angle at the very end of a paddle
  const SIDES = ["bottom", "top", "left", "right"];
  const P_COLORS = ["#f3d36b", "#9fd3e8", "#f29a9a", "#b8e986"];
  const TWISTS = ["Two balls at once", "Shrinking paddles", "Bumpers in the middle"];
  const WEIRD = ["splitter", "curve", "speed", "ghost"];
  const WEIRD_NAMES = { splitter: "Splitter!", curve: "Curveball!", speed: "Speedster!", ghost: "Ghost ball!" };
  const POWERS = ["big", "tiny", "shield", "freeze"];
  const POWER_TIME = { big: 8, tiny: 8, shield: 8, freeze: 3 };

  // Ball speed is a share of the court's long side per second; the computer paddle's speed a share of its width.
  const LEVELS = {
    // err: the computer aims up to this many paddle-lengths off. A paddle reaches about 0.58 of its length
    // either side (half its length plus the ball), so it misses roughly (1 - 0.58/err) of its shots:
    // Easy ~45%, Medium ~20%, Hard ~10%, Impossible ~3% (plus any it can't reach in time).
    easy: { name: "Easy", desc: "Slow ball, sleepy computer", ball: 0.42, cpu: 0.5, err: 1.05, react: 0.35, myLen: 1.3 },
    medium: { name: "Medium", desc: "A fair match", ball: 0.55, cpu: 0.85, err: 0.73, react: 0.2, myLen: 1.1 },
    hard: { name: "Hard", desc: "Quick ball, sharp computer", ball: 0.66, cpu: 1.2, err: 0.645, react: 0.12, myLen: 1 },
    impossible: { name: "Impossible", desc: "Very good, but not perfect", ball: 0.78, cpu: 1.7, err: 0.6, react: 0.06, myLen: 1 }
  };

  let record = A.store.get("pong-party:record", {});
  let wins = A.store.get("pong-party:wins", {});
  const saveRecord = () => A.store.set("pong-party:record", record);
  const saveWins = () => A.store.set("pong-party:wins", wins);
  const isTablet = () => Math.min(window.innerWidth, window.innerHeight) >= 600;

  /* ---------- Menu screens ---------- */
  const home = `<button class="icon-btn" data-home aria-label="Home"></button>`;
  const back = `<button class="back-link" data-pp-back>‹ Pong Party</button>`;
  const seg = (id, items) => `<div class="seg" role="radiogroup" id="${id}">${items.map(([v, label]) => `<button type="button" role="radio" data-v="${v}">${label}</button>`).join("")}</div>`;
  $("game-root").insertAdjacentHTML("beforeend", `
  <section class="screen pp menu" id="pp-menu" hidden>
    <header class="topbar"><div class="tb-left">${home}</div><h2></h2><div class="tb-right"></div></header>
    <h1 class="title">Pong <span>Party</span></h1>
    <p class="tagline">Weird balls, power-ups, and lots of bouncing!</p>
    <div class="menu-buttons">
      <button class="btn big" id="pp-btn-cpu">Vs computer</button>
      <button class="btn big daily" id="pp-btn-daily" hidden></button>
      <button class="btn big" id="pp-btn-two">2 players</button>
      <button class="btn big" id="pp-btn-four" hidden>4 players</button>
      <button class="btn ghost" id="pp-btn-top">Top rallies</button>
    </div>
    <p class="note center-text" id="pp-menu-note"></p>
  </section>

  <section class="screen pp" id="pp-levels" hidden>
    <header class="topbar"><div class="tb-left">${home}${back}</div><h2>Pick a level</h2><div class="tb-right"></div></header>
    <div class="playing-as" id="pp-playing-as"></div>
    <div class="levels" id="pp-level-list"></div>
  </section>

  <section class="screen pp" id="pp-setup" hidden>
    <header class="topbar"><div class="tb-left">${home}${back}</div><h2 id="pp-setup-title"></h2><div class="tb-right"></div></header>
    <p class="note" id="pp-setup-note"></p>
    <h3 class="label" id="pp-setup-label"></h3>
    <div id="pp-picker"></div>
    <p class="err" id="pp-setup-err" aria-live="polite"></p>
    <button class="btn big" id="pp-start">Start</button>
  </section>

  <section class="screen pp" id="pp-top" hidden>
    <header class="topbar"><div class="tb-left">${home}${back}</div><h2>Top rallies</h2><div class="tb-right"></div></header>
    ${seg("pp-top-level", Object.entries(LEVELS).map(([k, l]) => [k, l.name]).concat([["daily", "Today"]]))}
    <div id="pp-top-list"></div>
  </section>`);

  const scr = Act.createScreen({
    id: "pp-play", cls: "pp",
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
    $("pp-btn-daily").hidden = !d;
    if (d) $("pp-btn-daily").innerHTML = `Daily twist<small>${esc(d.name)}</small>`;
    $("pp-btn-four").hidden = !isTablet();
    $("pp-menu-note").textContent = isTablet() ? "" : "4 players is on tablets.";
    A.show("pp-menu");
  }
  document.querySelectorAll("[data-pp-back]").forEach(b => b.addEventListener("click", showMenu));
  $("pp-btn-cpu").addEventListener("click", () => A.whoIsPlaying({ onDone: showLevels, onBack: showMenu, backLabel: "Pong Party" }));
  $("pp-btn-daily").addEventListener("click", () => A.whoIsPlaying({
    onDone: p => startMatch({ mode: "daily", level: "medium", players: [p], twist: todayTwist() }), onBack: showMenu, backLabel: "Pong Party"
  }));
  $("pp-btn-two").addEventListener("click", () => showSetup(2));
  $("pp-btn-four").addEventListener("click", () => showSetup(4));
  $("pp-btn-top").addEventListener("click", () => showTop("easy"));

  function showLevels() {
    const p = A.session.player;
    $("pp-playing-as").innerHTML = `${A.avatarSvg(p)}<span>Playing: <b>${esc(p.name)}</b></span>
      <button class="btn ghost" id="pp-switch">Switch</button>`;
    $("pp-switch").addEventListener("click", () => A.whoIsPlaying({ force: true, onDone: showLevels, onBack: showLevels, backLabel: "Levels" }));
    const box = $("pp-level-list");
    box.innerHTML = "";
    for (const [id, lv] of Object.entries(LEVELS)) {
      const best = Act.scores.best(ID, id, p.id);
      const r = (p.id && record[p.id] && record[p.id][id]) || { w: 0, l: 0 };
      const b = document.createElement("button");
      b.className = "level" + (id === "impossible" ? " impossible" : "");
      b.innerHTML = `<b>${lv.name}</b><small>${lv.desc}</small>
        <span class="stats" aria-hidden="true"><span>${r.w}</span><span>${r.l}</span><span>${best}</span><i>wins</i><i>losses</i><i>rally</i></span>`;
      b.setAttribute("aria-label", `${lv.name}: ${lv.desc}. Wins ${r.w}, losses ${r.l}, best rally ${best}.`);
      b.addEventListener("click", () => startMatch({ mode: "cpu", level: id, players: [p] }));
      box.appendChild(b);
    }
    A.setAccent(ACCENT);
    A.show("pp-levels");
  }

  let picker = null, setupCount = 2;
  function showSetup(n) {
    setupCount = n;
    A.setAccent(ACCENT);
    $("pp-setup-title").textContent = `${n} players`;
    $("pp-setup-note").textContent = n === 2
      ? "Lay the device flat between you. Drag anywhere on your half to move your paddle."
      : "Lay the tablet flat with one player on each side. Each player has 3 lives; when you're out, your side becomes a wall.";
    $("pp-setup-label").textContent = n === 2 ? "Pick two players (first one sits at the bottom)" : "Pick four players (bottom, top, left, right)";
    $("pp-setup-err").textContent = "";
    picker = A.playerPicker($("pp-picker"), { min: n, max: n, initial: A.store.get(`pong-party:lastSetup${n}`, []), onChange: () => { $("pp-setup-err").textContent = ""; } });
    A.show("pp-setup");
  }
  $("pp-start").addEventListener("click", () => {
    if (picker.count() < setupCount) { $("pp-setup-err").textContent = `Pick ${setupCount} players.`; return; }
    A.store.set(`pong-party:lastSetup${setupCount}`, picker.entries());
    startMatch({ mode: setupCount === 2 ? "two" : "four", level: "medium", players: picker.get() });
  });

  function showTop(level) {
    paintSeg("pp-top-level", level);
    const list = level === "daily" ? Act.scores.dailyTop(ID) : Act.scores.top(ID, level);
    const d = todayTwist();
    $("pp-top-list").innerHTML = (level === "daily" ? `<p class="note">${d ? `Today's twist: ${esc(d.name)}` : "Pong Party isn't today's daily twist."}</p>` : "")
      + `<p class="note">Longest rallies (paddle hits in one point) against the computer.</p>` + Act.topListHtml(list, -1);
    A.setAccent(ACCENT);
    A.show("pp-top");
  }
  $("pp-top-level").querySelectorAll("button").forEach(b => b.addEventListener("click", () => showTop(b.dataset.v)));

  /* ---------- Match state ----------
     R: { mode ("cpu" | "daily" | "two" | "four"), level, cfg, twist, paddles [P], balls, item, bumpers,
          state ("serve" | "play" | "over"), timer, t, matchT, rally, bestRally, serveTo, themeId }
     P: { idx, side, profile, cpu, pos, target, len, effects {big, tiny, freeze, shield}, score, lives, alive, keys } */
  let R = null, lastStart = null;
  const dustFx = Act.dust(60);
  const keysDown = new Set();

  function startMatch({ mode, level, players, twist }) {
    lastStart = () => startMatch({ mode, level, players, twist });
    const cfg = LEVELS[level];
    const sides = mode === "four" ? SIDES : ["bottom", "top"];
    const profiles = mode === "cpu" || mode === "daily" ? [players[0], { id: null, name: "Computer", avatar: "robot" }] : players;
    R = {
      mode, level, cfg, twist: twist ? twist.twist : -1, twistName: twist ? twist.name : "",
      paddles: sides.map((side, i) => ({
        idx: i, side, profile: profiles[i], cpu: (mode === "cpu" || mode === "daily") && i === 1,
        pos: 0, target: null, effects: { big: 0, tiny: 0, freeze: 0, shield: 0 },
        score: 0, lives: LIVES_4P, alive: true, aim: 0, nextThink: 0
      })),
      balls: [], item: null, nextItem: 6, bumpers: [], state: "serve", timer: 1, t: 0, matchT: 0,
      rally: 0, bestRally: 0, serveTo: Math.random() < 0.5 ? 0 : 1, themeId: A.resolveTheme(A.settings.theme)
    };
    A.noteThemeUsed(R.themeId);
    A.setAccent(ACCENT);
    scr.section.classList.toggle("multi", mode === "two" || mode === "four");
    scr.show();
    requestAnimationFrame(() => {
      layout();
      for (const p of R.paddles) p.pos = p.target = centerOf(p);
      dustFx.clear();
      updateHud();
      scr.start(update, render);
    });
  }
  function restart() { if (lastStart) lastStart(); }

  /* ---------- Geometry ---------- */
  const W = () => scr.size.w, H = () => scr.size.h;
  const horizontal = p => p.side === "bottom" || p.side === "top";
  const lineOf = p => ({ bottom: H() - MARGIN, top: MARGIN, left: MARGIN, right: W() - MARGIN })[p.side];
  const centerOf = p => (horizontal(p) ? W() / 2 : H() / 2);
  function layout() {
    R.baseLen = Math.max(70, Math.min(W(), H()) * 0.24);
    R.ballR = Math.max(7, Math.min(W(), H()) * 0.018);
    R.speed0 = Math.max(W(), H()) * R.cfg.ball;
    if (R.twist === 2) {
      const cx = W() / 2, cy = H() / 2, rr = Math.min(W(), H()) * 0.055;
      R.bumpers = [{ x: cx, y: cy, r: rr }, { x: cx - W() * 0.25, y: cy - H() * 0.12, r: rr * 0.8 }, { x: cx + W() * 0.25, y: cy + H() * 0.12, r: rr * 0.8 }];
    }
  }
  function paddleLen(p) {
    let len = R.baseLen;
    if (!p.cpu && (R.mode === "cpu" || R.mode === "daily")) len *= R.cfg.myLen;
    if (p.effects.big > R.t) len *= 1.5;
    if (p.effects.tiny > R.t) len *= 0.6;
    if (R.twist === 1) len *= Math.max(0.45, 1 - R.matchT / 100); // shrinking paddles
    return len;
  }
  // Range the paddle's center can move in (4 players: keep clear of the corners).
  function range(p) {
    const half = paddleLen(p) / 2, span = horizontal(p) ? W() : H();
    const pad = R.mode === "four" ? MARGIN * 2 : 0;
    return [pad + half, span - pad - half];
  }
  const isWall = side => !R.paddles.some(p => p.side === side && p.alive);

  /* ---------- Input: drag in your own zone; multi-touch ---------- */
  const touches = new Map(); // pointerId -> paddle index
  function zoneOf(x, y) {
    const live = R.paddles.filter(p => p.alive && !p.cpu);
    if (R.mode === "cpu" || R.mode === "daily") return live[0];
    if (R.mode === "two") return live.find(p => p.side === (y > H() / 2 ? "bottom" : "top"));
    // 4 players: the nearest edge.
    const d = { bottom: H() - y, top: y, left: x, right: W() - x };
    return live.slice().sort((a, b) => d[a.side] - d[b.side])[0];
  }
  const local = e => { const r = scr.stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  scr.stage.addEventListener("pointerdown", e => {
    // Only presses on the game itself count. Grabbing the pointer for a press on a button over it (Paused,
    // end-of-round panels) would send the click to the stage instead, and the button would never get it.
    if (!R || e.target !== scr.canvas) return;
    const { x, y } = local(e);
    const p = zoneOf(x, y);
    if (!p) return;
    touches.set(e.pointerId, p.idx);
    p.target = horizontal(p) ? x : y;
    try { scr.stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    e.preventDefault();
  });
  scr.stage.addEventListener("pointermove", e => {
    if (!R || !touches.has(e.pointerId)) return;
    const p = R.paddles[touches.get(e.pointerId)];
    const { x, y } = local(e);
    p.target = horizontal(p) ? x : y;
  });
  const lift = e => touches.delete(e.pointerId);
  scr.stage.addEventListener("pointerup", lift);
  scr.stage.addEventListener("pointercancel", lift);
  // Keyboard: arrows move the bottom paddle, A/D the top one (2 players).
  document.addEventListener("keydown", e => {
    if (A.currentScreen !== "pp-play" || A.dialogOpen()) return;
    if (e.key === " ") { e.preventDefault(); if (scr.running) scr.pause(); else if (scr.active) scr.resume(); return; }
    if (["ArrowLeft", "ArrowRight", "a", "d", "A", "D"].includes(e.key)) { keysDown.add(e.key.toLowerCase()); e.preventDefault(); }
  });
  document.addEventListener("keyup", e => keysDown.delete(e.key.toLowerCase()));

  /* ---------- Serving and balls ---------- */
  function newBall(towards, type) {
    const p = R.paddles[towards];
    const spread = (Math.random() - 0.5) * 0.7;
    const s = R.speed0;
    const dir = { bottom: [Math.sin(spread), Math.cos(spread)], top: [Math.sin(spread), -Math.cos(spread)],
      left: [-Math.cos(spread), Math.sin(spread)], right: [Math.cos(spread), Math.sin(spread)] }[p.side];
    return {
      x: W() / 2, y: H() / 2, vx: dir[0] * s, vy: dir[1] * s, type: type || "normal", split: false,
      curve: (Math.random() < 0.5 ? -1 : 1) * 1.3, lastHitter: -1, speedMult: 1, trail: 0
    };
  }
  function serve() {
    const alive = R.paddles.filter(p => p.alive);
    let to = R.paddles[R.serveTo];
    if (!to || !to.alive) to = alive[Math.floor(Math.random() * alive.length)];
    // About one point in three starts with a weird ball.
    const weird = Math.random() < 1 / 3 ? WEIRD[Math.floor(Math.random() * WEIRD.length)] : null;
    R.balls = [newBall(to.idx, weird)];
    if (R.twist === 0) R.balls.push(newBall(R.paddles.find(p => p.alive && p !== to).idx));
    if (weird) scr.message(WEIRD_NAMES[weird], 900);
    R.rally = 0;
    R.state = "play";
  }

  /* ---------- Update ---------- */
  function update(dt) {
    R.t += dt;
    if (R.state !== "over") R.matchT += dt;
    movePaddles(dt);
    if (R.state === "serve") {
      R.timer -= dt;
      if (R.timer <= 0) serve();
    } else if (R.state === "play") {
      for (const b of R.balls.slice()) moveBall(b, dt);
      updateItem(dt);
    }
    dustFx.update(dt);
    updateHud();
  }

  function movePaddles(dt) {
    for (const p of R.paddles) {
      if (!p.alive) continue;
      let target = p.target;
      if (p.cpu) target = cpuTarget(p);
      else if (!touches.size && keysDown.size) {
        const k = p.side === "bottom" ? ["arrowleft", "arrowright"] : p.side === "top" && R.mode === "two" ? ["d", "a"] : null;
        if (k) { if (keysDown.has(k[0])) target = p.pos - 1e4; if (keysDown.has(k[1])) target = p.pos + 1e4; }
      }
      if (target == null) continue;
      let maxSpeed = p.cpu ? R.cfg.cpu * (horizontal(p) ? W() : H()) : 2600;
      if (p.effects.freeze > R.t) maxSpeed *= 0.3;
      const [lo, hi] = range(p);
      const goal = Math.max(lo, Math.min(hi, target));
      const step = maxSpeed * dt;
      p.pos += Math.max(-step, Math.min(step, goal - p.pos));
      p.pos = Math.max(lo, Math.min(hi, p.pos));
    }
  }

  // The computer: every so often, predict where the ball will cross its line, plus a deliberate error.
  function cpuTarget(p) {
    if (R.t < p.nextThink) return p.aim;
    p.nextThink = R.t + R.cfg.react;
    const line = lineOf(p);
    let best = null;
    for (const b of R.balls) {
      if (b.vy >= 0) continue; // the computer is at the top
      const tHit = (b.y - line) / -b.vy;
      if (!best || tHit < best.t) best = { t: tHit, b };
    }
    if (!best) { p.aim = W() / 2; p.missBy = null; return p.aim; }
    // Fold the straight-line path back into the court to account for wall bounces.
    const r = R.ballR, span = W() - 2 * r;
    let x = best.b.x - r + best.b.vx * best.t;
    x = ((x % (2 * span)) + 2 * span) % (2 * span);
    if (x > span) x = 2 * span - x;
    if (best.b !== p.tracking || best.b.hits !== p.trackedHits) {
      // A new aim for each incoming shot.
      p.tracking = best.b; p.trackedHits = best.b.hits;
      p.missBy = (Math.random() * 2 - 1) * R.cfg.err * paddleLen(p);
    }
    p.aim = x + r + p.missBy;
    return p.aim;
  }

  function moveBall(b, dt) {
    if (b.type === "curve") {
      // Bend in an arc, but never so far that the ball stops crossing the court.
      const a = b.curve * dt, c = Math.cos(a), s = Math.sin(a);
      const nvx = b.vx * c - b.vy * s, nvy = b.vx * s + b.vy * c;
      const sp = Math.hypot(nvx, nvy);
      const across = R.mode === "four" ? Math.max(Math.abs(nvx), Math.abs(nvy)) : Math.abs(nvy);
      if (across > sp * 0.45) { b.vx = nvx; b.vy = nvy; } else b.curve = -b.curve;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    const r = R.ballR;
    if (Math.hypot(b.vx, b.vy) > R.speed0 * 1.25 && (b.trail += dt) > 0.03) { b.trail = 0; dustFx.emit(b.x, b.y, "#f2f0e6", 1); }

    // Bumpers (daily twist).
    for (const k of R.bumpers) {
      const dx = b.x - k.x, dy = b.y - k.y, d = Math.hypot(dx, dy);
      if (d < k.r + r && d > 0) {
        const nx = dx / d, ny = dy / d, dot = b.vx * nx + b.vy * ny;
        if (dot < 0) { b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny; A.sfx.right(); }
        b.x = k.x + nx * (k.r + r); b.y = k.y + ny * (k.r + r);
      }
    }

    // Walls on sides without a paddle.
    if (isWall("left") && b.x - r < 0) { b.x = r; b.vx = Math.abs(b.vx); }
    if (isWall("right") && b.x + r > W()) { b.x = W() - r; b.vx = -Math.abs(b.vx); }
    if (isWall("top") && b.y - r < 0) { b.y = r; b.vy = Math.abs(b.vy); }
    if (isWall("bottom") && b.y + r > H()) { b.y = H() - r; b.vy = -Math.abs(b.vy); }

    // Paddles.
    for (const p of R.paddles) {
      if (!p.alive) continue;
      const line = lineOf(p), half = paddleLen(p) / 2;
      const along = horizontal(p) ? b.x : b.y, across = horizontal(p) ? b.y : b.x;
      const v = horizontal(p) ? b.vy : b.vx;
      const outward = p.side === "bottom" || p.side === "right" ? 1 : -1; // direction towards this player's goal
      if (v * outward <= 0) continue;
      const front = line - outward * (THICK / 2 + r);
      if (outward > 0 ? across < front : across > front) continue;
      if (outward > 0 ? across > line + THICK : across < line - THICK) continue; // already past
      if (Math.abs(along - p.pos) > half + r) continue;
      hitPaddle(b, p, (along - p.pos) / half, front);
    }

    // Goals.
    for (const p of R.paddles) {
      if (!p.alive) continue;
      const past = { bottom: b.y - r > H(), top: b.y + r < 0, left: b.x + r < 0, right: b.x - r > W() }[p.side];
      if (!past) continue;
      if (p.effects.shield > R.t) {
        // The shield blocks one goal: bounce back in.
        p.effects.shield = 0;
        if (horizontal(p)) { b.vy = -b.vy; b.y = p.side === "bottom" ? H() - r : r; } else { b.vx = -b.vx; b.x = p.side === "right" ? W() - r : r; }
        scr.message("Blocked!", 700);
        continue;
      }
      goal(p);
      return;
    }
  }

  function hitPaddle(b, p, offset, front) {
    offset = Math.max(-1, Math.min(1, offset));
    const angle = offset * MAX_ANGLE;
    b.speedMult = Math.min(b.type === "speed" ? 2.6 : 1.8, b.speedMult * (b.type === "speed" ? 1.12 : 1.04));
    const s = R.speed0 * b.speedMult;
    const along = Math.sin(angle) * s, away = Math.cos(angle) * s;
    if (p.side === "bottom") { b.vx = along; b.vy = -away; b.y = front; }
    else if (p.side === "top") { b.vx = along; b.vy = away; b.y = front; }
    else if (p.side === "left") { b.vy = along; b.vx = away; b.x = front; }
    else { b.vy = along; b.vx = -away; b.x = front; }
    b.lastHitter = p.idx;
    b.hits = (b.hits || 0) + 1;
    if (b.type === "curve") b.curve = -b.curve;
    R.rally++;
    R.bestRally = Math.max(R.bestRally, R.rally);
    A.sfx.right();
    // Splitter: three balls on its first paddle hit.
    if (b.type === "splitter" && !b.split) {
      b.split = true;
      for (const turn of [-0.35, 0.35]) {
        const c = Math.cos(turn), sn = Math.sin(turn);
        R.balls.push({ ...b, vx: b.vx * c - b.vy * sn, vy: b.vx * sn + b.vy * c, type: "normal", split: true });
      }
    }
  }

  function goal(loser) {
    R.balls = [];
    R.item = null;
    A.sfx.lose();
    const humanLost = !loser.cpu;
    if (humanLost && (R.mode === "cpu" || R.mode === "daily")) A.buzz();
    if (R.mode === "four") {
      loser.lives--;
      if (loser.lives <= 0) {
        loser.alive = false;
        A.buzz();
        scr.message(`${loser.profile.name} is out!`, 1100);
      }
      const alive = R.paddles.filter(p => p.alive);
      if (alive.length <= 1) return endMatch(alive[0]);
      R.serveTo = loser.alive ? loser.idx : alive[Math.floor(Math.random() * alive.length)].idx;
    } else {
      const winner = R.paddles.find(p => p !== loser);
      winner.score++;
      if (winner.score >= TARGET) return endMatch(winner);
      R.serveTo = loser.idx; // the ball goes to whoever lost the point
    }
    R.state = "serve";
    R.timer = 1;
  }

  /* ---------- Power-ups ---------- */
  function updateItem() {
    if (!R.item && R.t >= R.nextItem) {
      const type = POWERS[Math.floor(Math.random() * POWERS.length)];
      R.item = { type, x: W() * (0.25 + Math.random() * 0.5), y: H() * (0.35 + Math.random() * 0.3), r: Math.max(16, R.ballR * 2.2), until: R.t + 10 };
    }
    if (R.item && R.item.until < R.t) { R.item = null; R.nextItem = R.t + 7 + Math.random() * 4; }
    if (!R.item) return;
    for (const b of R.balls) {
      if (Math.hypot(b.x - R.item.x, b.y - R.item.y) > R.item.r + R.ballR || b.lastHitter < 0) continue;
      const owner = R.paddles[b.lastHitter];
      const others = R.paddles.filter(p => p !== owner && p.alive);
      const type = R.item.type, until = R.t + POWER_TIME[type];
      if (type === "big" || type === "shield") owner.effects[type] = until;
      else for (const o of others) o.effects[type] = until;
      scr.message({ big: "Big paddle!", tiny: "Tiny paddles!", shield: "Shield!", freeze: "Freeze!" }[type], 800);
      dustFx.emit(R.item.x, R.item.y, ACCENT, 10);
      R.item = null;
      R.nextItem = R.t + 7 + Math.random() * 4;
      A.sfx.right();
      return;
    }
  }

  /* ---------- End of the match ---------- */
  function endMatch(winner) {
    R.state = "over";
    scr.stop();
    const name = p => p.profile.name;
    if (R.mode === "cpu" || R.mode === "daily") {
      const me = R.paddles[0], cpu = R.paddles[1], won = winner === me;
      const daily = R.mode === "daily";
      if (me.profile.id && !daily) {
        const r = record[me.profile.id] = record[me.profile.id] || {};
        const lv = r[R.level] = r[R.level] || { w: 0, l: 0 };
        if (won) lv.w++; else lv.l++;
        saveRecord();
      }
      const res = Act.scores.submit(ID, R.level, me.profile, R.bestRally, { daily });
      if (res.newBest) scr.burst("New best!");
      if (won) A.sfx.win(); else A.sfx.lose();
      const list = daily ? Act.scores.dailyTop(ID) : Act.scores.top(ID, R.level);
      setTimeout(() => {
        if (A.currentScreen !== "pp-play") return;
        scr.showPanel({
          html: `<h2>${won ? "You win!" : "The computer wins"}</h2>
            <p class="big-score">${me.score} – ${cpu.score}</p>
            ${daily ? `<p class="note">Daily twist: ${esc(R.twistName)}</p>` : ""}
            <p class="note">Longest rally: <b>${R.bestRally}</b>${me.profile.id && !daily ? ` · your best on ${LEVELS[R.level].name}: <b>${res.best}</b>` : ""}</p>
            <h3 class="label">${daily ? "Today's top rallies" : `Top rallies on ${LEVELS[R.level].name}`}</h3>
            ${Act.topListHtml(list, res.rank)}`,
          buttons: [{ label: "Play again", cls: "big", run: restart }, { label: "Menu", cls: "ghost", run: () => (daily ? showMenu() : showLevels()) }]
        });
      }, res.newBest ? 900 : 300);
      return;
    }
    if (winner && winner.profile.id) { wins[winner.profile.id] = (wins[winner.profile.id] || 0) + 1; saveWins(); }
    A.sfx.win();
    const buttons = [{ label: "Play again", cls: "big", run: restart }, { label: "Menu", cls: "ghost", run: showMenu }];
    if (R.mode === "two") {
      const line = p => (p === winner ? `<h2>You win!</h2><p>${p.score} – ${R.paddles.find(o => o !== p).score}</p>`
        : `<h2>${esc(name(winner))} wins</h2><p>${p.score} – ${winner.score}</p>`);
      scr.showPanel({ split: { top: line(R.paddles[1]), bottom: line(R.paddles[0]) }, buttons });
    } else {
      const order = R.paddles.slice().sort((a, b) => (b === winner) - (a === winner) || b.lives - a.lives);
      scr.showPanel({
        html: `<h2>${esc(name(winner))} wins!</h2><ol class="top5">${order.map(p => `<li class="${p === winner ? "me" : ""}">
          ${A.avatarSvg(p.profile)}<span class="nm">${esc(name(p))}</span><b>${p === winner ? "Winner" : "Out"}</b></li>`).join("")}</ol>`,
        buttons
      });
    }
  }

  /* ---------- HUD ---------- */
  let hudText = "";
  function updateHud() {
    let html;
    if (R.mode === "cpu" || R.mode === "daily") html = `<span>Rally</span><b>${R.rally}</b>${R.mode === "daily" ? `<span class="twist">${esc(R.twistName)}</span>` : `<span>Best ${R.bestRally}</span>`}`;
    else if (R.mode === "two") html = `<span>First to ${TARGET}</span>`;
    else html = `<span>${LIVES_4P} lives each</span>`;
    if (html !== hudText) { scr.hud.innerHTML = html; hudText = html; }
  }

  /* ---------- Drawing ---------- */
  const FONT = px => `${px}px "Gochi Hand", "Comic Sans MS", cursive`;
  const ROT = { bottom: 0, top: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 };

  function render() {
    if (!R) return;
    const ctx = scr.ctx, w = W(), h = H();
    ctx.clearRect(0, 0, w, h);
    // Court lines.
    ctx.save();
    ctx.strokeStyle = "rgba(242,240,230,.18)";
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 12]);
    if (R.mode === "four") { ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.18, 0, Math.PI * 2); ctx.stroke(); }
    else { ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke(); }
    ctx.setLineDash([]);
    // Walls (sides without a paddle), drawn as solid chalk.
    ctx.strokeStyle = "rgba(242,240,230,.75)";
    ctx.lineWidth = 6;
    for (const side of SIDES) {
      if (!isWall(side)) continue;
      ctx.beginPath();
      if (side === "left") { ctx.moveTo(3, 0); ctx.lineTo(3, h); }
      if (side === "right") { ctx.moveTo(w - 3, 0); ctx.lineTo(w - 3, h); }
      if (side === "top") { ctx.moveTo(0, 3); ctx.lineTo(w, 3); }
      if (side === "bottom") { ctx.moveTo(0, h - 3); ctx.lineTo(w, h - 3); }
      ctx.stroke();
    }
    ctx.restore();

    drawScores(ctx);
    for (const k of R.bumpers) {
      ctx.fillStyle = "rgba(127,221,232,.25)"; ctx.strokeStyle = ACCENT; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(k.x, k.y, k.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    if (R.item) drawItem(ctx, R.item);
    dustFx.draw(ctx);
    for (const b of R.balls) drawBall(ctx, b);
    for (const p of R.paddles) if (p.alive) drawPaddle(ctx, p);
  }

  // Each player's score sits on their side, turned to face them.
  function drawScores(ctx) {
    const w = W(), h = H();
    for (const p of R.paddles) {
      ctx.save();
      const pos = { bottom: [w / 2, h * 0.68], top: [w / 2, h * 0.32], left: [w * 0.3, h / 2], right: [w * 0.7, h / 2] }[p.side];
      ctx.translate(pos[0], pos[1]);
      ctx.rotate(ROT[p.side]);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = p.alive ? 0.22 : 0.1;
      ctx.fillStyle = P_COLORS[p.idx];
      const label = R.mode === "four" ? "♥".repeat(Math.max(0, p.lives)) || "out" : String(p.score);
      ctx.font = FONT(Math.round(Math.min(w, h) * (R.mode === "four" ? 0.08 : 0.16)));
      ctx.fillText(label, 0, 0);
      ctx.globalAlpha = p.alive ? 0.5 : 0.25;
      ctx.font = FONT(18);
      ctx.fillText(p.profile.name, 0, Math.min(w, h) * (R.mode === "four" ? 0.07 : 0.11));
      ctx.restore();
    }
  }

  function drawBall(ctx, b) {
    let alpha = 1;
    if (b.type === "ghost") {
      // Invisible for a moment in the middle of the court.
      const mid = R.mode === "four" ? Math.hypot(b.x - W() / 2, b.y - H() / 2) < Math.min(W(), H()) * 0.2
        : Math.abs(b.y - H() / 2) < H() * 0.17;
      alpha = mid ? 0 : 1;
    }
    if (!alpha) return;
    const color = { normal: "#f2f0e6", splitter: "#f3d36b", curve: "#d7b4f3", speed: "#ff8a65", ghost: "#cfd8dc" }[b.type];
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(b.x, b.y, R.ballR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(38,61,48,.5)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(b.x - R.ballR * 0.25, b.y - R.ballR * 0.25, R.ballR * 0.45, Math.PI, Math.PI * 1.6); ctx.stroke();
    ctx.restore();
  }

  function drawItem(ctx, it) {
    const r = it.r;
    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.globalAlpha = it.until - R.t < 2 && Math.floor(R.t * 8) % 2 ? 0.4 : 1;
    ctx.strokeStyle = ACCENT; ctx.lineWidth = 3; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.arc(0, 0, r, R.t, R.t + Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "#f2f0e6"; ctx.fillStyle = "#f2f0e6"; ctx.lineWidth = 3; ctx.lineCap = "round";
    if (it.type === "big") { ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.lineTo(r * 0.6, 0); ctx.moveTo(-r * 0.6, -r * 0.3); ctx.lineTo(-r * 0.6, r * 0.3); ctx.moveTo(r * 0.6, -r * 0.3); ctx.lineTo(r * 0.6, r * 0.3); ctx.stroke(); }
    if (it.type === "tiny") { ctx.beginPath(); ctx.moveTo(-r * 0.25, 0); ctx.lineTo(r * 0.25, 0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r * 0.7, -r * 0.4); ctx.lineTo(-r * 0.4, 0); ctx.lineTo(-r * 0.7, r * 0.4); ctx.moveTo(r * 0.7, -r * 0.4); ctx.lineTo(r * 0.4, 0); ctx.lineTo(r * 0.7, r * 0.4); ctx.stroke(); }
    if (it.type === "shield") { ctx.beginPath(); ctx.moveTo(0, -r * 0.6); ctx.lineTo(r * 0.5, -r * 0.35); ctx.lineTo(r * 0.4, r * 0.25); ctx.lineTo(0, r * 0.6); ctx.lineTo(-r * 0.4, r * 0.25); ctx.lineTo(-r * 0.5, -r * 0.35); ctx.closePath(); ctx.stroke(); }
    if (it.type === "freeze") { for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6); ctx.lineTo(-Math.cos(a) * r * 0.6, -Math.sin(a) * r * 0.6); ctx.stroke(); } }
    ctx.restore();
  }

  /* The paddle's look follows the picture theme (a snowman paddle, a balloon paddle, and so on). */
  const BALLOON = ["#f29a9a", "#f3d36b", "#9fd3e8", "#b8e986", "#d7b4f3"];
  function drawPaddle(ctx, p) {
    const len = paddleLen(p), t = THICK, line = lineOf(p);
    ctx.save();
    if (horizontal(p)) ctx.translate(p.pos, line); else ctx.translate(line, p.pos);
    if (!horizontal(p)) ctx.rotate(Math.PI / 2);
    if (p.effects.freeze > R.t) ctx.globalAlpha = 0.6;
    const half = len / 2;
    const bar = (fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-half, -t / 2, len, t, t / 2) : ctx.rect(-half, -t / 2, len, t); ctx.fill(); };
    switch (R.themeId) {
      case "snowman": {
        const n = Math.max(3, Math.round(len / (t * 1.4)));
        for (let i = 0; i < n; i++) { const x = -half + t * 0.7 + i * (len - t * 1.4) / (n - 1); ctx.fillStyle = "#f2f0e6"; ctx.beginPath(); ctx.arc(x, 0, t * 0.7, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = "#f2a65a"; ctx.beginPath(); ctx.moveTo(-3, -t * 0.2); ctx.lineTo(3, -t * 0.2); ctx.lineTo(0, -t * 1.1); ctx.fill();
        break;
      }
      case "balloons": {
        const n = Math.max(3, Math.round(len / (t * 1.5)));
        for (let i = 0; i < n; i++) { const x = -half + t * 0.75 + i * (len - t * 1.5) / (n - 1); ctx.fillStyle = BALLOON[i % BALLOON.length]; ctx.beginPath(); ctx.ellipse(x, 0, t * 0.7, t * 0.85, 0, 0, Math.PI * 2); ctx.fill(); }
        break;
      }
      case "monster":
        bar("#b8e986");
        for (const x of [-t * 0.9, t * 0.9]) { ctx.fillStyle = "#f2f0e6"; ctx.beginPath(); ctx.arc(x, 0, t * 0.42, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#263d30"; ctx.beginPath(); ctx.arc(x, 0, t * 0.2, 0, Math.PI * 2); ctx.fill(); }
        break;
      case "pumpkin":
        bar("#f5a142");
        ctx.strokeStyle = "rgba(150,70,20,.6)"; ctx.lineWidth = 2;
        for (let x = -half + t; x < half - t / 2; x += t * 1.2) { ctx.beginPath(); ctx.moveTo(x, -t / 2 + 2); ctx.lineTo(x, t / 2 - 2); ctx.stroke(); }
        ctx.strokeStyle = "#7fb35a"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -t / 2); ctx.lineTo(3, -t); ctx.stroke();
        break;
      case "rocket":
        bar("#f2f0e6");
        ctx.fillStyle = "#ff8a65";
        for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sgn * half, -t / 2); ctx.lineTo(sgn * (half + t * 0.8), 0); ctx.lineTo(sgn * half, t / 2); ctx.fill(); }
        ctx.fillStyle = "#9fd3e8"; ctx.beginPath(); ctx.arc(0, 0, t * 0.28, 0, Math.PI * 2); ctx.fill();
        break;
      default:
        bar("#f2f0e6");
        ctx.strokeStyle = "#f3d36b"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-half + t / 2, 0); ctx.lineTo(half - t / 2, 0); ctx.stroke();
    }
    // Player color outline so everyone can find their own paddle.
    ctx.strokeStyle = P_COLORS[p.idx]; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-half - 3, -t / 2 - 3, len + 6, t + 6, t / 2 + 3) : ctx.rect(-half - 3, -t / 2 - 3, len + 6, t + 6); ctx.stroke();
    // Shield: a chalk line behind the paddle.
    if (p.effects.shield > R.t) { ctx.strokeStyle = ACCENT; ctx.lineWidth = 4; ctx.setLineDash([8, 6]); const behind = MARGIN - 6; ctx.beginPath(); ctx.moveTo(-half * 1.6, behind); ctx.lineTo(half * 1.6, behind); ctx.stroke(); ctx.setLineDash([]); }
    // Small timers for active power-ups.
    let k = 0;
    for (const [eff, color] of [["big", "#b8e986"], ["tiny", "#f29a9a"], ["shield", ACCENT], ["freeze", "#9fd3e8"]]) {
      const left = p.effects[eff] - R.t;
      if (left <= 0) continue;
      const x = half + 14 + k * 18;
      ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(x, 0, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, left / POWER_TIME[eff])); ctx.stroke();
      k++;
    }
    ctx.restore();
  }

  /* ---------- Register with the arcade ---------- */
  A.registerGame({
    id: ID,
    name: "Pong Party",
    accent: ACCENT,
    twists: TWISTS,
    icon: `<path d="M14 7 H34 M14 41 H34"/><circle class="accf" cx="27" cy="22" r="3.5"/>
      <path class="acc" d="M21 32 l4 -7" stroke-dasharray="2 4"/>`,
    open: showMenu,
    _round: () => R, // read-only peek at the match in progress, for testing
    badge: () => (todayTwist() ? "Daily twist" : null),
    tileStat(playerId) {
      const best = Act.scores.bestAny(ID, playerId);
      return best ? `Best rally: ${best}` : null;
    },
    resetStats() { Act.scores.reset(ID); record = {}; wins = {}; saveRecord(); saveWins(); },
    forgetPlayer(id) {
      Act.scores.forgetPlayer(ID, id);
      delete record[id]; delete wins[id];
      saveRecord(); saveWins();
      for (const n of [2, 4]) A.store.set(`pong-party:lastSetup${n}`, A.store.get(`pong-party:lastSetup${n}`, []).filter(e => e.id !== id));
    }
  });
})();

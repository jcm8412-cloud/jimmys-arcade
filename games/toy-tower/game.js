/* Toy Tower (stage 1): the hero's movement and controls on one test level. A climbing platformer on a tile
   grid: girders you can jump up through, solid blocks, ladders, vines and ropes. All movement numbers are
   in config.js (TT.CONFIG). Built on the shared action kit (Arcade.Action).
   Opening the arcade with ?tune in its address adds a Tune panel with a slider for every number.
   Saved data: toy-tower:tune (tuned numbers, only used with ?tune). */
(function () {
  const A = window.Arcade, Act = A.Action, TT = window.TT;
  const $ = id => document.getElementById(id);
  const esc = A.esc;
  const ID = "toy-tower";
  const ACCENT = "#ffc46b";
  const C = TT.CONFIG;
  const DEFAULTS = JSON.parse(JSON.stringify(C));
  const TUNING = /[?&]tune\b/.test(location.search);
  const EPS = 0.001;

  // Tuned numbers from the ?tune panel are kept on this device (only used with ?tune).
  function deepAssign(dst, src) {
    for (const k of Object.keys(src || {})) {
      if (!(k in dst)) continue;
      if (dst[k] && typeof dst[k] === "object") deepAssign(dst[k], src[k]); else if (typeof src[k] === typeof dst[k]) dst[k] = src[k];
    }
  }
  if (TUNING) deepAssign(C, A.store.get("toy-tower:tune", {}));

  /* ---------- Menu ---------- */
  const home = `<button class="icon-btn" data-home aria-label="Home"></button>`;
  $("game-root").insertAdjacentHTML("beforeend", `
  <section class="screen tt menu" id="tt-menu" hidden>
    <header class="topbar"><div class="tb-left">${home}</div><h2></h2><div class="tb-right"></div></header>
    <h1 class="title">Toy <span>Tower</span></h1>
    <p class="tagline">Bandit the raccoon swiped your toys. Climb up and get them back!</p>
    <div class="menu-buttons">
      <button class="btn big" id="tt-btn-test">Test level</button>
    </div>
    <p class="note center-text">Bandit's hideouts are coming soon. For now, try out the running, jumping and climbing.</p>
  </section>`);

  const scr = Act.createScreen({
    id: "tt-play", cls: "tt",
    onRestart: () => startLevel(),
    onQuit: () => A.goHome(),
    onResize: () => { if (G) layout(); }
  });

  function showMenu() { A.setAccent(ACCENT); A.show("tt-menu"); }
  $("tt-btn-test").addEventListener("click", () => A.whoIsPlaying({ onDone: startLevel, onBack: showMenu, backLabel: "Toy Tower" }));

  /* ---------- Level ---------- */
  let LEVEL = null;
  async function loadLevel() {
    if (LEVEL) return LEVEL;
    const res = await fetch("games/toy-tower/test-level.json");
    if (!res.ok) throw new Error("test-level.json " + res.status);
    const data = await res.json();
    const cols = Math.max(...data.rows.map(r => r.length));
    LEVEL = { name: data.name, cols, rows: data.rows.map(r => r.padEnd(cols, ".")) };
    return LEVEL;
  }

  /* ---------- Game state ----------
     G: { level, stars Set("c,r"), starsTotal, start {x, y}, hero, camY, t }
     hero: { x (middle), y (feet), vx, vy, onGround, climb {c, top, bottom, kind} | null, face, coyoteT, bufferT,
             jumping, wall (-1, 0, 1: touching a wall on that side), wallT, lastWall, lockT, regrabT, dropT,
             landT, slideV, runPhase } */
  let G = null;
  const dustFx = Act.dust(60);
  const F = {};

  async function startLevel() {
    let level;
    try { level = await loadLevel(); } catch (err) { A.toast("Couldn't load the level. Try again."); return; }
    G = { level, stars: new Set(), starsTotal: 0, t: 0, camY: 0, player: A.session.player };
    level.rows.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch === "S") G.start = { x: c + 0.5, y: r + 1 };
      if (ch === "*") G.starsTotal++;
    }));
    G.got = new Set();
    makeAvatarImage(G.player);
    respawn();
    A.setAccent(ACCENT);
    scr.show();
    requestAnimationFrame(() => {
      scr.start(update, render);
      G.camY = camTarget(); // no swoop at the start
      updateHud();
    });
  }
  function respawn() {
    G.hero = {
      x: G.start.x, y: G.start.y, vx: 0, vy: 0, onGround: true, climb: null, face: 1, coyoteT: 0, bufferT: 0, jumping: false,
      wall: 0, wallT: 0, lastWall: 0, lockT: 0, regrabT: 0, dropT: 0, landT: 0, slideV: 0, runPhase: 0
    };
  }

  /* ---------- Tiles ---------- */
  const tileAt = (c, r) => {
    const L = G.level;
    if (c < 0 || c >= L.cols) return "#";          // the sides of the tower are walls
    if (r < 0 || r >= L.rows.length) return ".";    // open above the top and below the bottom
    return L.rows[r][c];
  };
  const solid = (c, r) => tileAt(c, r) === "#";
  const platform = (c, r) => tileAt(c, r) === "=";
  const isClimb = t => t === "H" || t === "V" || t === "R";
  // A girder with a ladder (or vine, or rope) under it is climbable too, so you can climb up onto it.
  const climbable = (c, r) => isClimb(tileAt(c, r)) || (platform(c, r) && isClimb(tileAt(c, r + 1)));
  const climbKind = (c, r) => (isClimb(tileAt(c, r)) ? tileAt(c, r) : tileAt(c, r + 1));

  /* ---------- Input: the pad, Jump and Use buttons, and the keyboard ---------- */
  scr.controls.innerHTML = `
    <div class="tt-pad" id="tt-pad" aria-label="Move"><i class="u"></i><i class="d"></i><i class="l"></i><i class="r"></i><b></b></div>
    <div class="tt-btns">
      <button class="tt-use" id="tt-use" aria-label="Use power-up">Use</button>
      <button class="tt-jump" id="tt-jump" aria-label="Jump">Jump</button>
    </div>`;
  const pad = { left: false, right: false, up: false, down: false };
  const keys = { left: false, right: false, up: false, down: false };
  const input = () => ({ left: pad.left || keys.left, right: pad.right || keys.right, up: pad.up || keys.up, down: pad.down || keys.down });
  let jumpHeld = false;
  function pressJump() { jumpHeld = true; if (G && scr.running) G.hero.bufferT = C.jump.bufferTime; }
  function releaseJump() { jumpHeld = false; }

  // The pad: where the thumb sits (8 directions) sets the direction, so it can roll between them without lifting.
  const padEl = $("tt-pad");
  let padPointer = null;
  function readPad(e) {
    const r = padEl.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const dead = r.width * 0.12;
    pad.left = pad.right = pad.up = pad.down = false;
    if (Math.hypot(dx, dy) >= dead) {
      const sector = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)); // 0 right, 2 down, ±4 left, -2 up
      const s = (sector + 8) % 8;
      pad.right = s === 0 || s === 1 || s === 7;
      pad.down = s === 1 || s === 2 || s === 3;
      pad.left = s === 3 || s === 4 || s === 5;
      pad.up = s === 5 || s === 6 || s === 7;
    }
    padEl.className = "tt-pad" + ["left", "right", "up", "down"].filter(k => pad[k]).map(k => " on-" + k).join("");
  }
  padEl.addEventListener("pointerdown", e => { padPointer = e.pointerId; try { padEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } readPad(e); e.preventDefault(); });
  padEl.addEventListener("pointermove", e => { if (e.pointerId === padPointer) readPad(e); });
  const padUp = e => { if (e.pointerId !== padPointer) return; padPointer = null; pad.left = pad.right = pad.up = pad.down = false; padEl.className = "tt-pad"; };
  padEl.addEventListener("pointerup", padUp);
  padEl.addEventListener("pointercancel", padUp);

  const jumpEl = $("tt-jump");
  jumpEl.addEventListener("pointerdown", e => { try { jumpEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } pressJump(); jumpEl.classList.add("on"); e.preventDefault(); });
  const jumpUp = () => { releaseJump(); jumpEl.classList.remove("on"); };
  jumpEl.addEventListener("pointerup", jumpUp);
  jumpEl.addEventListener("pointercancel", jumpUp);
  $("tt-use").addEventListener("pointerdown", e => { e.preventDefault(); useItem(); });
  function useItem() { if (G && scr.running) scr.message("No power-up yet", 800); }
  // Long-press menus and double-tap zoom stay out of the way of thumbs.
  scr.controls.addEventListener("contextmenu", e => e.preventDefault());
  scr.controls.addEventListener("touchmove", e => e.preventDefault(), { passive: false });

  const KEYMAP = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
  document.addEventListener("keydown", e => {
    if (A.currentScreen !== "tt-play" || A.dialogOpen() || (e.target && e.target.tagName === "INPUT")) return;
    if (KEYMAP[e.key]) { keys[KEYMAP[e.key]] = true; e.preventDefault(); }
    else if (e.key === " ") { e.preventDefault(); if (!e.repeat) pressJump(); }
    else if (e.key === "x" || e.key === "X") { if (!e.repeat) useItem(); }
  });
  document.addEventListener("keyup", e => {
    if (KEYMAP[e.key]) keys[KEYMAP[e.key]] = false;
    if (e.key === " ") releaseJump();
  });

  /* ---------- Movement ---------- */
  const approach = (v, target, step) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));
  const hw = () => C.hero.width / 2, hh = () => C.hero.height;
  const colsUnder = h => [Math.floor(h.x - hw() + EPS), Math.floor(h.x + hw() - EPS)];

  function update(dt) {
    G.t += dt;
    const h = G.hero, inp = input();
    for (const k of ["coyoteT", "bufferT", "wallT", "lockT", "regrabT", "dropT", "landT"]) if (h[k] > 0) h[k] -= dt;
    if (h.climb) updateClimb(h, inp, dt); else updateMove(h, inp, dt);
    collectStars(h);
    // Falling off the bottom: back to the start (hearts come later).
    if (h.y - hh() > G.level.rows.length + 1) { scr.message("Whoops! Back to the start", 1000); respawn(); G.camY = camTarget(); }
    const target = camTarget();
    G.camY += (target - G.camY) * Math.min(1, dt * 6);
    dustFx.update(dt);
  }

  function updateMove(h, inp, dt) {
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir) h.face = dir;
    // Run and steer: quick to start, quick to stop, full control in the air.
    const ground = h.onGround;
    const max = ground ? C.run.maxSpeed : C.air.maxSpeed;
    let accel = dir ? (h.vx && Math.sign(h.vx) !== dir ? (ground ? C.run.turnAccel : C.air.accel * 1.5) : (ground ? C.run.accel : C.air.accel)) : (ground ? C.run.decel : C.air.decel);
    if (h.lockT > 0) accel *= C.wall.lockControl;
    h.vx = approach(h.vx, dir * max, accel * dt);

    // Jumping: from the ground (or just after leaving it), or off a wall.
    if (h.bufferT > 0) {
      if (ground || h.coyoteT > 0) {
        if (inp.down && ground && standingOnGirderOnly(h)) {
          // Down + Jump on a girder drops through it.
          h.dropT = 0.2; h.y += 0.02; h.onGround = false; h.bufferT = 0;
        } else {
          h.vy = -C.jump.speed; h.jumping = true; h.onGround = false; h.coyoteT = 0; h.bufferT = 0;
        }
      } else if (h.wall || h.wallT > 0) {
        const away = -(h.wall || h.lastWall);
        h.vx = away * C.wall.jumpX; h.vy = -C.wall.jumpY; h.face = away;
        h.lockT = C.wall.lockTime; h.jumping = true; h.bufferT = 0; h.wallT = 0;
        dustFx.emit(px(h.x - away * hw()), px(h.y - hh() / 2), "#f2f0e6", 4);
      }
    }
    // Variable height: letting go early turns a jump into a hop.
    if (h.jumping && !jumpHeld && h.vy < -C.jump.cutSpeed) { h.vy = -C.jump.cutSpeed; h.jumping = false; }
    if (h.vy >= 0) h.jumping = false;

    // Gravity, with a slow slide when pressing into a wall.
    const g = h.vy < 0 ? C.gravity : C.fallGravity;
    const sliding = !h.onGround && h.wall && dir === h.wall && h.vy > 0;
    h.vy = Math.min(h.vy + g * dt, sliding ? C.wall.slideSpeed : C.maxFall);

    // Move in small steps so nothing is skipped.
    const fallSpeed = h.vy, wasGround = h.onGround;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(h.vx), Math.abs(h.vy)) * dt / 0.2));
    h.wall = 0;
    for (let i = 0; i < steps; i++) { moveX(h, h.vx * dt / steps, dir); moveY(h, h.vy * dt / steps, dir); }

    h.onGround = supported(h);
    if (h.onGround && !wasGround) landed(h, fallSpeed);
    if (wasGround && !h.onGround && h.vy >= 0) h.coyoteT = C.jump.coyoteTime; // walked off a ledge
    // Touching a wall (in the air): wall jumps and wall slides.
    if (!h.onGround) {
      for (const side of [-1, 1]) if (wallAt(h, side)) h.wall = side;
      if (h.wall) { h.wallT = C.wall.coyoteTime; h.lastWall = h.wall; }
    }
    if (h.onGround) h.runPhase += Math.abs(h.vx) * dt * 2.2;

    tryGrab(h, inp);
  }

  function standingOnGirderOnly(h) {
    const r = Math.round(h.y), [c0, c1] = colsUnder(h);
    let girder = false;
    for (let c = c0; c <= c1; c++) { if (solid(c, r)) return false; if (platform(c, r)) girder = true; }
    return girder;
  }
  function supported(h) {
    const r = Math.round(h.y);
    if (Math.abs(h.y - r) > 0.01 || h.vy < 0) return false;
    const [c0, c1] = colsUnder(h);
    for (let c = c0; c <= c1; c++) if (solid(c, r) || (platform(c, r) && h.dropT <= 0)) return true;
    return false;
  }
  function wallAt(h, side) {
    const x = side > 0 ? h.x + hw() + 0.04 : h.x - hw() - 0.04;
    return solid(Math.floor(x), Math.floor(h.y - hh() * 0.5));
  }
  function landed(h, speed) {
    h.landT = C.land.squashTime;
    h.jumping = false;
    if (speed > C.land.dustSpeed) {
      dustFx.emit(px(h.x), px(h.y), "#f2f0e6", Math.min(12, Math.round(speed / 2)));
      if (speed > C.land.dustSpeed * 2) A.sfx.right();
    }
  }
  const boxFree = (x, y) => {
    const c0 = Math.floor(x - hw() + EPS), c1 = Math.floor(x + hw() - EPS), r0 = Math.floor(y - hh() + EPS), r1 = Math.floor(y - EPS);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (solid(c, r)) return false;
    return true;
  };

  function moveX(h, dx) {
    if (!dx) return;
    h.x += dx;
    const side = Math.sign(dx);
    const edge = side > 0 ? h.x + hw() - EPS : h.x - hw() + EPS;
    const c = Math.floor(edge);
    const r0 = Math.floor(h.y - hh() + EPS), r1 = Math.floor(h.y - EPS);
    let top = null;
    for (let r = r0; r <= r1; r++) if (solid(c, r)) { top = r; break; }
    if (top == null) {
      // Ledge forgiveness on girders too: moving into a girder whose top is just above your feet pulls you up onto it.
      const r = Math.floor(h.y - EPS);
      if (!h.onGround && h.dropT <= 0 && h.vy > -2 && platform(c, r) && h.y - r <= C.ledge.pullUp && boxFree(h.x, r)) {
        h.y = r; h.vy = 0; h.onGround = true; h.jumping = false;
      }
      return;
    }
    // Ledge forgiveness: feet just below the top of the block, so pull up onto it.
    if (!h.onGround && !solid(c, top - 1) && h.y - top > 0 && h.y - top <= C.ledge.pullUp && boxFree(h.x, top)) {
      h.y = top; h.vy = Math.min(h.vy, 0); h.onGround = true; h.jumping = false;
      return;
    }
    h.x = side > 0 ? c - hw() : c + 1 + hw();
    h.vx = 0;
    h.wall = side;
  }

  function moveY(h, dy, dir) {
    if (!dy) return;
    const [c0, c1] = colsUnder(h);
    if (dy > 0) {
      const ny = h.y + dy;
      for (let r = Math.ceil(h.y - EPS); r <= Math.floor(ny); r++) {
        for (let c = c0; c <= c1; c++) {
          if (solid(c, r) || (platform(c, r) && h.dropT <= 0)) { h.y = r; h.vy = 0; return; }
        }
        // Ledge forgiveness: just past the end of a platform, moving toward it, still lands on it.
        for (const side of [-1, 1]) {
          if (side !== dir && side !== Math.sign(h.vx)) continue;
          const c = Math.floor(side > 0 ? h.x + hw() + C.ledge.edgeReach - EPS : h.x - hw() - C.ledge.edgeReach + EPS);
          if (c >= c0 && c <= c1) continue;
          const top = solid(c, r) && !solid(c, r - 1);
          if (!(top || (platform(c, r) && h.dropT <= 0))) continue;
          const x = side > 0 ? c + 0.08 - hw() : c + 1 - 0.08 + hw();
          if (!boxFree(x, r)) continue;
          h.x = x; h.y = r; h.vy = 0;
          return;
        }
      }
      h.y = ny;
    } else {
      const ny = h.y + dy, headRow = Math.floor(ny - hh());
      const hits = [];
      for (let c = c0; c <= c1; c++) if (solid(c, headRow)) hits.push(c);
      if (!hits.length) { h.y = ny; return; }
      // Corner nudge: clipped a corner by a little, so slide around it.
      if (hits.length === 1) {
        const c = hits[0], left = h.x - hw(), right = h.x + hw();
        const overlapL = c + 1 - left, overlapR = right - c;
        const nx = c === c0 && overlapL <= C.ledge.cornerNudge ? c + 1 + hw() + EPS : c === c1 && overlapR <= C.ledge.cornerNudge ? c - hw() - EPS : null;
        if (nx != null && boxFree(nx, ny)) { h.x = nx; h.y = ny; return; }
      }
      h.y = headRow + 1 + hh();
      h.vy = 0; h.jumping = false;
    }
  }

  /* ---------- Ladders, vines and ropes ---------- */
  // Find a climbable column close to the hero: rows checked are around the body (or just under the feet when going down).
  function climbNear(h, rows) {
    let best = null;
    for (const r of rows) for (const c of [Math.floor(h.x) - 1, Math.floor(h.x), Math.floor(h.x) + 1]) {
      if (!climbable(c, r)) continue;
      const d = Math.abs(h.x - (c + 0.5));
      if (d <= C.climb.snap && (!best || d < best.d)) best = { c, r, d };
    }
    return best;
  }
  function tryGrab(h, inp) {
    if (h.regrabT > 0) return;
    let hit = null;
    if (inp.up) hit = climbNear(h, [Math.floor(h.y - hh() * 0.5), Math.floor(h.y - 0.05)]);
    else if (inp.down && h.onGround) hit = climbNear(h, [Math.round(h.y)]);                      // standing on top of a ladder
    else if (!h.onGround && C.climb.autoGrab && !inp.down) hit = climbNear(h, [Math.floor(h.y - hh() * 0.5)]); // jumping into one
    if (!hit) return;
    if (inp.up && h.onGround && !climbable(hit.c, Math.floor(h.y - hh() * 0.5)) && !climbable(hit.c, Math.floor(h.y - 0.05))) return;
    let top = hit.r, bottom = hit.r;
    while (climbable(hit.c, top - 1)) top--;
    while (climbable(hit.c, bottom + 1)) bottom++;
    if (inp.down && h.onGround) { if (Math.round(h.y) !== top) return; h.y += 0.05; } // step down onto the ladder
    else if (inp.up && h.onGround && Math.round(h.y) <= top) return;                    // already at the top
    h.climb = { c: hit.c, top, bottom: bottom + 1, kind: climbKind(hit.c, hit.r) };
    h.y = Math.min(h.y, h.climb.bottom); // grabbed the end of a rope with feet hanging below it: hang from the end
    h.vx = 0; h.vy = 0; h.onGround = false; h.jumping = false; h.slideV = C.climb.downSpeed;
  }
  function updateClimb(h, inp, dt) {
    const cl = h.climb;
    h.x = approach(h.x, cl.c + 0.5, C.climb.centerSpeed * dt);
    // Jump off in any direction (Down + Jump just lets go).
    if (h.bufferT > 0) {
      h.bufferT = 0;
      h.climb = null;
      h.regrabT = C.climb.regrabDelay;
      const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      if (inp.down && !dir) { h.vy = 0; return; }
      h.vy = -(inp.up ? C.climb.jumpUp : C.climb.jumpSide);
      h.vx = dir * C.climb.jumpOffX;
      if (dir) h.face = dir;
      h.jumping = true;
      return;
    }
    if (inp.up) { h.vy = -C.climb.upSpeed; h.slideV = C.climb.downSpeed; }
    else if (inp.down) { h.slideV = approach(h.slideV, C.climb.slideSpeed, C.climb.slideAccel * dt); h.vy = h.slideV; } // hold to slide fast
    else { h.vy = 0; h.slideV = C.climb.downSpeed; }
    const ny = h.y + h.vy * dt;
    if (ny <= cl.top) {
      // Reached the top: step off onto the girder there (if there is one).
      h.y = cl.top;
      const [c0, c1] = colsUnder(h);
      let floor = false;
      for (let c = c0; c <= c1; c++) if (solid(c, cl.top) || platform(c, cl.top)) floor = true;
      if (floor) { h.climb = null; h.vy = 0; h.onGround = true; }
      return;
    }
    if (h.vy > 0 && ny >= cl.bottom) {
      // Reached the bottom: stand on the ground there, or drop off the end of a rope or vine.
      h.climb = null;
      h.y = cl.bottom;
      h.onGround = supported(h);
      if (h.onGround) { landed(h, h.vy); h.vy = 0; } else { h.regrabT = C.climb.regrabDelay; }
      return;
    }
    h.y = ny;
    // Walking off at the bottom with left or right.
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir && !inp.up && !inp.down && Math.abs(h.y - cl.bottom) < 0.05) { h.climb = null; h.face = dir; }
  }

  function collectStars(h) {
    const c0 = Math.floor(h.x - hw()), c1 = Math.floor(h.x + hw()), r0 = Math.floor(h.y - hh()), r1 = Math.floor(h.y - EPS);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      if (tileAt(c, r) !== "*" || G.got.has(c + "," + r)) continue;
      G.got.add(c + "," + r);
      A.sfx.win();
      dustFx.emit(px(c + 0.5), px(r + 0.5), "#f3d36b", 12);
      scr.message(G.got.size === G.starsTotal ? "All the stars!" : "Star!", 900);
      updateHud();
    }
  }

  /* ---------- Camera and layout ---------- */
  const W = () => scr.size.w, H = () => scr.size.h;
  const px = t => t * F.s; // tiles -> pixels
  function layout() {
    F.s = Math.min(W() / G.level.cols, H() / 12);
    F.ox = (W() - F.s * G.level.cols) / 2;
    F.viewRows = H() / F.s;
  }
  function camTarget() {
    if (!F.s) layout();
    const rows = G.level.rows.length, h = G.hero;
    const y = h.y - F.viewRows * 0.6;
    return Math.max(Math.min(0, rows - F.viewRows), Math.min(rows - F.viewRows, y));
  }

  let hudText = "";
  function updateHud() {
    const html = `<span>${esc(G.level.name)}</span><span class="stars">★ ${G.got.size}/${G.starsTotal}</span>`;
    if (html !== hudText) { scr.hud.innerHTML = html; hudText = html; }
  }

  /* ---------- Drawing ---------- */
  function render() {
    if (!G || !F.s) return;
    const ctx = scr.ctx, s = F.s, L = G.level;
    ctx.clearRect(0, 0, W(), H());
    ctx.save();
    ctx.translate(F.ox, -G.camY * s);
    const r0 = Math.max(0, Math.floor(G.camY) - 1), r1 = Math.min(L.rows.length - 1, Math.ceil(G.camY + F.viewRows) + 1);
    // Faint tower beams in the background.
    ctx.strokeStyle = "rgba(242,240,230,.05)"; ctx.lineWidth = 2;
    for (let c = 0; c <= L.cols; c += 3) { ctx.beginPath(); ctx.moveTo(c * s, r0 * s); ctx.lineTo(c * s, (r1 + 1) * s); ctx.stroke(); }
    for (let r = r0; r <= r1; r++) for (let c = 0; c < L.cols; c++) drawTile(ctx, L.rows[r][c], c, r, s);
    dustFx.draw(ctx);
    drawHero(ctx, G.hero, s);
    ctx.restore();
  }

  function drawTile(ctx, t, c, r, s) {
    const x = c * s, y = r * s;
    if (t === "#") {
      ctx.fillStyle = "rgba(242,240,230,.14)"; ctx.fillRect(x, y, s, s);
      ctx.strokeStyle = "rgba(242,240,230,.35)"; ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 0.75, y + 0.75, s - 1.5, s - 1.5);
      ctx.beginPath(); ctx.moveTo(x, y + s / 2); ctx.lineTo(x + s, y + s / 2); ctx.moveTo(x + s / 2, y); ctx.lineTo(x + s / 2, y + s / 2); ctx.moveTo(x + s / 4, y + s / 2); ctx.lineTo(x + s / 4, y + s); ctx.stroke();
      return;
    }
    // Ladders, vines and ropes run up through the girder above them.
    const below = tileAt(c, r + 1);
    if (isClimb(t)) drawClimb(ctx, t, x, y, s, s);
    if (t === "=") {
      if (isClimb(below)) drawClimb(ctx, below, x, y, s, s);
      const gh = s * 0.32;
      ctx.fillStyle = "#f29a9a"; ctx.fillRect(x, y, s, gh);
      ctx.strokeStyle = "#263d30"; ctx.lineWidth = 1.5; ctx.beginPath();
      ctx.moveTo(x, y + gh); ctx.lineTo(x + s / 2, y); ctx.lineTo(x + s, y + gh); ctx.stroke();
      ctx.strokeStyle = "rgba(38,61,48,.5)"; ctx.strokeRect(x + 0.5, y + 0.5, s - 1, gh - 1);
    }
    if (t === "*" && !G.got.has(c + "," + r)) {
      const cx = x + s / 2, cy = y + s / 2 + Math.sin(G.t * 3 + c) * s * 0.06, rr = s * 0.32;
      ctx.fillStyle = "#f3d36b"; ctx.strokeStyle = "#8a5a34"; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let k = 0; k <= 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? rr * 0.45 : rr; ctx[k ? "lineTo" : "moveTo"](cx + Math.cos(a) * q, cy + Math.sin(a) * q); }
      ctx.fill(); ctx.stroke();
    }
    if (t === "S") {
      ctx.strokeStyle = "rgba(242,240,230,.5)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + s * 0.2, y + s); ctx.lineTo(x + s * 0.2, y + s * 0.2); ctx.stroke();
      ctx.fillStyle = "rgba(255,196,107,.6)"; ctx.beginPath(); ctx.moveTo(x + s * 0.2, y + s * 0.2); ctx.lineTo(x + s * 0.6, y + s * 0.32); ctx.lineTo(x + s * 0.2, y + s * 0.45); ctx.fill();
    }
  }
  function drawClimb(ctx, kind, x, y, w, h) {
    ctx.lineCap = "round";
    if (kind === "H") {
      ctx.strokeStyle = "rgba(242,240,230,.8)"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x + w * 0.22, y); ctx.lineTo(x + w * 0.22, y + h); ctx.moveTo(x + w * 0.78, y); ctx.lineTo(x + w * 0.78, y + h); ctx.stroke();
      ctx.lineWidth = 2; ctx.beginPath();
      for (let k = 1; k <= 3; k++) { const ry = y + h * (k / 3) - h / 6; ctx.moveTo(x + w * 0.22, ry); ctx.lineTo(x + w * 0.78, ry); }
      ctx.stroke();
    } else if (kind === "V") {
      ctx.strokeStyle = "#7fb35a"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x + w / 2, y);
      ctx.bezierCurveTo(x + w * 0.25, y + h * 0.33, x + w * 0.75, y + h * 0.66, x + w / 2, y + h); ctx.stroke();
      ctx.fillStyle = "#b8e986";
      for (const [lx, ly, sgn] of [[0.38, 0.3, -1], [0.62, 0.7, 1]]) { ctx.beginPath(); ctx.ellipse(x + w * lx + sgn * w * 0.08, y + h * ly, w * 0.12, w * 0.06, sgn * 0.6, 0, Math.PI * 2); ctx.fill(); }
    } else {
      ctx.strokeStyle = "#c9a26b"; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.stroke();
      ctx.strokeStyle = "rgba(92,59,34,.6)"; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let k = 0; k < 3; k++) { const ky = y + h * (k + 0.5) / 3; ctx.moveTo(x + w / 2 - 3, ky - 3); ctx.lineTo(x + w / 2 + 3, ky + 3); }
      ctx.stroke();
    }
  }

  // The player's avatar, drawn on the hero's shirt.
  let avatarImg = null, avatarFor = null;
  function makeAvatarImage(p) {
    const key = p && (p.avatar || p.name);
    if (key === avatarFor) return;
    avatarFor = key; avatarImg = null;
    const a = p && A.AVATARS[p.avatar];
    if (!a) return;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="#263d30" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><style>.dot{fill:#263d30;stroke:none}</style>${a.svg}</svg>`;
    const img = new Image();
    img.onload = () => { avatarImg = img; };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  function drawHero(ctx, h, s) {
    const p = G.player, av = p && A.AVATARS[p.avatar];
    const shirt = av ? av.color : ACCENT;
    const fx = h.x * s, fy = h.y * s;
    const bw = C.hero.width * s, bh = C.hero.height * s;
    // Squash on landing, stretch while rising fast.
    let sx = 1, sy = 1;
    if (h.landT > 0) { const k = h.landT / C.land.squashTime; sx = 1 + 0.25 * k; sy = 1 - 0.22 * k; }
    else if (!h.onGround && !h.climb && h.vy < -8) { sx = 0.92; sy = 1.08; }
    ctx.save();
    ctx.translate(fx, fy);
    ctx.scale(sx * (h.climb ? 1 : h.face), sy);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    const legY = -bh * 0.3, hipW = bw * 0.22;
    // Legs and sneakers.
    let swing = 0;
    if (h.climb) swing = Math.sin(h.y * 6) * 0.5;
    else if (h.onGround) swing = Math.abs(h.vx) > 0.5 ? Math.sin(h.runPhase * Math.PI) * 0.6 : 0;
    else swing = 0.5;
    ctx.strokeStyle = "#5a7fa8"; ctx.lineWidth = Math.max(3, bw * 0.2);
    const foot = (sgn, a) => {
      const ex = sgn * hipW + Math.sin(a) * bh * 0.28, ey = legY + Math.cos(a) * bh * 0.28;
      ctx.beginPath(); ctx.moveTo(sgn * hipW * 0.6, legY); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = "#f2f0e6"; ctx.beginPath(); ctx.ellipse(ex + bw * 0.08, ey, bw * 0.17, bw * 0.1, 0, 0, Math.PI * 2); ctx.fill();
    };
    if (!h.onGround && !h.climb) { foot(-1, -0.5); foot(1, 0.9); } else { foot(-1, swing); foot(1, -swing); }
    // Arms.
    ctx.strokeStyle = "#f5cfa0"; ctx.lineWidth = Math.max(2.5, bw * 0.15);
    const shoulderY = -bh * 0.66;
    for (const sgn of [-1, 1]) {
      let ax, ay;
      if (h.climb) { const up = Math.sin(h.y * 6) * sgn > 0; ax = sgn * bw * 0.45; ay = shoulderY - bh * (up ? 0.38 : 0.22); }
      else if (!h.onGround) { ax = sgn * bw * 0.55; ay = shoulderY - bh * 0.3; }
      else { ax = sgn * bw * 0.4 - swing * sgn * bw * 0.2; ay = shoulderY + bh * 0.28; }
      ctx.beginPath(); ctx.moveTo(sgn * bw * 0.3, shoulderY + bh * 0.04); ctx.lineTo(ax, ay); ctx.stroke();
    }
    // Shirt, with the player's avatar on it.
    ctx.fillStyle = shirt; ctx.strokeStyle = "#263d30"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-bw * 0.36, -bh * 0.72, bw * 0.72, bh * 0.44, bw * 0.12); else ctx.rect(-bw * 0.36, -bh * 0.72, bw * 0.72, bh * 0.44);
    ctx.fill(); ctx.stroke();
    if (avatarImg) ctx.drawImage(avatarImg, -bw * 0.24, -bh * 0.68, bw * 0.48, bw * 0.48);
    else if (p && p.name) { ctx.fillStyle = "#263d30"; ctx.font = `${Math.round(bw * 0.38)}px "Gochi Hand", cursive`; ctx.textAlign = "center"; ctx.fillText(p.name.charAt(0).toUpperCase(), 0, -bh * 0.42); }
    // Head and backwards cap.
    const headY = -bh * 0.85, hr = bw * 0.3;
    ctx.fillStyle = "#f5cfa0"; ctx.beginPath(); ctx.arc(0, headY, hr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#f29a9a"; ctx.beginPath(); ctx.arc(0, headY - hr * 0.15, hr * 1.02, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-hr * 0.8, headY - hr * 0.3); ctx.lineTo(-hr * 1.55, headY - hr * 0.05); ctx.stroke(); // the brim, pointing back
    if (!h.climb) { ctx.fillStyle = "#263d30"; ctx.beginPath(); ctx.arc(hr * 0.45, headY + hr * 0.05, hr * 0.14, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  /* ---------- ?tune: a slider for every number in TT.CONFIG ---------- */
  if (TUNING) {
    scr.stage.insertAdjacentHTML("beforeend", `<button class="tt-tune-btn" id="tt-tune-btn">Tune</button>`);
    // The panel sits outside the stage, so the stage's no-scroll touch handling doesn't block its sliders.
    scr.section.insertAdjacentHTML("beforeend", `
      <div class="tt-tune" id="tt-tune" hidden><div class="tt-tune-head"><b>Movement numbers</b>
        <button class="btn ghost" id="tt-tune-copy">Copy</button><button class="btn ghost" id="tt-tune-reset">Reset</button><button class="btn ghost" id="tt-tune-close">Close</button></div>
        <div id="tt-tune-list"></div></div>`);
    const list = $("tt-tune-list");
    const save = () => A.store.set("toy-tower:tune", C);
    function build() {
      list.innerHTML = "";
      const add = (obj, path, label, def) => {
        for (const [k, v] of Object.entries(obj)) {
          const name = label ? `${label}.${k}` : k;
          if (v && typeof v === "object") { add(v, path.concat(k), name, def[k]); continue; }
          const row = document.createElement("label");
          row.className = "tt-tune-row";
          if (typeof v === "boolean") {
            row.innerHTML = `<span>${esc(name)}</span><input type="checkbox" ${v ? "checked" : ""}>`;
            row.querySelector("input").addEventListener("change", e => { obj[k] = e.target.checked; save(); });
          } else {
            const max = Math.max(1, def[k] * 3), step = def[k] < 2 ? 0.01 : 0.5;
            row.innerHTML = `<span>${esc(name)}</span><input type="range" min="0" max="${max}" step="${step}" value="${v}"><output>${v}</output>`;
            const out = row.querySelector("output");
            row.querySelector("input").addEventListener("input", e => { obj[k] = +e.target.value; out.textContent = obj[k]; save(); });
          }
          list.appendChild(row);
        }
      };
      add(C, [], "", DEFAULTS);
    }
    build();
    $("tt-tune-btn").addEventListener("click", () => { $("tt-tune").hidden = !$("tt-tune").hidden; });
    $("tt-tune-close").addEventListener("click", () => { $("tt-tune").hidden = true; });
    $("tt-tune-reset").addEventListener("click", () => { deepAssign(C, JSON.parse(JSON.stringify(DEFAULTS))); A.store.set("toy-tower:tune", {}); build(); A.toast("Back to the starting numbers"); });
    $("tt-tune-copy").addEventListener("click", async () => {
      const text = "TT.CONFIG = " + JSON.stringify(C, null, 2) + ";";
      try { await navigator.clipboard.writeText(text); A.toast("Copied! Paste it to Claude."); } catch (err) { A.toast("Couldn't copy on this device"); }
    });
  }

  /* ---------- Register with the arcade ---------- */
  A.registerGame({
    id: ID,
    name: "Toy Tower",
    accent: ACCENT,
    icon: `<path d="M18 13 H42 M6 29 H30 M6 43 H42"/><path class="acc" d="M21 13 V29 M27 13 V29 M21 18 H27 M21 23 H27"/>
    <circle cx="37" cy="35" r="3"/><path d="M37 38 v3 M34 43 l3 -2 l3 2"/>`,
    open: showMenu,
    _state: () => G, // read-only peek at the game, for testing
    tileStat: () => "Test level",
    resetStats() { /* no stats yet */ },
    forgetPlayer() { /* no stats yet */ }
  });
})();

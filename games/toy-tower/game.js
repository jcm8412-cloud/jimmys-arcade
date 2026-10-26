/* Toy Tower: a climbing platformer. Bandit the raccoon swiped the kids' toys and hauled them to the top of
   his hideouts; the hero climbs up (dodging the toys he rolls down) to catch him and get each toy back.
   Built on a tile grid: girders you can jump up through (flat, or ramps that slope), solid blocks, ladders,
   vines and ropes. All movement numbers are in config.js (TT.CONFIG); levels are in one JSON file per
   hideout (garage.json). Built on the shared action kit (Arcade.Action).
   Opening the arcade with ?tune in its address adds a Tune panel with a slider for every number.
   Saved data: toy-tower:progress {playerId: {unlocked (levels open), levels {levelId: {stars (bits: 1 reached
   Bandit, 2 hidden star, 4 beat the time), time (best seconds), score {difficulty: best}}}, shelf [item ids]}},
   toy-tower:prefs {playerId: difficulty}, toy-tower:tune (only used with ?tune). Guests aren't recorded. */
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

  // Hearts per life, how fast Bandit's toys roll (tiles/s), how often he throws (seconds), how often a toy
  // takes a ladder down, how many toys can be out at once, and whether checkpoint flags work.
  const DIFFS = {
    easy: { name: "Easy", desc: "3 hearts, slow toys, checkpoints", hearts: 3, hazardSpeed: 2.3, throwEvery: 3.4, ladderChance: 0.15, maxHazards: 5, flags: true },
    medium: { name: "Medium", desc: "3 hearts, checkpoints", hearts: 3, hazardSpeed: 2.9, throwEvery: 2.7, ladderChance: 0.25, maxHazards: 7, flags: true },
    hard: { name: "Hard", desc: "2 hearts, quicker toys", hearts: 2, hazardSpeed: 3.5, throwEvery: 2.1, ladderChance: 0.35, maxHazards: 9, flags: true },
    impossible: { name: "Impossible", desc: "1 heart, fast toys, no checkpoints", hearts: 1, hazardSpeed: 4.3, throwEvery: 1.6, ladderChance: 0.45, maxHazards: 12, flags: false }
  };
  // The toys Bandit swiped, one per level, in the order of the hideouts.
  const ITEMS = [
    { id: "comic", name: "Comic book" }, { id: "videogame", name: "Video game" }, { id: "crayons", name: "Crayons" },
    { id: "movie", name: "Movie" }, { id: "cards", name: "Trading cards" }, { id: "robot", name: "Toy robot" },
    { id: "bear", name: "Stuffed bear" }, { id: "kite", name: "Kite" }, { id: "soccer", name: "Soccer ball" },
    { id: "skateboard", name: "Skateboard" }, { id: "puzzle", name: "Puzzle" }, { id: "racecars", name: "Race-car set" }
  ];
  const HIDEOUTS = [
    { id: "garage", name: "The Garage", sub: "Ramp Run", file: "games/toy-tower/garage.json" },
    { id: "store", name: "The Toy Store", sub: "Conveyor Chaos", file: "games/toy-tower/store.json" },
    { id: "backyard", name: "The Backyard", sub: "Vine Swing", file: "games/toy-tower/backyard.json" },
    { id: "fort", name: "The Box Fort", sub: "Tape Trouble" }
  ];
  const POINTS = { coin: 10, jumpOver: 50, pop: 50, reach: 200, star: 500, perSecond: 10 };
  // Power-ups: the letter in a level's rows, and what the Use button calls them.
  const POWERS = { w: { id: "wand", name: "Bubble wand" }, n: { id: "sneakers", name: "Super sneakers" }, h: { id: "shield", name: "Shield" }, j: { id: "double", name: "Double jump" } };

  // Tuned numbers from the ?tune panel are kept on this device (only used with ?tune).
  function deepAssign(dst, src) {
    for (const k of Object.keys(src || {})) {
      if (!(k in dst)) continue;
      if (dst[k] && typeof dst[k] === "object") deepAssign(dst[k], src[k]); else if (typeof src[k] === typeof dst[k]) dst[k] = src[k];
    }
  }
  if (TUNING) deepAssign(C, A.store.get("toy-tower:tune", {}));

  /* ---------- Saved progress ---------- */
  let progress = A.store.get("toy-tower:progress", {});
  let prefs = A.store.get("toy-tower:prefs", {});
  const saveProgress = () => A.store.set("toy-tower:progress", progress);
  let guestProgress = null;
  function progOf(p) {
    const blank = () => ({ unlocked: 1, levels: {}, shelf: [] });
    if (!p || !p.id) return guestProgress || (guestProgress = blank());
    return progress[p.id] || (progress[p.id] = blank());
  }
  const diffOf = p => (p && p.id ? prefs[p.id] : guestDiff) || "easy";
  let guestDiff = "easy";
  function setDiff(p, d) { if (p && p.id) { prefs[p.id] = d; A.store.set("toy-tower:prefs", prefs); } else guestDiff = d; }
  const starCount = mask => (mask & 1 ? 1 : 0) + (mask & 2 ? 1 : 0) + (mask & 4 ? 1 : 0);
  const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  /* ---------- Screens ---------- */
  const home = `<button class="icon-btn" data-home aria-label="Home"></button>`;
  const back = `<button class="back-link" data-tt-back>‹ Toy Tower</button>`;
  const seg = (id, items) => `<div class="seg" role="radiogroup" id="${id}">${items.map(([v, label]) => `<button type="button" role="radio" data-v="${v}">${label}</button>`).join("")}</div>`;
  const diffItems = Object.entries(DIFFS).map(([k, d]) => [k, d.name]);
  $("game-root").insertAdjacentHTML("beforeend", `
  <section class="screen tt menu" id="tt-menu" hidden>
    <header class="topbar"><div class="tb-left">${home}</div><h2></h2><div class="tb-right"></div></header>
    <h1 class="title">Toy <span>Tower</span></h1>
    <p class="tagline">Bandit the raccoon swiped your toys. Climb up and get them back!</p>
    <div class="menu-buttons">
      <button class="btn big" id="tt-btn-play">Play</button>
      <button class="btn" id="tt-btn-shelf">Toy Shelf</button>
      <button class="btn ghost" id="tt-btn-top">Top scores</button>
      <button class="btn ghost" id="tt-btn-test">Practice</button>
    </div>
  </section>

  <section class="screen tt" id="tt-levels" hidden>
    <header class="topbar"><div class="tb-left">${home}${back}</div><h2>Pick a level</h2><div class="tb-right"></div></header>
    <div class="playing-as" id="tt-playing-as"></div>
    ${seg("tt-diff", diffItems)}
    <p class="note center-text" id="tt-diff-note"></p>
    <div id="tt-hideouts"></div>
  </section>

  <section class="screen tt" id="tt-shelf" hidden>
    <header class="topbar"><div class="tb-left">${home}${back}</div><h2>Toy Shelf</h2><div class="tb-right"></div></header>
    <p class="note center-text" id="tt-shelf-note"></p>
    <div class="tt-shelf" id="tt-shelf-grid"></div>
  </section>

  <section class="screen tt" id="tt-top" hidden>
    <header class="topbar"><div class="tb-left">${home}${back}</div><h2>Top scores</h2><div class="tb-right"></div></header>
    ${seg("tt-top-level", diffItems)}
    <div id="tt-top-list"></div>
  </section>`);

  const scr = Act.createScreen({
    id: "tt-play", cls: "tt",
    onRestart: () => restartLevel(),
    onQuit: () => A.goHome(),
    onResize: () => { if (G) layout(); }
  });

  function paintSeg(id, value) { $(id).querySelectorAll("button").forEach(b => b.setAttribute("aria-checked", String(b.dataset.v === String(value)))); }
  function showMenu() { A.setAccent(ACCENT); A.show("tt-menu"); }
  document.querySelectorAll("[data-tt-back]").forEach(b => b.addEventListener("click", showMenu));
  $("tt-btn-play").addEventListener("click", () => A.whoIsPlaying({ onDone: showLevels, onBack: showMenu, backLabel: "Toy Tower" }));
  $("tt-btn-shelf").addEventListener("click", () => A.whoIsPlaying({ onDone: showShelf, onBack: showMenu, backLabel: "Toy Tower" }));
  $("tt-btn-top").addEventListener("click", () => showTop("easy"));
  $("tt-btn-test").addEventListener("click", () => A.whoIsPlaying({ onDone: startPractice, onBack: showMenu, backLabel: "Toy Tower" }));

  /* ---------- Level data ---------- */
  const hideoutData = {};
  async function loadHideout(h) {
    if (!h.file) return null;
    if (hideoutData[h.id]) return hideoutData[h.id];
    const res = await fetch(h.file);
    if (!res.ok) throw new Error(h.file + " " + res.status);
    return (hideoutData[h.id] = await res.json());
  }
  let PRACTICE = null;
  async function loadPractice() {
    if (PRACTICE) return PRACTICE;
    const res = await fetch("games/toy-tower/test-level.json");
    if (!res.ok) throw new Error("test-level.json " + res.status);
    return (PRACTICE = await res.json());
  }
  // All campaign levels in order: [{hideout, index (in the whole campaign), def}].
  async function campaign() {
    const out = [];
    for (const h of HIDEOUTS) {
      let data = null;
      try { data = await loadHideout(h); } catch (err) { data = null; }
      if (data) data.levels.forEach(def => out.push({ hideout: h, index: out.length, def }));
    }
    return out;
  }

  // Turn a level's rows into what the game uses, with the height of every ramp tile worked out.
  function parseLevel(def) {
    const cols = Math.max(...def.rows.map(r => r.length));
    const rows = def.rows.map(r => r.padEnd(cols, "."));
    const offs = rows.map(() => new Array(cols).fill(null));
    rows.forEach((row, r) => {
      for (let c = 0; c < cols;) {
        const ch = row[c];
        if (ch !== ">" && ch !== "<") { if (ch === "=" || ch === "{" || ch === "}") offs[r][c] = [0, 0]; c++; continue; }
        let end = c;
        while (end + 1 < cols && row[end + 1] === ch) end++;
        for (let k = c; k <= end; k++) {
          // ">" drops toward the right, "<" toward the left; the top of each tile is offset this much.
          offs[r][k] = ch === ">" ? [(k - c) * C.girder.slope, (k - c + 1) * C.girder.slope] : [(end + 1 - k) * C.girder.slope, (end - k) * C.girder.slope];
        }
        c = end + 1;
      }
    });
    const L = { def, name: def.name, cols, rows, offs, start: null, bandit: null, flags: [], lifts: def.lifts || [], swings: def.swings || [], yoyos: [], keysTotal: 0, chest: null };
    rows.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch === "S") L.start = { c, r };
      if (ch === "B") L.bandit = { c, r };
      if (ch === "F") L.flags.push({ c, r });
      if (ch === "Y") L.yoyos.push({ c, r });
      if (ch === "k") L.keysTotal++;
      if (ch === "X") L.chest = { c, r };
    }));
    return L;
  }

  /* ---------- Game state ----------
     G: { mode ("level" | "practice"), L (parsed level), entry (campaign entry), diff, cfg, player, hero,
          hazards, popups, bubbles, lifts, bandit, camY, t, time, coins, jumps, gotStar, taken Set("c,r"), hearts,
          livesLost, checkpoint {x, y}, state ("play" | "lost" | "caught" | "done"), stateT,
          held (power-up waiting for Use, or null), wandT, sneakT (active until), shield, doubleJump }
     hero: { x (middle), y (feet), vx, vy, onGround, lift (the lift stood on) | null, climb {c, top, topY, bottomY,
             kind} | null, face, coyoteT, bufferT, jumping, airJumps, wall, wallT, lastWall, lockT, regrabT, dropT,
             landT, slideV, runPhase, dizzyT, safeT }
     hazard: { kind ("ball" | "can" | "robot" | "car"), x, y (bottom), r, row, dir, state ("roll" | "fall" | "ladder"),
               vx, vy, bottomY, bottomRow, t, life, decided Set, jumped }
     lift: { c, w, top, bottom, speed, pause, y (its top), dir (-1 up, 1 down), waitT, dy (moved this step) } */
  let G = null;
  const dustFx = Act.dust(70);
  const F = {};

  // What every run starts with (both modes).
  const freshRun = L => ({
    L, hazards: [], popups: [], bubbles: [], t: 0, time: 0, coins: 0, jumps: 0, gotStar: false, taken: new Set(), livesLost: 0,
    state: "play", stateT: 0, camY: 0, held: null, wandT: 0, bubbleT: 0, sneakT: 0, shield: false, doubleJump: false, pops: 0,
    lifts: L.lifts.map(l => ({ ...l, y: l.start ? l.top : l.bottom, dir: l.start ? 1 : -1, waitT: l.pause, dy: 0 })),
    swings: L.swings.map(s => ({ ...s, phase: s.phase || 0 })), keys: 0, chestOpen: 0, sprung: {}
  });
  async function startLevel(entry, diff) {
    G = Object.assign(freshRun(parseLevel(entry.def)), { mode: "level", entry, diff, cfg: DIFFS[diff], player: A.session.player, hearts: DIFFS[diff].hearts });
    G.checkpoint = spotAbove(G.L.start.c, G.L.start.r);
    const b = G.L.bandit;
    const bspot = spotAbove(b.c, b.r);
    const bt = tileAt(b.c, b.r + 1);
    // He throws down the ramp he stands on (or the way his conveyor belt runs).
    G.bandit = { x: bspot.x, y: bspot.y, row: b.r + 1, dir: downhill(b.c, b.r + 1) || belt(b.c, b.r + 1) || (b.c < G.L.cols / 2 ? 1 : -1),
      throwT: 2, pose: "idle", poseT: 0, tauntT: 4 };
    begin();
  }
  async function startPractice() {
    let def;
    try { def = await loadPractice(); } catch (err) { A.toast("Couldn't load the practice level. Try again."); return; }
    G = Object.assign(freshRun(parseLevel(def)), { mode: "practice", player: A.session.player, hearts: 0 });
    G.checkpoint = spotAbove(G.L.start.c, G.L.start.r);
    begin();
  }
  function begin() {
    makeAvatarImage(G.player);
    dustFx.clear();
    respawn();
    A.setAccent(ACCENT);
    scr.show();
    requestAnimationFrame(() => {
      scr.start(update, render);
      G.camY = camTarget(); // no swoop at the start
      updateHud();
    });
  }
  function restartLevel() {
    if (!G) return;
    if (G.mode === "practice") startPractice(); else startLevel(G.entry, G.diff);
  }
  // Where someone standing in tile (c, r) has their feet: on the girder or block below it.
  function spotAbove(c, r) {
    const x = c + 0.5, s = surfaceTop(c, r + 1, x);
    return { x, y: s == null ? r + 1 : s };
  }
  function respawn() {
    G.hero = {
      x: G.checkpoint.x, y: G.checkpoint.y, vx: 0, vy: 0, onGround: true, lift: null, climb: null, face: 1, coyoteT: 0, bufferT: 0, jumping: false, airJumps: 1,
      wall: 0, wallT: 0, lastWall: 0, lockT: 0, regrabT: 0, dropT: 0, landT: 0, slideV: 0, runPhase: 0, dizzyT: 0, safeT: 0
    };
  }

  /* ---------- Tiles ---------- */
  const tileAt = (c, r) => {
    const L = G.L;
    if (c < 0 || c >= L.cols) return "#";          // the sides of the tower are walls
    if (r < 0 || r >= L.rows.length) return ".";    // open above the top and below the bottom
    return L.rows[r][c];
  };
  const solid = (c, r) => tileAt(c, r) === "#";
  const plat = (c, r) => { const t = tileAt(c, r); return t === "=" || t === ">" || t === "<" || t === "{" || t === "}"; };
  // Conveyor belts: } moves right, { moves left (they're girders too).
  const belt = (c, r) => (tileAt(c, r) === "}" ? 1 : tileAt(c, r) === "{" ? -1 : 0);
  const isClimb = t => t === "H" || t === "V" || t === "R";
  // A girder with a ladder (or vine, or rope) under it is climbable too, so you can climb up onto it.
  const climbable = (c, r) => isClimb(tileAt(c, r)) || (plat(c, r) && isClimb(tileAt(c, r + 1)));
  const climbKind = (c, r) => (isClimb(tileAt(c, r)) ? tileAt(c, r) : tileAt(c, r + 1));
  // The top of a girder at x (ramps slope), or of a solid block with open space above it; null otherwise.
  function surfaceTop(c, r, x) {
    if (solid(c, r)) return solid(c, r - 1) ? null : r;
    if (!plat(c, r)) return null;
    const o = G.L.offs[r][c], f = Math.max(0, Math.min(1, x - c));
    return r + o[0] + (o[1] - o[0]) * f;
  }
  const downhill = (c, r) => (tileAt(c, r) === ">" ? 1 : tileAt(c, r) === "<" ? -1 : 0);

  /* ---------- Input: the pad, Jump and Use buttons, and the keyboard ---------- */
  scr.controls.innerHTML = `
    <div class="tt-pad" id="tt-pad" aria-label="Move"><i class="u"></i><i class="d"></i><i class="l"></i><i class="r"></i><b></b></div>
    <div class="tt-btns">
      <button class="tt-use" id="tt-use" aria-label="Use power-up"><canvas width="88" height="88" aria-hidden="true"></canvas><span>Use</span></button>
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
  // Use: switch on the power-up you're holding.
  function useItem() {
    if (!G || !scr.running || G.state !== "play") return;
    const k = G.held;
    if (!k) { scr.message("Grab a power-up first", 800); return; }
    G.held = null;
    if (k === "wand") { G.wandT = G.t + C.powerups.wandTime; G.bubbleT = 0; }
    else if (k === "sneakers") G.sneakT = G.t + C.powerups.sneakersTime;
    else if (k === "shield") G.shield = true;
    else G.doubleJump = true; // for the rest of the level
    A.sfx.win();
    dustFx.emit(px(G.hero.x), px(G.hero.y - hh() / 2), "#f3d36b", 10);
    scr.message({ wand: "Bubbles!", sneakers: "Super sneakers!", shield: "Shield on!", double: "Double jump!" }[k], 900);
    paintUse();
  }
  // The Use button shows the power-up you're holding.
  const useEl = $("tt-use"), useCtx = useEl.querySelector("canvas").getContext("2d");
  let usePainted;
  function paintUse() {
    const k = G && G.held;
    if (k === usePainted) return;
    usePainted = k;
    useCtx.setTransform(2, 0, 0, 2, 0, 0);
    useCtx.clearRect(0, 0, 44, 44);
    if (k) drawPowerIcon(useCtx, k, 22, 22, 36);
    useEl.classList.toggle("ready", !!k);
    useEl.setAttribute("aria-label", k ? `Use ${Object.values(POWERS).find(p => p.id === k).name}` : "Use power-up (none yet)");
  }
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

  /* ---------- Update ---------- */
  const approach = (v, target, step) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));
  const hw = () => C.hero.width / 2, hh = () => C.hero.height;
  const colsUnder = h => [Math.floor(h.x - hw() + EPS), Math.floor(h.x + hw() - EPS)];
  const NO_INPUT = { left: false, right: false, up: false, down: false };

  function update(dt) {
    G.t += dt;
    G.stateT += dt;
    updateLifts(dt);
    const h = G.hero;
    if (G.state === "play" || G.state === "lost") {
      if (G.state === "play") G.time += dt;
      for (const k of ["coyoteT", "bufferT", "wallT", "lockT", "regrabT", "dropT", "landT"]) if (h[k] > 0) h[k] -= dt;
      const inp = G.state === "play" && G.t >= h.dizzyT ? input() : NO_INPUT;
      if (h.swing) updateRide(h, inp, dt); else if (h.climb) updateClimb(h, inp, dt); else updateMove(h, inp, dt);
      if (G.state === "play") {
        collect(h);
        if (G.mode === "level") { touchFlags(h); hitHazards(h); reachBandit(h); }
        // Falling off the bottom.
        if (h.y - hh() > G.L.rows.length + 1) fellOff();
      }
      // After a lost life: back to the last flag (or the start) with full hearts and a clear tower.
      if (G.state === "lost" && G.stateT > 1.3) { G.state = "play"; G.hearts = G.cfg.hearts; G.hazards = []; respawn(); G.hero.safeT = G.t + C.bonk.safeTime; snapCamera(); }
    } else if (G.state === "caught") {
      if (G.stateT > 2.6) finishLevel();
    }
    if (G.mode === "level") { updateBandit(dt); for (const z of G.hazards.slice()) updateHazard(z, dt); }
    updateBubbles(dt);
    paintUse();
    for (const p of G.popups) p.t += dt;
    G.popups = G.popups.filter(p => p.t < 0.9);
    const target = camTarget();
    G.camY += (target - G.camY) * Math.min(1, dt * 6);
    dustFx.update(dt);
    updateHud();
  }

  /* ---------- Movement ---------- */
  function updateMove(h, inp, dt) {
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir) h.face = dir;
    // Riding a lift, or a conveyor belt.
    if (h.onGround && h.lift) h.y += h.lift.dy;
    if (h.onGround && !h.lift) { const b = belt(Math.floor(h.x), Math.floor(h.y + 0.05)); if (b) moveX(h, b * C.store.conveyorSpeed * dt); } // a lift stopped at a belt doesn't get pulled along
    // Run and steer: quick to start, quick to stop, full control in the air.
    const ground = h.onGround;
    const sneakers = G.t < G.sneakT;
    const max = (ground ? C.run.maxSpeed : C.air.maxSpeed) * (sneakers ? C.powerups.sneakersRun : 1);
    let accel = dir ? (h.vx && Math.sign(h.vx) !== dir ? (ground ? C.run.turnAccel : C.air.accel * 1.5) : (ground ? C.run.accel : C.air.accel)) : (ground ? C.run.decel : C.air.decel);
    if (h.lockT > 0) accel *= C.wall.lockControl;
    h.vx = approach(h.vx, dir * max, accel * dt);

    // Jumping: from the ground (or just after leaving it), or off a wall.
    let jumped = false;
    if (h.bufferT > 0) {
      if (ground || h.coyoteT > 0) {
        if (inp.down && ground && standingOnGirderOnly(h)) {
          // Down + Jump on a girder drops through it.
          h.dropT = 0.2; h.y += 0.02; h.onGround = false; h.bufferT = 0;
        } else {
          h.vy = -C.jump.speed * (sneakers ? C.powerups.sneakersJump : 1); h.jumping = true; h.onGround = false; h.coyoteT = 0; h.bufferT = 0; jumped = true;
        }
      } else if (h.wall || h.wallT > 0) {
        const away = -(h.wall || h.lastWall);
        h.vx = away * C.wall.jumpX; h.vy = -C.wall.jumpY; h.face = away;
        h.lockT = C.wall.lockTime; h.jumping = true; h.bufferT = 0; h.wallT = 0; jumped = true;
        dustFx.emit(px(h.x - away * hw()), px(h.y - hh() / 2), "#f2f0e6", 4);
      } else if (G.doubleJump && h.airJumps > 0) {
        // Double jump power-up: one more jump in mid-air.
        h.vy = -C.jump.speed * C.powerups.doubleJump; h.airJumps--; h.jumping = true; h.bufferT = 0; jumped = true;
        dustFx.emit(px(h.x), px(h.y), "#f3d36b", 6);
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
    for (let i = 0; i < steps; i++) { moveX(h, h.vx * dt / steps); moveY(h, h.vy * dt / steps, dir); }

    // Walking along a ramp (up or down) keeps the feet on it.
    if (wasGround && !jumped && h.vy >= 0 && h.dropT <= 0) {
      const s = groundBetween(h, h.y - C.girder.stepUp, h.y + 0.35);
      if (s != null) { h.y = s; h.vy = 0; }
    }
    h.onGround = h.vy >= 0 && groundBetween(h, h.y - 0.02, h.y + 0.02) != null;
    h.lift = h.onGround ? groundLift : null;
    if (h.onGround) h.airJumps = 1;
    if (h.onGround && !wasGround) landed(h, fallSpeed);
    if (wasGround && !h.onGround && !jumped) h.coyoteT = C.jump.coyoteTime; // walked off a ledge
    // Touching a wall (in the air): wall jumps and wall slides.
    if (!h.onGround) {
      for (const side of [-1, 1]) if (wallAt(h, side)) h.wall = side;
      if (h.wall) { h.wallT = C.wall.coyoteTime; h.lastWall = h.wall; }
    }
    if (h.onGround) h.runPhase += Math.abs(h.vx) * dt * 2.2;

    // A springboard under your feet launches you up.
    if (h.onGround) {
      // (On a ramp the girder's top sits a little inside its row, so the springboard may be one row up.)
      const zc = Math.floor(h.x), zr = [Math.floor(h.y - 0.05), Math.floor(h.y - 0.05) - 1].find(r => tileAt(zc, r) === "Z");
      if (zr != null && Math.abs(h.x - (zc + 0.5)) < 0.45 && Math.abs(spotAbove(zc, zr).y - h.y) < 0.15) {
        h.vy = -C.spring.speed * (jumpHeld ? C.spring.boost : 1); h.onGround = false; h.lift = null; h.jumping = false; h.coyoteT = 0;
        G.sprung[zc + "," + zr] = G.t;
        A.sfx.right();
        dustFx.emit(px(h.x), px(h.y), "#f2f0e6", 6);
      }
    }
    grabSwing(h, inp);
    tryGrab(h, inp);
  }

  /* ---------- Tire swings ---------- */
  // Where a tire is (and how fast it's moving) at time t: a pendulum swinging amp radians either side.
  function swingPos(s, t) {
    const w = 2 * Math.PI / s.period, th = s.amp * Math.sin(w * t + s.phase), dth = s.amp * w * Math.cos(w * t + s.phase);
    return { x: s.x + s.len * Math.sin(th), y: s.y + s.len * Math.cos(th), vx: s.len * Math.cos(th) * dth, vy: -s.len * Math.sin(th) * dth };
  }
  // Jumping (or reaching up) into a tire grabs it.
  function grabSwing(h, inp) {
    if (h.regrabT > 0 || G.state !== "play" || (h.onGround && !inp.up)) return;
    for (const s of G.swings) {
      const p = swingPos(s, G.t);
      if (Math.hypot(h.x - p.x, h.y - hh() * 0.5 - p.y) < C.swing.grab) {
        h.swing = s; h.climb = null; h.onGround = false; h.lift = null; h.jumping = false; h.airJumps = 1;
        A.sfx.right();
        return;
      }
    }
  }
  // Riding: hold on while it swings; Jump lets go with the swing's speed (Down + Jump just drops).
  function updateRide(h, inp, dt) {
    const p = swingPos(h.swing, G.t);
    h.x = p.x; h.y = p.y + 0.3; h.vx = p.vx; h.vy = p.vy;
    if (Math.abs(p.vx) > 0.3) h.face = p.vx > 0 ? 1 : -1;
    if (h.bufferT <= 0) return;
    h.bufferT = 0;
    h.swing = null;
    h.regrabT = 0.45;
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir) h.face = dir;
    if (inp.down && !dir) { h.vx = p.vx * C.swing.fling; h.vy = Math.max(0, p.vy); return; }
    h.vx = p.vx * C.swing.fling + dir * 2.5;
    h.vy = Math.min(p.vy, 0) - C.swing.jumpSpeed;
    h.jumping = true;
  }

  // The highest surface under the hero's feet between yFrom and yTo (girders count unless dropping through).
  // Lifts count too (like girders); groundLift is set to the lift when that's what was found.
  let groundLift = null;
  function groundBetween(h, yFrom, yTo) {
    const [c0, c1] = colsUnder(h);
    let best = null;
    groundLift = null;
    for (let r = Math.floor(yFrom) - 1; r <= Math.floor(yTo); r++) {
      for (let c = c0; c <= c1; c++) {
        if (plat(c, r) && h.dropT > 0) continue;
        const s = surfaceTop(c, r, Math.max(c, Math.min(c + 1, h.x)));
        if (s != null && s >= yFrom - EPS && s <= yTo + EPS && (best == null || s < best)) best = s;
      }
    }
    if (h.dropT <= 0) for (const l of G.lifts) {
      if (h.x + hw() <= l.c || h.x - hw() >= l.c + l.w) continue;
      if (l.y >= yFrom - EPS && l.y <= yTo + EPS && (best == null || l.y <= best)) { best = l.y; groundLift = l; }
    }
    return best;
  }
  function standingOnGirderOnly(h) {
    const [c0, c1] = colsUnder(h);
    let girder = false;
    for (let r = Math.floor(h.y) - 1; r <= Math.floor(h.y); r++) for (let c = c0; c <= c1; c++) {
      const s = surfaceTop(c, r, Math.max(c, Math.min(c + 1, h.x)));
      if (s == null || Math.abs(s - h.y) > 0.03) continue;
      if (solid(c, r)) return false;
      girder = true;
    }
    return girder;
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
      // Ledge forgiveness on girders: moving into a girder whose top is just above your feet pulls you up onto it.
      if (!h.onGround && h.dropT <= 0 && h.vy > -2) {
        for (let r = Math.floor(h.y - C.ledge.pullUp - EPS); r <= Math.floor(h.y); r++) {
          if (!plat(c, r)) continue;
          const s = surfaceTop(c, r, Math.max(c, Math.min(c + 1, h.x)));
          if (s < h.y && h.y - s <= C.ledge.pullUp && boxFree(h.x, s)) { h.y = s; h.vy = 0; h.onGround = true; h.jumping = false; return; }
        }
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
      const s = groundBetween(h, h.y, ny);
      if (s != null) { h.y = s; h.vy = 0; return; }
      // Ledge forgiveness: just past the end of a platform, moving toward it, still lands on it.
      for (const side of [-1, 1]) {
        if (side !== dir && side !== Math.sign(h.vx)) continue;
        const c = Math.floor(side > 0 ? h.x + hw() + C.ledge.edgeReach - EPS : h.x - hw() - C.ledge.edgeReach + EPS);
        if (c >= c0 && c <= c1) continue;
        for (let r = Math.floor(h.y) - 1; r <= Math.floor(ny); r++) {
          if (plat(c, r) && h.dropT > 0) continue;
          const top = surfaceTop(c, r, side > 0 ? c : c + 1);
          if (top == null || top < h.y - EPS || top > ny) continue;
          const x = side > 0 ? c + 0.08 - hw() : c + 1 - 0.08 + hw();
          if (!boxFree(x, top)) continue;
          h.x = x; h.y = top; h.vy = 0;
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
    if (h.regrabT > 0 || G.state !== "play") return;
    let hit = null;
    const footRow = Math.floor(h.y + 0.05);
    // With Up, a ladder anywhere along the body counts: on a ramp the girder's top sits a little below the
    // ladder's last rung, so only the head may be next to the ladder.
    if (inp.up) hit = climbNear(h, [Math.floor(h.y - hh() * 0.5), Math.floor(h.y - 0.05), Math.floor(h.y - hh() + 0.1)]);
    else if (inp.down && h.onGround) hit = climbNear(h, [footRow]);                                              // standing on top of a ladder
    else if (!h.onGround && C.climb.autoGrab && !inp.down) hit = climbNear(h, [Math.floor(h.y - hh() * 0.5)]); // jumping into one
    if (!hit) return;
    let top = hit.r, bottom = hit.r;
    while (climbable(hit.c, top - 1)) top--;
    while (climbable(hit.c, bottom + 1)) bottom++;
    const cx = hit.c + 0.5;
    const topY = plat(hit.c, top) ? surfaceTop(hit.c, top, cx) : top;
    const below = surfaceTop(hit.c, bottom + 1, cx);
    const bottomY = below == null ? bottom + 1 : below;
    if (inp.down && h.onGround) { if (hit.r !== top || !plat(hit.c, top)) return; h.y += 0.05; } // step down onto the ladder
    else if (inp.up && h.onGround && h.y <= topY + 0.05) return;                                  // already at the top
    const kind = climbKind(hit.c, hit.r);
    // Two vines side by side: hold both (the hero sits between them).
    let pair = 0;
    if (kind === "V") for (const side of [1, -1]) {
      for (let r = top; r <= bottom && !pair; r++) if (tileAt(hit.c + side, r) === "V") pair = side;
      if (pair) break;
    }
    h.climb = { c: hit.c, top, topY, bottomY, kind, pair };
    h.y = Math.min(h.y, bottomY); // grabbed the end of a rope with feet hanging below it: hang from the end
    h.vx = 0; h.vy = 0; h.onGround = false; h.lift = null; h.jumping = false; h.slideV = C.climb.downSpeed; h.airJumps = 1;
  }
  // Vines: two side by side climb faster; a single vine climbs slower but slides down faster.
  function vineSpeeds(h) {
    const cl = h.climb;
    if (cl.kind !== "V") return { up: 1, slide: 1 };
    const both = cl.pair && tileAt(cl.c + cl.pair, Math.floor(h.y - hh() * 0.5)) === "V";
    return both ? { up: C.climb.vinePair, slide: 1 } : { up: C.climb.vineSingle, slide: C.climb.vineSlide };
  }
  function updateClimb(h, inp, dt) {
    const cl = h.climb;
    h.x = approach(h.x, cl.pair > 0 ? cl.c + 1 : cl.pair < 0 ? cl.c : cl.c + 0.5, C.climb.centerSpeed * dt);
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
    const vs = vineSpeeds(h);
    if (inp.up) { h.vy = -C.climb.upSpeed * vs.up; h.slideV = C.climb.downSpeed; }
    else if (inp.down) { h.slideV = approach(h.slideV, C.climb.slideSpeed * vs.slide, C.climb.slideAccel * vs.slide * dt); h.vy = h.slideV; } // hold to slide fast
    else { h.vy = 0; h.slideV = C.climb.downSpeed; }
    const ny = h.y + h.vy * dt;
    if (ny <= cl.topY) {
      // Reached the top: step off onto the girder there (if there is one).
      h.y = cl.topY;
      if (plat(cl.c, cl.top) || solid(cl.c, cl.top)) { h.climb = null; h.vy = 0; h.onGround = true; }
      return;
    }
    if (h.vy > 0 && ny >= cl.bottomY) {
      // Reached the bottom: stand on the ground there, or drop off the end of a rope or vine.
      h.climb = null;
      h.y = cl.bottomY;
      h.onGround = groundBetween(h, h.y - 0.02, h.y + 0.02) != null;
      h.lift = h.onGround ? groundLift : null;
      if (h.onGround) { landed(h, h.vy); h.vy = 0; } else { h.regrabT = C.climb.regrabDelay; }
      return;
    }
    h.y = ny;
  }

  /* ---------- Coins, stars, flags ---------- */
  function overlapTiles(h, fn) {
    const c0 = Math.floor(h.x - hw()), c1 = Math.floor(h.x + hw()), r0 = Math.floor(h.y - hh()), r1 = Math.floor(h.y - EPS);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) fn(c, r, tileAt(c, r));
  }
  function collect(h) {
    overlapTiles(h, (c, r, t) => {
      const key = c + "," + r;
      if (POWERS[t] && !G.taken.has(key)) {
        // A power-up: hold one at a time, switched on with Use.
        if (G.held) { if (G.t > (G.fullT || 0)) { scr.message("Tap Use first!", 800); G.fullT = G.t + 2; } return; }
        G.taken.add(key);
        G.held = POWERS[t].id;
        A.sfx.right();
        dustFx.emit(px(c + 0.5), px(r + 0.5), "#f3d36b", 8);
        scr.message(`${POWERS[t].name}! Tap Use`, 1200);
        return;
      }
      if ((t !== "*" && t !== "c" && t !== "k") || G.taken.has(key)) return;
      G.taken.add(key);
      if (t === "k") {
        // A stuffed-animal key for Bandit's toy chest (kept even after losing a life).
        G.keys++;
        A.sfx.win();
        dustFx.emit(px(c + 0.5), px(r + 0.5), "#f29a9a", 10);
        scr.message(G.keys >= G.L.keysTotal ? "All the keys! Up to the chest!" : `Key ${G.keys} of ${G.L.keysTotal}!`, 1200);
      } else if (t === "c") {
        G.coins++;
        A.sfx.right();
        dustFx.emit(px(c + 0.5), px(r + 0.5), "#f3d36b", 6);
        popup("+" + POINTS.coin, c + 0.5, r + 0.3);
      } else {
        G.gotStar = true;
        A.sfx.win();
        dustFx.emit(px(c + 0.5), px(r + 0.5), "#f3d36b", 14);
        scr.message(G.mode === "practice" ? "Star!" : "Hidden star!", 1000);
      }
    });
  }
  function touchFlags(h) {
    if (!G.cfg.flags) return;
    overlapTiles(h, (c, r, t) => {
      if (t !== "F") return;
      const spot = spotAbove(c, r);
      if (G.checkpoint.c === c && G.checkpoint.r === r) return;
      G.checkpoint = { x: spot.x, y: spot.y, c, r };
      A.sfx.right();
      scr.message("Checkpoint!", 900);
    });
  }
  function popup(text, x, y) { G.popups.push({ text, x, y, t: 0 }); }

  /* ---------- Bonks, hearts and lives ---------- */
  function bonk(h, fromX) {
    if (G.t < h.safeT || G.state !== "play") return;
    if (G.shield) {
      // The shield power-up blocks this bonk.
      G.shield = false; h.safeT = G.t + 1;
      A.sfx.right();
      dustFx.emit(px(h.x), px(h.y - hh() / 2), "#9fd3e8", 12);
      scr.message("Shield!", 700);
      return;
    }
    G.hearts--;
    A.sfx.wrong(); A.buzz();
    h.dizzyT = G.t + C.bonk.dizzyTime; h.safeT = G.t + C.bonk.safeTime;
    if (h.climb) { h.climb = null; h.regrabT = 0.3; }
    if (h.swing) { h.swing = null; h.regrabT = 0.45; }
    h.vx = (h.x < fromX ? -1 : 1) * C.bonk.knockback; h.vy = Math.min(h.vy, -6);
    h.onGround = false;
    G.bandit.pose = "giggle"; G.bandit.poseT = G.t + 1;
    if (G.hearts <= 0) loseLife(); else scr.message("Bonk!", 700);
  }
  function fellOff() {
    if (G.mode === "practice") { scr.message("Whoops! Back to the start", 1000); respawn(); snapCamera(); return; }
    G.hearts--;
    A.sfx.wrong(); A.buzz();
    if (G.hearts <= 0) { loseLife(); return; }
    respawn();
    G.hero.safeT = G.t + C.bonk.safeTime;
    snapCamera();
    scr.message("Whoops!", 800);
  }
  function loseLife() {
    G.livesLost++;
    G.state = "lost"; G.stateT = 0;
    A.sfx.lose();
    G.bandit.pose = "dance"; G.bandit.poseT = G.t + 1.5; // he does a silly dance
    scr.message(G.cfg.flags ? "Back to the flag!" : "Back to the start!", 1200);
  }
  function snapCamera() { G.camY = camTarget(); }

  /* ---------- Bandit ---------- */
  function updateBandit(dt) {
    const B = G.bandit;
    if (G.state === "caught") {
      // Caught red-handed: sheepish, hands back the toy, then scampers up and away.
      if (G.stateT > 1.5) { B.pose = "flee"; B.y -= dt * 9; B.x += B.dir * dt * 1.5; }
      return;
    }
    if (G.state !== "play") return;
    if (B.poseT && G.t > B.poseT) { B.pose = "idle"; B.poseT = 0; }
    B.throwT -= dt;
    if (B.throwT <= 0.45 && B.pose !== "throw" && G.hazards.length < G.cfg.maxHazards) { B.pose = "throw"; B.poseT = G.t + 0.5; }
    if (B.throwT <= 0) {
      if (G.hazards.length < G.cfg.maxHazards) spawnHazard(pickKind());
      B.throwT = G.cfg.throwEvery * (G.entry.def.throwEvery || 1) * (0.75 + Math.random() * 0.5);
    }
    // Every so often he waves, sticks out his tongue, or giggles.
    B.tauntT -= dt;
    if (B.tauntT <= 0 && B.pose === "idle") {
      B.pose = ["wave", "tongue", "giggle"][Math.floor(Math.random() * 3)];
      B.poseT = G.t + 1.1;
      B.tauntT = 3 + Math.random() * 3;
    }
  }
  function pickKind() {
    const w = G.entry.def.hazards || { ball: 1 }, total = Object.values(w).reduce((s, v) => s + v, 0);
    let roll = Math.random() * total;
    for (const [k, v] of Object.entries(w)) { roll -= v; if (roll < 0) return k; }
    return "ball";
  }
  function reachBandit(h) {
    const B = G.bandit;
    if (Math.abs(h.x - B.x) < 0.75 && h.y > B.y - 1.2 && h.y - hh() < B.y) {
      // In the Backyard the toy is locked in his chest: bring every key first.
      if (G.L.keysTotal && G.keys < G.L.keysTotal) {
        if (G.t > (G.keyMsgT || 0)) { scr.message(`Find all the keys! ${G.keys} of ${G.L.keysTotal}`, 1200); G.keyMsgT = G.t + 2; B.pose = "tongue"; B.poseT = G.t + 1; }
        return;
      }
      if (G.L.keysTotal) G.chestOpen = G.t;
      G.state = "caught"; G.stateT = 0;
      B.pose = "caught";
      G.hazards = [];
      h.vx = 0; h.climb = null;
      A.sfx.win();
      scr.message("Caught you!", 1300);
    }
  }

  /* ---------- Bandit's toys: bouncy balls and paint cans (Garage), wind-up robots and toy cars (Toy Store) ---------- */
  const RADIUS = { ball: "ballRadius", can: "canRadius", robot: "robotRadius", car: "carRadius" };
  function spawnHazard(kind) {
    const B = G.bandit;
    G.hazards.push({
      kind, x: B.x + B.dir * 0.4, y: B.y, r: C.hazards[RADIUS[kind]], row: B.row, dir: B.dir,
      state: "roll", vx: 0, vy: 0, t: Math.random() * 3, spin: 0, decided: new Set(), jumped: false, color: Math.floor(Math.random() * 3),
      life: kind === "robot" ? C.hazards.robotLife * (0.85 + Math.random() * 0.3) : 45
    });
  }
  // A toy's own speed (robots walk, cars zoom).
  const toySpeed = z => G.cfg.hazardSpeed * (z.kind === "robot" ? C.hazards.robotSpeed : z.kind === "car" ? C.hazards.carSpeed : 1);
  function popHazard(z) {
    removeHazard(z, true);
    G.pops++;
    popup("+" + POINTS.pop, z.x, z.y - 1);
    A.sfx.right();
  }
  function removeHazard(z, poof) {
    G.hazards = G.hazards.filter(o => o !== z);
    if (poof) dustFx.emit(px(z.x), px(z.y - z.r), "#f2f0e6", 6);
  }
  function updateHazard(z, dt) {
    const sp = toySpeed(z);
    z.t += dt;
    // Wind-up robots run down after a while (and any toy that's been around too long tidies itself away).
    if (z.t > z.life) { removeHazard(z, true); return; }
    if (z.state === "roll") {
      const c = Math.floor(z.x);
      const d = downhill(c, z.row);
      if (d) z.dir = d;
      // Now and then a ball or paint can takes a ladder down instead of rolling past it.
      const key = c + "," + z.row;
      if ((z.kind === "ball" || z.kind === "can") && plat(c, z.row) && isClimb(tileAt(c, z.row + 1)) && !z.decided.has(key) && Math.abs(z.x - (c + 0.5)) < 0.2) {
        z.decided.add(key);
        if (Math.random() < G.cfg.ladderChance) {
          let bottom = z.row + 1;
          while (climbable(c, bottom + 1)) bottom++;
          const s = surfaceTop(c, bottom + 1, c + 0.5);
          if (s != null) { z.state = "ladder"; z.x = c + 0.5; z.bottomY = s; z.bottomRow = bottom + 1; return; }
        }
      }
      // Conveyor belts carry toys along (a robot walking against a belt can be carried backward).
      const v = z.dir * sp + belt(c, z.row) * C.store.conveyorSpeed;
      let nx = z.x + v * dt;
      // Bumping a wall: off the ground floor it disappears; on a girder it turns around.
      const mv = Math.sign(v) || z.dir;
      if (solid(Math.floor(nx + mv * z.r), Math.floor(z.y - 0.3))) {
        if (solid(c, z.row)) { removeHazard(z, true); return; }
        z.dir = -z.dir; nx = z.x;
      }
      z.x = nx;
      z.spin += v * dt / z.r;
      const s = surfaceTop(Math.floor(z.x), z.row, z.x);
      if (s == null) { z.state = "fall"; z.vx = v * 0.6; z.vy = 0; } // off the end of the ramp
      else z.y = s;
    } else if (z.state === "fall") {
      z.vy += C.hazards.gravity * dt;
      const ny = z.y + z.vy * dt;
      z.x += z.vx * dt;
      if (solid(Math.floor(z.x + Math.sign(z.vx) * z.r), Math.floor(z.y - z.r))) { z.vx = -z.vx; z.x += z.vx * dt; }
      const c = Math.floor(z.x);
      let landed = null;
      for (let r = Math.floor(z.y) - 1; r <= Math.floor(ny); r++) {
        const s = surfaceTop(c, r, z.x);
        if (s != null && s >= z.y - EPS && s <= ny && (landed == null || s < landed.s)) landed = { s, r };
      }
      if (landed) { z.y = landed.s; z.row = landed.r; z.state = "roll"; z.vy = 0; if (z.kind === "ball") z.t = 0; }
      else z.y = ny;
      if (z.y > G.L.rows.length + 2) { removeHazard(z, false); return; }
    } else if (z.state === "ladder") {
      z.y += sp * 0.8 * dt;
      z.spin += dt * 4;
      if (z.y >= z.bottomY) { z.y = z.bottomY; z.row = z.bottomRow; z.state = "roll"; }
    }
    // Into the toy box at the bottom.
    if (tileAt(Math.floor(z.x), Math.floor(z.y - 0.2)) === "T") removeHazard(z, true);
  }
  // Bouncy balls hop as they roll.
  const hop = z => (z.kind === "ball" && z.state === "roll" ? Math.abs(Math.sin(z.t * 7)) * C.hazards.bounce : 0);

  /* ---------- Lifts, and the bubble wand's bubbles ---------- */
  function updateLifts(dt) {
    for (const l of G.lifts) {
      const y0 = l.y;
      if (l.waitT > 0) l.waitT -= dt;
      else {
        l.y += l.dir * l.speed * dt;
        if (l.y <= l.top) { l.y = l.top; l.dir = 1; l.waitT = l.pause; }
        else if (l.y >= l.bottom) { l.y = l.bottom; l.dir = -1; l.waitT = l.pause; }
      }
      l.dy = l.y - y0;
    }
  }
  function updateBubbles(dt) {
    const h = G.hero;
    if (G.t < G.wandT && G.state === "play") {
      G.bubbleT -= dt;
      if (G.bubbleT <= 0) {
        G.bubbleT = C.powerups.bubbleEvery;
        G.bubbles.push({ x: h.x + h.face * 0.45, y: h.y - hh() * 0.6, vx: h.face * C.powerups.bubbleSpeed, vy: -0.4, r: 0.24, t: 0 });
      }
    }
    for (const b of G.bubbles) {
      b.t += dt;
      b.x += b.vx * dt; b.y += b.vy * dt + Math.sin(b.t * 9) * 0.01;
      b.vx *= 1 - dt * 0.7;
      for (const z of G.hazards) {
        if (Math.hypot(z.x - b.x, z.y - z.r - hop(z) - b.y) < z.r + b.r) { b.t = 99; popHazard(z); break; }
      }
    }
    G.bubbles = G.bubbles.filter(b => b.t < 1.6);
  }
  // Yo-yos bob up and down on their strings from their tile (each a little out of step with the others).
  function yoyoPos(y) {
    const f = 0.5 - 0.5 * Math.cos(2 * Math.PI * G.t / C.yoyo.period + y.c * 1.3 + y.r);
    return { x: y.c + 0.5, y: y.r + 0.4 + f * C.yoyo.range };
  }
  function hitHazards(h) {
    for (const yo of G.L.yoyos) {
      const p = yoyoPos(yo), rr = C.yoyo.radius * C.hazards.hitScale;
      const nx = Math.max(h.x - hw(), Math.min(h.x + hw(), p.x)), ny = Math.max(h.y - hh(), Math.min(h.y, p.y));
      if (Math.hypot(p.x - nx, p.y - ny) < rr) { bonk(h, p.x); return; }
    }
    for (const z of G.hazards) {
      const cy = z.y - z.r - hop(z), rr = z.r * C.hazards.hitScale;
      const nx = Math.max(h.x - hw(), Math.min(h.x + hw(), z.x)), ny = Math.max(h.y - hh(), Math.min(h.y, cy));
      if (Math.hypot(z.x - nx, cy - ny) < rr) { bonk(h, z.x); return; }
      // Jumping over a toy scores points.
      if (!z.jumped && !h.onGround && !h.climb && Math.abs(h.x - z.x) < 0.35 && h.y < cy - z.r && cy - h.y < 2.2) {
        z.jumped = true; G.jumps++;
        popup("+" + POINTS.jumpOver, h.x, h.y - hh() - 0.3);
        A.sfx.right();
      }
    }
  }

  /* ---------- Finishing a level ---------- */
  function finishLevel() {
    G.state = "done";
    scr.stop();
    const def = G.entry.def, p = G.player, prog = progOf(p);
    const timeBonus = Math.max(0, Math.round((def.targetTime - G.time) * POINTS.perSecond));
    const score = G.coins * POINTS.coin + G.jumps * POINTS.jumpOver + G.pops * POINTS.pop + POINTS.reach + (G.gotStar ? POINTS.star : 0) + timeBonus;
    const fast = G.time <= def.targetTime;
    const mask = 1 | (G.gotStar ? 2 : 0) | (fast ? 4 : 0);
    const rec = prog.levels[def.id] || (prog.levels[def.id] = { stars: 0, time: null, score: {} });
    const before = rec.stars;
    rec.stars |= mask;
    if (rec.time == null || G.time < rec.time) rec.time = Math.round(G.time * 10) / 10;
    rec.score[G.diff] = Math.max(rec.score[G.diff] || 0, score);
    const newToy = !prog.shelf.includes(def.item);
    if (newToy) prog.shelf.push(def.item);
    prog.unlocked = Math.max(prog.unlocked, G.entry.index + 2);
    if (p && p.id) saveProgress();
    const res = submitTotal(p, G.diff, prog);
    if (res && res.newBest) scr.burst("New best!");
    const item = ITEMS.find(i => i.id === def.item);
    const next = campaignCache && campaignCache[G.entry.index + 1];
    const star = (on, label) => `<li class="${on ? "on" : ""}"><span>${on ? "★" : "☆"}</span>${label}</li>`;
    setTimeout(() => {
      if (A.currentScreen !== "tt-play") return;
      scr.showPanel({
        html: `<h2>You caught Bandit!</h2>
          <canvas class="tt-item-big" width="160" height="160" aria-hidden="true"></canvas>
          <p class="note">He gave back your <b>${esc(item ? item.name.toLowerCase() : "toy")}</b>${newToy ? " (it's on your Toy Shelf now)" : ""}.</p>
          <ul class="tt-stars">${star(true, "Caught Bandit")}${star(G.gotStar, "Found the hidden star")}${star(fast, `Under ${fmtTime(def.targetTime)}`)}</ul>
          <p class="note">Time ${fmtTime(G.time)} · ${G.coins} coin${G.coins === 1 ? "" : "s"} · score <b>${score}</b>${starCount(rec.stars) > starCount(before) && before ? " · more stars!" : ""}</p>
          ${next ? "" : `<p class="note">More hideouts are coming soon!</p>`}`,
        buttons: [
          ...(next ? [{ label: "Next level", cls: "big", run: () => startLevel(next, G.diff) }] : []),
          { label: "Play again", cls: next ? "" : "big", run: restartLevel },
          { label: "Levels", cls: "ghost", run: showLevels }
        ]
      });
      const cv = $("tt-play-panel").querySelector(".tt-item-big");
      if (cv && item) { const c = cv.getContext("2d"); c.scale(2, 2); drawItem(c, item.id, 80, false); }
    }, res && res.newBest ? 900 : 200);
  }
  // The high score is the total of a player's best score on every level; the household list keeps one entry per player.
  function submitTotal(p, diff, prog) {
    if (!p || !p.id) return null;
    const total = Object.values(prog.levels).reduce((s, l) => s + ((l.score && l.score[diff]) || 0), 0);
    const all = A.store.get("action:top", {}), key = `${ID}|${diff}`;
    if (all[key]) { all[key] = all[key].filter(e => e.id !== p.id); A.store.set("action:top", all); }
    return Act.scores.submit(ID, diff, p, total);
  }

  /* ---------- Level select, Toy Shelf, top scores ---------- */
  let campaignCache = null;
  async function showLevels() {
    const p = A.session.player, prog = progOf(p), diff = diffOf(p);
    campaignCache = await campaign();
    $("tt-playing-as").innerHTML = `${A.avatarSvg(p)}<span>Playing: <b>${esc(p.name)}</b></span>
      <button class="btn ghost" id="tt-switch">Switch</button>`;
    $("tt-switch").addEventListener("click", () => A.whoIsPlaying({ force: true, onDone: showLevels, onBack: showLevels, backLabel: "Levels" }));
    paintSeg("tt-diff", diff);
    const total = Object.values(prog.levels).reduce((s, l) => s + ((l.score && l.score[diff]) || 0), 0);
    $("tt-diff-note").textContent = DIFFS[diff].desc + (p.id ? ` · your score: ${total}` : "");
    const box = $("tt-hideouts");
    box.innerHTML = "";
    for (const h of HIDEOUTS) {
      const entries = campaignCache.filter(e => e.hideout === h);
      const card = document.createElement("div");
      card.className = "tt-hideout" + (entries.length ? "" : " soon");
      card.innerHTML = `<h3>${esc(h.name)} <small>${esc(h.sub)}</small></h3><div class="tt-lvls"></div>${entries.length ? "" : `<p class="note">Coming soon</p>`}`;
      const row = card.querySelector(".tt-lvls");
      for (const e of entries) {
        const rec = prog.levels[e.def.id], open = e.index < prog.unlocked;
        const b = document.createElement("button");
        b.className = "tt-lvl";
        b.disabled = !open;
        const stars = rec ? starCount(rec.stars) : 0;
        b.innerHTML = `<b>${e.index + 1}</b><span>${open ? esc(e.def.name) : "Locked"}</span><small>${"★".repeat(stars)}${"☆".repeat(3 - stars)}${rec && rec.time != null ? ` · ${fmtTime(rec.time)}` : ""}</small>`;
        b.setAttribute("aria-label", `Level ${e.index + 1}: ${open ? e.def.name : "locked"}. ${stars} of 3 stars.`);
        b.addEventListener("click", () => startLevel(e, diffOf(p)));
        row.appendChild(b);
      }
      box.appendChild(card);
    }
    A.setAccent(ACCENT);
    A.show("tt-levels");
  }
  $("tt-diff").querySelectorAll("button").forEach(b => b.addEventListener("click", () => { setDiff(A.session.player, b.dataset.v); showLevels(); }));

  function showShelf() {
    const prog = progOf(A.session.player);
    $("tt-shelf-note").textContent = `${prog.shelf.length} of ${ITEMS.length} toys back on the shelf.`;
    const grid = $("tt-shelf-grid");
    grid.innerHTML = "";
    for (const item of ITEMS) {
      const have = prog.shelf.includes(item.id);
      const cell = document.createElement("div");
      cell.className = "tt-shelf-item" + (have ? "" : " missing");
      cell.innerHTML = `<canvas width="128" height="128" aria-hidden="true"></canvas><span>${have ? esc(item.name) : "???"}</span>`;
      const c = cell.querySelector("canvas").getContext("2d");
      c.scale(2, 2);
      drawItem(c, item.id, 64, !have);
      grid.appendChild(cell);
    }
    A.setAccent(ACCENT);
    A.show("tt-shelf");
  }

  function showTop(level) {
    paintSeg("tt-top-level", level);
    $("tt-top-list").innerHTML = `<p class="note">Each player's best score on every level, added up.</p>` + Act.topListHtml(Act.scores.top(ID, level), -1);
    A.setAccent(ACCENT);
    A.show("tt-top");
  }
  $("tt-top-level").querySelectorAll("button").forEach(b => b.addEventListener("click", () => showTop(b.dataset.v)));

  /* ---------- Camera and layout ---------- */
  const W = () => scr.size.w, H = () => scr.size.h;
  const px = t => t * F.s; // tiles -> pixels
  function layout() {
    F.s = Math.min(W() / G.L.cols, H() / 12);
    F.ox = (W() - F.s * G.L.cols) / 2;
    F.viewRows = H() / F.s;
  }
  function camTarget() {
    if (!F.s) layout();
    const rows = G.L.rows.length, h = G.hero;
    const y = h.y - F.viewRows * 0.6;
    return Math.max(Math.min(0, rows - F.viewRows), Math.min(rows - F.viewRows, y));
  }

  let hudText = "";
  function updateHud() {
    let html;
    if (G.mode === "practice") {
      const stars = G.L.rows.join("").split("*").length - 1;
      html = `<span>Practice</span><span class="stars">★ ${[...G.taken].length}/${stars}</span>`;
    } else {
      const hearts = "♥".repeat(Math.max(0, G.hearts)) + `<span class="gone">${"♥".repeat(Math.max(0, G.cfg.hearts - G.hearts))}</span>`;
      html = `<span class="lives">${hearts}</span><span class="coins">● ${G.coins}</span><span class="time">${fmtTime(G.time)}</span>${G.gotStar ? `<span class="stars">★</span>` : ""}`;
    }
    // Power-ups that are switched on.
    const on = [];
    if (G.t < G.wandT) on.push(`Bubbles ${Math.ceil(G.wandT - G.t)}`);
    if (G.t < G.sneakT) on.push(`Sneakers ${Math.ceil(G.sneakT - G.t)}`);
    if (G.shield) on.push("Shield");
    if (G.doubleJump) on.push("2× jump");
    if (on.length) html += `<span class="powers">${on.join(" · ")}</span>`;
    if (G.L.keysTotal) html += `<span class="keys${G.keys >= G.L.keysTotal ? " all" : ""}">Keys ${G.keys}/${G.L.keysTotal}</span>`;
    if (html !== hudText) { scr.hud.innerHTML = html; hudText = html; }
  }

  /* ---------- Drawing ---------- */
  function render() {
    if (!G || !F.s) return;
    const ctx = scr.ctx, s = F.s, L = G.L;
    ctx.clearRect(0, 0, W(), H());
    ctx.save();
    ctx.translate(F.ox, -G.camY * s);
    const r0 = Math.max(0, Math.floor(G.camY) - 1), r1 = Math.min(L.rows.length - 1, Math.ceil(G.camY + F.viewRows) + 1);
    // Faint tower beams in the background.
    ctx.strokeStyle = "rgba(242,240,230,.05)"; ctx.lineWidth = 2;
    for (let c = 0; c <= L.cols; c += 3) { ctx.beginPath(); ctx.moveTo(c * s, r0 * s); ctx.lineTo(c * s, (r1 + 1) * s); ctx.stroke(); }
    for (const l of G.lifts) drawLift(ctx, l, s);
    for (let r = r0; r <= r1; r++) for (let c = 0; c < L.cols; c++) drawTile(ctx, L.rows[r][c], c, r, s);
    for (const sw of G.swings) drawSwing(ctx, sw, s);
    for (const yo of L.yoyos) drawYoyo(ctx, yo, s);
    if (L.chest) drawChest(ctx, L.chest, s);
    if (G.mode === "level") {
      drawBandit(ctx, G.bandit, s);
      for (const z of G.hazards) drawHazard(ctx, z, s);
    }
    dustFx.draw(ctx);
    drawHero(ctx, G.hero, s);
    // Bubbles from the bubble wand.
    for (const b of G.bubbles) {
      ctx.globalAlpha = Math.min(1, (1.6 - b.t) * 2);
      ctx.strokeStyle = "#9fd3e8"; ctx.lineWidth = 2; ctx.fillStyle = "rgba(159,211,232,.18)";
      ctx.beginPath(); ctx.arc(b.x * s, b.y * s, b.r * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.beginPath(); ctx.arc(b.x * s - b.r * s * 0.3, b.y * s - b.r * s * 0.3, b.r * s * 0.35, Math.PI, Math.PI * 1.5); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Floating points.
    ctx.textAlign = "center"; ctx.font = `${Math.round(s * 0.5)}px "Gochi Hand", cursive`;
    for (const p of G.popups) { ctx.globalAlpha = 1 - p.t / 0.9; ctx.fillStyle = "#f3d36b"; ctx.fillText(p.text, p.x * s, (p.y - p.t * 0.8) * s); }
    ctx.globalAlpha = 1;
    // The toy flies from Bandit to the hero when he's caught.
    if (G.state === "caught" && G.stateT > 0.6 && G.mode === "level") {
      const f = Math.min(1, (G.stateT - 0.6) / 0.8), B = G.bandit, h = G.hero;
      const x = B.x + (h.x - B.x) * f, y = (B.y - 1) + (h.y - 1.6 - (B.y - 1)) * f - Math.sin(f * Math.PI) * 1.2;
      ctx.save(); ctx.translate(x * s - s * 0.45, y * s - s * 0.45);
      const item = ITEMS.find(i => i.id === G.entry.def.item);
      if (item) drawItem(ctx, item.id, s * 0.9, false);
      ctx.restore();
    }
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
    if (t === "=" || t === ">" || t === "<") {
      if (isClimb(below)) drawClimb(ctx, below, x, y, s, s);
      const o = G.L.offs[r][c], gh = s * 0.32, y0 = y + o[0] * s, y1 = y + o[1] * s;
      ctx.fillStyle = "#f29a9a";
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + s, y1); ctx.lineTo(x + s, y1 + gh); ctx.lineTo(x, y0 + gh); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#263d30"; ctx.lineWidth = 1.5; ctx.beginPath();
      ctx.moveTo(x, y0 + gh); ctx.lineTo(x + s / 2, (y0 + y1) / 2); ctx.lineTo(x + s, y1 + gh); ctx.stroke();
      ctx.strokeStyle = "rgba(38,61,48,.5)"; ctx.beginPath();
      ctx.moveTo(x, y0); ctx.lineTo(x + s, y1); ctx.lineTo(x + s, y1 + gh); ctx.lineTo(x, y0 + gh); ctx.closePath(); ctx.stroke();
    }
    if (t === "{" || t === "}") {
      // A conveyor belt: a gray belt with chevrons sliding the way it moves.
      if (isClimb(below)) drawClimb(ctx, below, x, y, s, s);
      const gh = s * 0.32, d = t === "}" ? 1 : -1;
      ctx.fillStyle = "#8d998f"; ctx.fillRect(x, y, s, gh);
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, s, gh); ctx.clip();
      ctx.strokeStyle = "#f2f0e6"; ctx.lineWidth = 1.5;
      const shift = ((G.t * C.store.conveyorSpeed * d) % 0.5 + 0.5) % 0.5;
      for (let k = -1; k < 3; k++) {
        const cx = x + (k * 0.5 + shift) * s;
        ctx.beginPath(); ctx.moveTo(cx - d * s * 0.08, y + gh * 0.2); ctx.lineTo(cx + d * s * 0.08, y + gh * 0.5); ctx.lineTo(cx - d * s * 0.08, y + gh * 0.8); ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = "#263d30"; ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, y + 0.5, s - 1, gh - 1);
    }
    const key = c + "," + r;
    if (t === "k" && !G.taken.has(key)) {
      // A stuffed-animal key: a little teddy holding a key.
      const cx = x + s / 2, cy = y + s / 2 + Math.sin(G.t * 3 + c) * s * 0.07, u = s / 10;
      ctx.lineWidth = 1.5; ctx.strokeStyle = "#263d30"; ctx.fillStyle = "#f29a9a";
      for (const ex of [-2.2, 2.2]) { ctx.beginPath(); ctx.arc(cx + ex * u, cy - 2.6 * u, 1.2 * u, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(cx, cy - 0.8 * u, 2.6 * u, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#263d30"; ctx.beginPath(); ctx.arc(cx - 0.9 * u, cy - 1.2 * u, 0.4 * u, 0, Math.PI * 2); ctx.arc(cx + 0.9 * u, cy - 1.2 * u, 0.4 * u, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#f3d36b"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy + 2.6 * u, 0.9 * u, 0, Math.PI * 2); ctx.moveTo(cx + 0.9 * u, cy + 2.6 * u); ctx.lineTo(cx + 3.2 * u, cy + 2.6 * u); ctx.lineTo(cx + 3.2 * u, cy + 3.4 * u); ctx.stroke();
    }
    if (t === "Z") {
      // A springboard (squashed for a moment after it launches you).
      const since = G.t - (G.sprung[key] == null ? -9 : G.sprung[key]), squash = since < 0.25 ? 1 - since / 0.25 : 0;
      const base = spotAbove(c, r).y * s, top = base - s * (0.45 - 0.25 * squash);
      ctx.strokeStyle = "#c8cfc4"; ctx.lineWidth = 2.5; ctx.beginPath();
      for (let k = 0; k <= 4; k++) { const py = base - (base - top) * k / 4; ctx[k ? "lineTo" : "moveTo"](x + s * (k % 2 ? 0.7 : 0.3), py); }
      ctx.stroke();
      ctx.fillStyle = "#f29a9a"; ctx.strokeStyle = "#263d30"; ctx.lineWidth = 1.5;
      ctx.fillRect(x + s * 0.1, top - s * 0.12, s * 0.8, s * 0.12); ctx.strokeRect(x + s * 0.1, top - s * 0.12, s * 0.8, s * 0.12);
      ctx.fillStyle = "#8d998f"; ctx.fillRect(x + s * 0.15, base - s * 0.06, s * 0.7, s * 0.06);
    }
    if (POWERS[t] && !G.taken.has(key)) {
      // A floating power-up.
      const cy = y + s / 2 + Math.sin(G.t * 3 + c) * s * 0.08;
      ctx.fillStyle = "rgba(243,211,107,.18)"; ctx.strokeStyle = "rgba(243,211,107,.7)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x + s / 2, cy, s * 0.42, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      drawPowerIcon(ctx, POWERS[t].id, x + s / 2, cy, s * 0.7);
    }
    if (t === "*" && !G.taken.has(key)) {
      const cx = x + s / 2, cy = y + s / 2 + Math.sin(G.t * 3 + c) * s * 0.06, rr = s * 0.32;
      ctx.fillStyle = "#f3d36b"; ctx.strokeStyle = "#8a5a34"; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let k = 0; k <= 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? rr * 0.45 : rr; ctx[k ? "lineTo" : "moveTo"](cx + Math.cos(a) * q, cy + Math.sin(a) * q); }
      ctx.fill(); ctx.stroke();
    }
    if (t === "c" && !G.taken.has(key)) {
      const cx = x + s / 2, cy = y + s / 2, rr = s * 0.2, w = Math.abs(Math.cos(G.t * 3 + c + r));
      ctx.fillStyle = "#f3d36b"; ctx.strokeStyle = "#8a5a34"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(2, rr * w), rr, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    if (t === "S" || (t === "F" && G.mode === "level" && G.cfg.flags)) {
      // A flag: the start, or a checkpoint (colored once it's your checkpoint).
      const on = t === "S" || (G.checkpoint.c === c && G.checkpoint.r === r);
      const base = spotAbove(c, r).y * s;
      ctx.strokeStyle = "rgba(242,240,230,.6)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + s * 0.25, base); ctx.lineTo(x + s * 0.25, base - s * 0.85); ctx.stroke();
      ctx.fillStyle = t === "S" ? "rgba(255,196,107,.6)" : on ? "#b8e986" : "rgba(242,240,230,.35)";
      const wave = Math.sin(G.t * 4 + c) * s * 0.04;
      ctx.beginPath(); ctx.moveTo(x + s * 0.25, base - s * 0.85); ctx.lineTo(x + s * 0.7, base - s * 0.72 + wave); ctx.lineTo(x + s * 0.25, base - s * 0.55); ctx.fill();
    }
    if (t === "T") {
      // The toy box at the bottom, where Bandit's toys end up.
      const base = spotAbove(c, r).y * s;
      ctx.fillStyle = "#a0714a"; ctx.strokeStyle = "#5c3b22"; ctx.lineWidth = 1.5;
      ctx.fillRect(x + s * 0.05, base - s * 0.6, s * 0.9, s * 0.6); ctx.strokeRect(x + s * 0.05, base - s * 0.6, s * 0.9, s * 0.6);
      ctx.fillStyle = "#f29a9a"; ctx.beginPath(); ctx.arc(x + s * 0.35, base - s * 0.62, s * 0.14, Math.PI, 0); ctx.fill();
      ctx.fillStyle = "#9fd3e8"; ctx.beginPath(); ctx.arc(x + s * 0.65, base - s * 0.62, s * 0.12, Math.PI, 0); ctx.fill();
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

  const HAZARD_COLORS = ["#f29a9a", "#9fd3e8", "#f3d36b"];
  function drawHazard(ctx, z, s) {
    const r = z.r * s, x = z.x * s, y = (z.y - z.r - hop(z)) * s;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(z.spin);
    ctx.strokeStyle = "#263d30"; ctx.lineWidth = 1.5;
    if (z.kind === "robot" || z.kind === "car") {
      // Robots and cars don't roll: undo the spin, face the way they're going.
      ctx.rotate(-z.spin);
      const face = (z.state === "fall" ? Math.sign(z.vx) : 0) || z.dir;
      ctx.scale(face < 0 ? -1 : 1, 1);
      if (z.kind === "robot") {
        // A wind-up robot: boxy body, little stepping legs, antenna, and a turning key on its back.
        const step = Math.sin(z.t * 14) * r * 0.2, left = z.life - z.t;
        ctx.fillStyle = "#c8cfc4";
        ctx.fillRect(-r * 0.5, r * 0.55 + step, r * 0.3, r * 0.45); ctx.fillRect(r * 0.2, r * 0.55 - step, r * 0.3, r * 0.45);
        ctx.fillStyle = HAZARD_COLORS[z.color];
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-r * 0.75, -r * 0.55, r * 1.5, r * 1.15, r * 0.2); else ctx.rect(-r * 0.75, -r * 0.55, r * 1.5, r * 1.15); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#c8cfc4"; ctx.beginPath(); ctx.rect(-r * 0.55, -r * 1.15, r * 1.1, r * 0.6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#263d30"; ctx.beginPath(); ctx.arc(r * 0.25, -r * 0.85, r * 0.12, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0, -r * 1.15); ctx.lineTo(0, -r * 1.45); ctx.stroke();
        ctx.save(); ctx.translate(-r * 0.85, -r * 0.05); ctx.rotate(left < 2 ? 0 : z.t * 6);
        ctx.strokeStyle = "#f3d36b"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, -r * 0.3); ctx.lineTo(0, r * 0.3); ctx.stroke(); ctx.restore();
      } else {
        // A toy race car.
        ctx.fillStyle = HAZARD_COLORS[z.color];
        ctx.beginPath(); ctx.moveTo(-r * 1.2, r * 0.6); ctx.lineTo(-r * 1.2, 0); ctx.lineTo(-r * 0.5, -r * 0.1); ctx.lineTo(-r * 0.2, -r * 0.6); ctx.lineTo(r * 0.5, -r * 0.6); ctx.lineTo(r * 0.8, -r * 0.05); ctx.lineTo(r * 1.25, r * 0.15); ctx.lineTo(r * 1.25, r * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#9fd3e8"; ctx.fillRect(-r * 0.1, -r * 0.45, r * 0.5, r * 0.35);
        for (const wx of [-0.65, 0.75]) { ctx.save(); ctx.translate(wx * r, r * 0.65); ctx.rotate(z.spin); ctx.fillStyle = "#263d30"; ctx.beginPath(); ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#c8cfc4"; ctx.beginPath(); ctx.moveTo(-r * 0.2, 0); ctx.lineTo(r * 0.2, 0); ctx.stroke(); ctx.restore(); }
      }
    } else if (z.kind === "ball") {
      ctx.fillStyle = HAZARD_COLORS[z.color]; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "#f2f0e6"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, r * 0.62, -0.6, 0.9); ctx.stroke();
    } else {
      // A paint can rolling on its side: the lid, with paint splashed on it.
      ctx.fillStyle = "#c8cfc4"; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = HAZARD_COLORS[z.color]; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r * 0.78, -0.4, 1.4); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(38,61,48,.6)"; ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  // A tire swing: a branch, its rope, and the tire.
  function drawSwing(ctx, sw, s) {
    const p = swingPos(sw, G.t);
    ctx.strokeStyle = "#8a5a34"; ctx.lineWidth = Math.max(3, s * 0.14); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo((sw.x - 0.9) * s, (sw.y - 0.1) * s); ctx.lineTo((sw.x + 0.9) * s, (sw.y + 0.05) * s); ctx.stroke();
    ctx.strokeStyle = "#c9a26b"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sw.x * s, sw.y * s); ctx.lineTo(p.x * s, (p.y - 0.35) * s); ctx.stroke();
    ctx.strokeStyle = "#2c3233"; ctx.lineWidth = Math.max(4, s * 0.16);
    ctx.beginPath(); ctx.ellipse(p.x * s, p.y * s, s * 0.38, s * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "rgba(242,240,230,.25)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(p.x * s, p.y * s, s * 0.3, s * 0.22, 0, 0.5, 2.2); ctx.stroke();
  }
  // A yo-yo on its string.
  function drawYoyo(ctx, yo, s) {
    const p = yoyoPos(yo), r = C.yoyo.radius * s;
    // The string hangs from the girder (or block) above.
    let a = yo.r;
    while (a > 0 && !plat(yo.c, a - 1) && !solid(yo.c, a - 1)) a--;
    const top = a > 0 && plat(yo.c, a - 1) ? surfaceTop(yo.c, a - 1, yo.c + 0.5) + 0.3 : a;
    ctx.strokeStyle = "rgba(242,240,230,.6)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(p.x * s, top * s); ctx.lineTo(p.x * s, p.y * s); ctx.stroke();
    ctx.save(); ctx.translate(p.x * s, p.y * s); ctx.rotate(G.t * 9);
    ctx.fillStyle = "#d7b4f3"; ctx.strokeStyle = "#263d30"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#f2f0e6"; ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.lineTo(r * 0.6, 0); ctx.stroke();
    ctx.restore();
  }
  // Bandit's toy chest: locked until every key is found, then the lid flips open.
  function drawChest(ctx, ch, s) {
    const x = ch.c * s, base = spotAbove(ch.c, ch.r).y * s, w = s * 0.9, h = s * 0.55, x0 = x + s * 0.05;
    ctx.fillStyle = "#a0714a"; ctx.strokeStyle = "#5c3b22"; ctx.lineWidth = 1.5;
    ctx.fillRect(x0, base - h, w, h); ctx.strokeRect(x0, base - h, w, h);
    const open = G.chestOpen ? Math.min(1, (G.t - G.chestOpen) / 0.4) : 0;
    ctx.save(); ctx.translate(x0, base - h); ctx.rotate(-open * 1.9);
    ctx.fillStyle = "#c9a26b"; ctx.fillRect(0, -s * 0.2, w, s * 0.2); ctx.strokeRect(0, -s * 0.2, w, s * 0.2);
    ctx.restore();
    if (!open) {
      // One little padlock per key still missing.
      const left = Math.max(0, G.L.keysTotal - G.keys);
      for (let k = 0; k < left; k++) {
        const lx = x0 + w * (k + 1) / (left + 1);
        ctx.fillStyle = "#f3d36b"; ctx.fillRect(lx - s * 0.07, base - h * 0.6, s * 0.14, s * 0.12);
        ctx.strokeStyle = "#f3d36b"; ctx.beginPath(); ctx.arc(lx, base - h * 0.6, s * 0.05, Math.PI, 0); ctx.stroke();
      }
    }
  }

  // A lift: guide rails up its shaft, and the platform riding up and down.
  function drawLift(ctx, l, s) {
    ctx.strokeStyle = "rgba(242,240,230,.18)"; ctx.lineWidth = 2;
    for (const gx of [l.c + 0.08, l.c + l.w - 0.08]) { ctx.beginPath(); ctx.moveTo(gx * s, (l.top - 1) * s); ctx.lineTo(gx * s, (l.bottom + 0.3) * s); ctx.stroke(); }
    const x = l.c * s, y = l.y * s, w = l.w * s, gh = s * 0.3;
    ctx.fillStyle = "#f5a142"; ctx.strokeStyle = "#263d30"; ctx.lineWidth = 1.5;
    ctx.fillRect(x + 2, y, w - 4, gh); ctx.strokeRect(x + 2, y, w - 4, gh);
    ctx.strokeStyle = "rgba(242,240,230,.5)"; ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y - s * 0.15); ctx.stroke();
    // A little arrow showing which way it's going next.
    ctx.fillStyle = "rgba(38,61,48,.7)"; const ay = y + gh / 2, d = l.dir;
    ctx.beginPath(); ctx.moveTo(x + w * 0.2 - 4, ay - d * 3); ctx.lineTo(x + w * 0.2 + 4, ay - d * 3); ctx.lineTo(x + w * 0.2, ay + d * 3); ctx.fill();
  }

  // Power-up pictures (in the level, and on the Use button).
  function drawPowerIcon(c, id, cx, cy, size) {
    const u = size / 10;
    c.save(); c.translate(cx, cy);
    c.lineCap = "round"; c.lineJoin = "round"; c.lineWidth = Math.max(1.5, u * 0.6); c.strokeStyle = "#263d30";
    if (id === "wand") {
      c.strokeStyle = "#c9a26b"; c.lineWidth = Math.max(2, u * 0.9); c.beginPath(); c.moveTo(-3.5 * u, 3.5 * u); c.lineTo(0.5 * u, -0.5 * u); c.stroke();
      c.strokeStyle = "#9fd3e8"; c.lineWidth = Math.max(1.5, u * 0.6); c.fillStyle = "rgba(159,211,232,.3)";
      c.beginPath(); c.arc(1.8 * u, -1.8 * u, 1.6 * u, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.arc(3.6 * u, -3.8 * u, 0.8 * u, 0, Math.PI * 2); c.stroke();
    } else if (id === "sneakers") {
      c.fillStyle = "#f29a9a"; c.beginPath(); c.moveTo(-4 * u, 2.5 * u); c.lineTo(-4 * u, -1 * u); c.lineTo(-1 * u, -1 * u); c.lineTo(1 * u, 0.8 * u); c.lineTo(4 * u, 1.3 * u); c.lineTo(4 * u, 2.5 * u); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = "#f2f0e6"; c.fillRect(-4 * u, 2.5 * u, 8 * u, 0.9 * u);
      c.strokeStyle = "#f3d36b"; c.beginPath(); c.moveTo(-1 * u, -1.5 * u); c.lineTo(-3 * u, -4 * u); c.moveTo(0.5 * u, -1 * u); c.lineTo(-0.5 * u, -3.8 * u); c.stroke();
    } else if (id === "shield") {
      c.fillStyle = "#9fd3e8"; c.beginPath(); c.moveTo(0, -4 * u); c.lineTo(3.5 * u, -2.8 * u); c.lineTo(3 * u, 1.5 * u); c.lineTo(0, 4 * u); c.lineTo(-3 * u, 1.5 * u); c.lineTo(-3.5 * u, -2.8 * u); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = "#f2f0e6"; c.beginPath(); c.moveTo(0, -2.5 * u); c.lineTo(0, 2.5 * u); c.stroke();
    } else {
      c.strokeStyle = "#b8e986"; c.lineWidth = Math.max(2, u * 0.9);
      for (const oy of [1.2, -1.8]) { c.beginPath(); c.moveTo(-3 * u, (oy + 1.8) * u); c.lineTo(0, oy * u); c.lineTo(3 * u, (oy + 1.8) * u); c.stroke(); }
    }
    c.restore();
  }

  // Bandit: a mischievous raccoon (never mean). Poses: idle, throw, wave, tongue, giggle, dance, caught, flee.
  function drawBandit(ctx, B, s) {
    const pose = B.pose, t = G.t;
    ctx.save();
    ctx.translate(B.x * s, B.y * s);
    if (pose === "dance") ctx.rotate(Math.sin(t * 12) * 0.25);
    if (pose === "giggle") ctx.translate(Math.sin(t * 40) * s * 0.03, 0);
    ctx.scale(B.dir < 0 ? -1 : 1, 1);
    const u = s * 1.05;
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = Math.max(1.5, u * 0.05); ctx.strokeStyle = "#263d30";
    // Striped tail.
    const wag = Math.sin(t * (pose === "dance" ? 10 : 3)) * 0.25;
    ctx.save(); ctx.translate(-u * 0.25, -u * 0.3); ctx.rotate(-0.9 + wag);
    for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? "#4b5354" : "#a8b0b2"; ctx.beginPath(); ctx.ellipse(-u * (0.12 + k * 0.12), 0, u * 0.1, u * 0.1 + k * u * 0.005, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    // Legs and body.
    const step = pose === "dance" || pose === "flee" ? Math.sin(t * 16) * u * 0.08 : 0;
    ctx.fillStyle = "#4b5354";
    ctx.fillRect(-u * 0.18, -u * 0.18 + step, u * 0.12, u * 0.18); ctx.fillRect(u * 0.06, -u * 0.18 - step, u * 0.12, u * 0.18);
    ctx.fillStyle = "#9aa3a6"; ctx.beginPath(); ctx.ellipse(0, -u * 0.42, u * 0.28, u * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#d4d9da"; ctx.beginPath(); ctx.ellipse(u * 0.05, -u * 0.38, u * 0.15, u * 0.19, 0, 0, Math.PI * 2); ctx.fill();
    // Arms.
    ctx.strokeStyle = "#4b5354"; ctx.lineWidth = u * 0.09;
    const arm = (ax, ay, ex, ey) => { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex, ey); ctx.stroke(); };
    if (pose === "throw") { const f = Math.max(0, (B.poseT - t) / 0.5); arm(u * 0.15, -u * 0.55, u * (0.15 + 0.3 * (1 - f)), -u * (0.95 - 0.5 * (1 - f))); }
    else if (pose === "wave") arm(u * 0.15, -u * 0.55, u * 0.35 + Math.sin(t * 14) * u * 0.08, -u * 0.95);
    else if (pose === "dance") { arm(u * 0.15, -u * 0.55, u * 0.4, -u * (0.8 + Math.sin(t * 12) * 0.15)); arm(-u * 0.15, -u * 0.55, -u * 0.4, -u * (0.8 - Math.sin(t * 12) * 0.15)); }
    else if (pose === "caught") { arm(u * 0.12, -u * 0.5, u * 0.3, -u * 0.62); }
    else if (pose === "flee") { arm(u * 0.15, -u * 0.55, u * 0.3, -u * 1.0); arm(-u * 0.15, -u * 0.55, -u * 0.3, -u * 1.0); }
    else arm(u * 0.15, -u * 0.5, u * 0.25, -u * 0.25);
    // Head: ears, face, the black mask, eyes, nose.
    ctx.lineWidth = Math.max(1.5, u * 0.05); ctx.strokeStyle = "#263d30";
    const hx = u * 0.05, hy = -u * 0.86, hr = u * 0.27;
    const ear = pose === "caught" ? 0.5 : 0;
    ctx.fillStyle = "#9aa3a6";
    for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hx + sgn * hr * 0.4, hy - hr * 0.6); ctx.lineTo(hx + sgn * hr * (0.95 + ear), hy - hr * (1.25 - ear)); ctx.lineTo(hx + sgn * hr * 0.95, hy - hr * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#f2f0e6"; ctx.beginPath(); ctx.ellipse(hx + hr * 0.25, hy + hr * 0.35, hr * 0.55, hr * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#2c3233"; ctx.beginPath(); ctx.ellipse(hx + hr * 0.1, hy - hr * 0.05, hr * 0.85, hr * 0.28, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f2f0e6";
    for (const ex of [-0.25, 0.4]) { ctx.beginPath(); ctx.arc(hx + hr * ex, hy - hr * 0.05, hr * 0.15, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "#263d30";
    const look = pose === "caught" ? 0.06 : 0;
    for (const ex of [-0.25, 0.4]) { ctx.beginPath(); ctx.arc(hx + hr * (ex + 0.04), hy - hr * (0.02 - look * 3), hr * 0.07, 0, Math.PI * 2); ctx.fill(); }
    ctx.beginPath(); ctx.arc(hx + hr * 0.75, hy + hr * 0.3, hr * 0.12, 0, Math.PI * 2); ctx.fill();
    // Mouth: a grin, a giggle, a tongue, or a sheepish wobble.
    ctx.lineWidth = Math.max(1.2, u * 0.035);
    if (pose === "tongue") { ctx.fillStyle = "#f29a9a"; ctx.beginPath(); ctx.ellipse(hx + hr * 0.5, hy + hr * 0.65, hr * 0.14, hr * 0.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    else if (pose === "caught") { ctx.beginPath(); ctx.moveTo(hx + hr * 0.15, hy + hr * 0.62); ctx.quadraticCurveTo(hx + hr * 0.35, hy + hr * 0.5, hx + hr * 0.55, hy + hr * 0.62); ctx.stroke();
      // a little sweat drop
      ctx.fillStyle = "#9fd3e8"; ctx.beginPath(); ctx.ellipse(hx - hr * 0.75, hy - hr * 0.5, hr * 0.1, hr * 0.16, 0, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(hx + hr * 0.4, hy + hr * 0.45, hr * (pose === "giggle" || pose === "dance" ? 0.25 : 0.18), 0.2, Math.PI - 0.2); ctx.stroke(); }
    ctx.restore();
    if (pose === "giggle" || pose === "dance") {
      ctx.fillStyle = "rgba(242,240,230,.7)"; ctx.font = `${Math.round(s * 0.38)}px "Gochi Hand", cursive`; ctx.textAlign = "center";
      ctx.fillText(pose === "dance" ? "♪ hee hee ♪" : "hee hee!", B.x * s, (B.y - 1.55) * s);
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
    if (G.t < h.safeT && G.t >= h.dizzyT && Math.floor(G.t * 10) % 2) return; // blink while safe after a bonk
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
    // The shield power-up: a bubble around the hero until it blocks a bonk.
    if (G.shield) {
      ctx.strokeStyle = "rgba(159,211,232,.85)"; ctx.lineWidth = 2.5; ctx.fillStyle = "rgba(159,211,232,.12)";
      ctx.beginPath(); ctx.arc(fx, fy - bh * 0.5, bh * 0.75 + Math.sin(G.t * 5) * 1.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // Super sneakers: a few speed lines behind the hero.
    if (G.t < G.sneakT && Math.abs(h.vx) > 1) {
      ctx.strokeStyle = "rgba(243,211,107,.7)"; ctx.lineWidth = 2;
      for (const k of [0.3, 0.55]) { ctx.beginPath(); ctx.moveTo(fx - h.face * bw * 0.6, fy - bh * k); ctx.lineTo(fx - h.face * bw * 1.3, fy - bh * k); ctx.stroke(); }
    }
    // Dizzy after a bonk: little stars circling the head (never hurt, just dizzy).
    if (G.t < h.dizzyT) {
      ctx.fillStyle = "#f3d36b";
      for (let k = 0; k < 3; k++) {
        const a = G.t * 8 + k * 2.1;
        ctx.beginPath(); ctx.arc(fx + Math.cos(a) * bw * 0.6, fy - bh * 1.15 + Math.sin(a) * bw * 0.2, Math.max(2, s * 0.06), 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  /* The stolen toys, as little chalk drawings in a size x size box (silhouette = still missing). */
  function drawItem(c, id, size, silhouette) {
    c.save();
    const u = size / 10;
    c.lineCap = "round"; c.lineJoin = "round"; c.lineWidth = Math.max(1.5, u * 0.35); c.strokeStyle = "#263d30";
    const rect = (x, y, w, h, fill) => { c.fillStyle = fill; c.beginPath(); if (c.roundRect) c.roundRect(x * u, y * u, w * u, h * u, u * 0.5); else c.rect(x * u, y * u, w * u, h * u); c.fill(); c.stroke(); };
    const circle = (x, y, r, fill) => { c.fillStyle = fill; c.beginPath(); c.arc(x * u, y * u, r * u, 0, Math.PI * 2); c.fill(); c.stroke(); };
    switch (id) {
      case "comic":
        rect(2, 1.5, 6, 7, "#f3d36b");
        c.fillStyle = "#f29a9a"; c.beginPath();
        for (let k = 0; k <= 12; k++) { const a = k * Math.PI / 6, r = k % 2 ? 1.1 : 2; c.lineTo((5 + Math.cos(a) * r) * u, (4.5 + Math.sin(a) * r) * u); }
        c.fill(); c.fillStyle = "#263d30"; c.font = `${Math.round(u * 1.4)}px "Gochi Hand", cursive`; c.textAlign = "center"; c.fillText("POW", 5 * u, 5 * u);
        break;
      case "videogame":
        rect(1.5, 3, 7, 4, "#d7b4f3");
        c.beginPath(); c.moveTo(3 * u, 4.2 * u); c.lineTo(3 * u, 5.8 * u); c.moveTo(2.2 * u, 5 * u); c.lineTo(3.8 * u, 5 * u); c.stroke();
        circle(6.3, 4.4, 0.5, "#f29a9a"); circle(7.2, 5.4, 0.5, "#9fd3e8");
        break;
      case "crayons":
        [["#f29a9a", 2.5], ["#9fd3e8", 4.5], ["#b8e986", 6.5]].forEach(([col, x]) => {
          c.fillStyle = col; c.beginPath(); c.moveTo(x * u, 8.5 * u); c.lineTo(x * u, 3 * u); c.lineTo((x + 0.75) * u, 1.5 * u); c.lineTo((x + 1.5) * u, 3 * u); c.lineTo((x + 1.5) * u, 8.5 * u); c.closePath(); c.fill(); c.stroke();
        });
        break;
      case "movie":
        rect(2, 4, 6, 4.5, "#c8cfc4");
        c.save(); c.translate(2 * u, 4 * u); c.rotate(-0.35); rect(0, -1.6, 6, 1.6, "#263d30"); c.restore();
        circle(5, 6.2, 1, "#f3d36b");
        break;
      case "cards":
        c.save(); c.translate(5 * u, 5 * u); c.rotate(-0.25); rect(-3, -3.5, 4.5, 6.5, "#9fd3e8"); c.restore();
        c.save(); c.translate(5 * u, 5 * u); c.rotate(0.2); rect(-1.5, -3.2, 4.5, 6.5, "#f3d36b"); c.restore();
        break;
      case "robot":
        rect(3, 1.5, 4, 3, "#c8cfc4"); rect(2.5, 4.8, 5, 3.5, "#9fd3e8");
        circle(4.2, 3, 0.45, "#263d30"); circle(5.8, 3, 0.45, "#263d30");
        c.beginPath(); c.moveTo(5 * u, 1.5 * u); c.lineTo(5 * u, 0.6 * u); c.moveTo(3.5 * u, 8.3 * u); c.lineTo(3.5 * u, 9.3 * u); c.moveTo(6.5 * u, 8.3 * u); c.lineTo(6.5 * u, 9.3 * u); c.stroke();
        break;
      case "bear":
        circle(3, 2.6, 1.2, "#c9a26b"); circle(7, 2.6, 1.2, "#c9a26b"); circle(5, 5.2, 3.2, "#c9a26b");
        circle(5, 6.3, 1.2, "#e8d4b0"); circle(3.9, 4.5, 0.35, "#263d30"); circle(6.1, 4.5, 0.35, "#263d30");
        break;
      case "kite":
        c.fillStyle = "#f29a9a"; c.beginPath(); c.moveTo(5 * u, 0.8 * u); c.lineTo(8 * u, 4 * u); c.lineTo(5 * u, 8 * u); c.lineTo(2 * u, 4 * u); c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(5 * u, 0.8 * u); c.lineTo(5 * u, 8 * u); c.moveTo(2 * u, 4 * u); c.lineTo(8 * u, 4 * u); c.stroke();
        c.beginPath(); c.moveTo(5 * u, 8 * u); c.quadraticCurveTo(4 * u, 9 * u, 6 * u, 9.6 * u); c.stroke();
        break;
      case "soccer":
        circle(5, 5, 3.6, "#f2f0e6");
        c.fillStyle = "#263d30"; c.beginPath();
        for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * Math.PI * 2 / 5; c.lineTo((5 + Math.cos(a) * 1.2) * u, (5 + Math.sin(a) * 1.2) * u); }
        c.fill();
        break;
      case "skateboard":
        rect(1, 4.2, 8, 1.4, "#f5a142"); circle(2.8, 6.6, 0.8, "#f2f0e6"); circle(7.2, 6.6, 0.8, "#f2f0e6");
        break;
      case "puzzle":
        rect(2.2, 3.2, 5.6, 5.6, "#b8e986"); circle(5, 3.2, 1.1, "#b8e986"); circle(7.8, 6, 1.1, "#b8e986");
        break;
      default: // race-car set
        rect(1.5, 4.5, 7, 2.2, "#f29a9a"); rect(3.5, 3, 3, 1.8, "#9fd3e8");
        circle(3, 7, 1, "#263d30"); circle(7, 7, 1, "#263d30");
    }
    if (silhouette) { c.globalCompositeOperation = "source-in"; c.fillStyle = "rgba(20,32,25,.75)"; c.fillRect(0, 0, size, size); }
    c.restore();
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
    tileStat(playerId) {
      const prog = progress[playerId];
      if (!prog) return null;
      const stars = Object.values(prog.levels).reduce((s, l) => s + starCount(l.stars), 0), best = Act.scores.bestAny(ID, playerId);
      return [stars ? `★ ${stars}` : "", best ? `Best ${best}` : "", `${prog.shelf.length} ${prog.shelf.length === 1 ? "toy" : "toys"} back`].filter(Boolean).join(" · ");
    },
    resetStats() { Act.scores.reset(ID); progress = {}; saveProgress(); },
    forgetPlayer(id) {
      Act.scores.forgetPlayer(ID, id);
      delete progress[id]; delete prefs[id];
      saveProgress(); A.store.set("toy-tower:prefs", prefs);
    }
  });
})();

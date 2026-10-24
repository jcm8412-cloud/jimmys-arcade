/* Shared kit for the action games (6–10): a canvas game screen with a fixed-timestep loop, pause
   (button, Paused screen, auto-pause in the background), 3-2-1 countdown, swipe input, chalk drawing
   helpers, high scores (per player/game/level plus a household top 5), and the daily twist.
   Games use it through Arcade.Action. */
(function () {
  const A = window.Arcade = window.Arcade || {};
  const STEP = 1 / 60;          // seconds per update: the same game speed on every device
  const MAX_FRAME = 0.25;       // after a long stall, don't try to catch up more than this

  /* ---------- Daily twist ----------
     Picked from the date, so every device in the house agrees. Only games that are built (they list
     `twists` when registering and aren't "coming soon") take part. */
  function dateKey(d) {
    d = d || new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function daily(date) {
    const games = (A.games || []).filter(g => g.twists && g.twists.length && !g.comingSoon);
    if (!games.length) return null;
    const key = dateKey(date);
    const h = hash("jimmys-arcade-daily:" + key);
    const game = games[h % games.length];
    const twist = Math.floor(h / games.length) % game.twists.length;
    return { key, gameId: game.id, twist, name: game.twists[twist] };
  }

  /* ---------- High scores ----------
     action:best  {gameId: {level: {playerId: score}}}
     action:top   {"gameId|level": [{id, name, avatar, score, date}]}  household top 5 (guests not saved)
     action:daily {"gameId|YYYY-MM-DD": [...top 5 for that day]}       only today's are kept */
  const TOP = 5;
  const scores = {
    best(gameId, level, playerId) {
      const all = A.store.get("action:best", {});
      return (playerId && all[gameId] && all[gameId][level] && all[gameId][level][playerId]) || 0;
    },
    bestAny(gameId, playerId) {
      const g = A.store.get("action:best", {})[gameId] || {};
      return Math.max(0, ...Object.values(g).map(lv => (lv && lv[playerId]) || 0));
    },
    top(gameId, level) { return A.store.get("action:top", {})[`${gameId}|${level}`] || []; },
    dailyTop(gameId) { return A.store.get("action:daily", {})[`${gameId}|${dateKey()}`] || []; },
    // Record a finished round. Returns { best, newBest, rank } (rank: place in the top 5, or -1).
    submit(gameId, level, player, score, opts) {
      const daily = opts && opts.daily;
      let prev = 0, newBest = false;
      if (player && player.id && !daily) {
        const all = A.store.get("action:best", {});
        const g = all[gameId] = all[gameId] || {};
        const lv = g[level] = g[level] || {};
        prev = lv[player.id] || 0;
        if (score > prev) { lv[player.id] = score; newBest = score > 0; }
        A.store.set("action:best", all);
      }
      let rank = -1;
      if (player && player.id && score > 0) {
        const storeKey = daily ? "action:daily" : "action:top";
        const all = A.store.get(storeKey, {});
        const key = daily ? `${gameId}|${dateKey()}` : `${gameId}|${level}`;
        if (daily) for (const k of Object.keys(all)) if (!k.endsWith("|" + dateKey())) delete all[k];
        const list = all[key] || [];
        const entry = { id: player.id, name: player.name, avatar: player.avatar, score, date: dateKey() };
        list.push(entry);
        list.sort((a, b) => b.score - a.score);
        all[key] = list.slice(0, TOP);
        rank = all[key].indexOf(entry);
        A.store.set(storeKey, all);
      }
      return { best: Math.max(prev, score), newBest, rank };
    },
    forgetPlayer(gameId, playerId) {
      const best = A.store.get("action:best", {});
      for (const lv of Object.values(best[gameId] || {})) delete lv[playerId];
      A.store.set("action:best", best);
      for (const storeKey of ["action:top", "action:daily"]) {
        const all = A.store.get(storeKey, {});
        for (const k of Object.keys(all)) if (k.startsWith(gameId + "|")) all[k] = all[k].filter(e => e.id !== playerId);
        A.store.set(storeKey, all);
      }
    },
    reset(gameId) {
      const best = A.store.get("action:best", {});
      delete best[gameId];
      A.store.set("action:best", best);
      for (const storeKey of ["action:top", "action:daily"]) {
        const all = A.store.get(storeKey, {});
        for (const k of Object.keys(all)) if (k.startsWith(gameId + "|")) delete all[k];
        A.store.set(storeKey, all);
      }
    }
  };

  // A household top-5 list as HTML (highlight = index to mark, e.g. the round just played).
  function topListHtml(list, highlight) {
    if (!list.length) return `<p class="note">No scores yet. Be the first!</p>`;
    return `<ol class="top5">${list.map((e, i) => `<li class="${i === highlight ? "me" : ""}">
      ${A.avatarSvg(e)}<span class="nm">${A.esc(e.name)}</span><b>${e.score}</b></li>`).join("")}</ol>`;
  }

  /* ---------- Swipes ----------
     Calls onSwipe(dir, info) with dir "up" | "down" | "left" | "right" once the finger has moved far
     enough, then re-arms from there so one long drag can make several turns. A short touch with no
     movement calls onTap(info). info = { x, y } (CSS px relative to the element) and the pointer type. */
  function swipes(el, { onSwipe, onTap, threshold }) {
    const min = threshold || 22;
    const active = new Map();
    const pos = e => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    el.addEventListener("pointerdown", e => {
      const p = pos(e);
      active.set(e.pointerId, { sx: p.x, sy: p.y, ox: p.x, oy: p.y, moved: false });
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      e.preventDefault();
    });
    el.addEventListener("pointermove", e => {
      const a = active.get(e.pointerId);
      if (!a) return;
      const p = pos(e), dx = p.x - a.sx, dy = p.y - a.sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < min) return;
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
      a.moved = true;
      a.sx = p.x; a.sy = p.y;
      if (onSwipe) onSwipe(dir, { x: a.ox, y: a.oy, type: e.pointerType });
    });
    const end = e => {
      const a = active.get(e.pointerId);
      active.delete(e.pointerId);
      if (a && !a.moved && onTap) onTap({ x: a.ox, y: a.oy, type: e.pointerType });
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", e => active.delete(e.pointerId));
  }

  /* ---------- Chalk drawing helpers ---------- */
  // A slightly rough chalk stroke: a main line plus two faint offset passes.
  function chalkLine(ctx, x1, y1, x2, y2, color, width) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = width * 0.6;
    const o = width * 0.35;
    ctx.beginPath(); ctx.moveTo(x1 + o, y1 - o); ctx.lineTo(x2 + o, y2 - o); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1 - o, y1 + o * 0.6); ctx.lineTo(x2 - o, y2 + o * 0.6); ctx.stroke();
    ctx.restore();
  }
  // Light chalk-dust particles for fast-moving things (capped so they stay cheap).
  function dust(max) {
    const parts = [];
    max = max || 60;
    return {
      emit(x, y, color, n) {
        for (let i = 0; i < (n || 1); i++) {
          if (parts.length >= max) parts.shift();
          parts.push({ x, y, vx: (Math.random() - .5) * 30, vy: (Math.random() - .5) * 30, life: .5 + Math.random() * .4, age: 0, color });
        }
      },
      update(dt) {
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i];
          p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.age >= p.life) parts.splice(i, 1);
        }
      },
      draw(ctx) {
        for (const p of parts) {
          ctx.globalAlpha = 0.35 * (1 - p.age / p.life);
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
        }
        ctx.globalAlpha = 1;
      },
      clear() { parts.length = 0; }
    };
  }

  /* ---------- The game screen ----------
     createScreen({ id, cls, onRestart, onQuit, onResize }) builds a <section class="screen action">
     with a header (Home top-left, a HUD in the middle, Pause top-right), a stage holding the canvas,
     an optional controls area under it, and overlays (countdown, Paused, panels, bursts).
     The returned object runs the loop: start(update, render) shows the countdown, then calls
     update(dt) at a fixed 60 per second and render(alpha) every frame. */
  const PAUSE_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6 V18 M15 6 V18"/></svg>`;
  function createScreen({ id, cls, onRestart, onQuit, onResize }) {
    document.getElementById("game-root").insertAdjacentHTML("beforeend", `
      <section class="screen action ${cls || ""}" id="${id}" hidden>
        <header class="act-bar">
          <button class="icon-btn" data-home aria-label="Home"></button>
          <div class="act-hud" id="${id}-hud"></div>
          <button class="icon-btn act-pause" id="${id}-pause" aria-label="Pause">${PAUSE_ICON}</button>
        </header>
        <div class="act-stage" id="${id}-stage">
          <canvas id="${id}-canvas"></canvas>
          <div class="act-countdown" id="${id}-count" hidden></div>
          <div class="act-message" id="${id}-msg" hidden></div>
          <div class="act-burst" id="${id}-burst" hidden>New best!</div>
          <div class="act-overlay" id="${id}-paused" hidden>
            <div class="act-panel">
              <h2>Paused</h2>
              <div class="col">
                <button class="btn big" data-act="resume">Resume</button>
                <button class="btn" data-act="restart">Restart</button>
                <button class="btn ghost" data-act="home">Home</button>
              </div>
            </div>
          </div>
          <div class="act-overlay" id="${id}-panel" hidden></div>
        </div>
        <div class="act-controls" id="${id}-controls"></div>
      </section>`);
    const $ = s => document.getElementById(`${id}-${s}`);
    const section = document.getElementById(id);
    const canvas = $("canvas"), stage = $("stage");
    const ctx = canvas.getContext("2d");
    const size = { w: 0, h: 0, dpr: 1 };

    let update = null, render = null, raf = 0, last = 0, acc = 0;
    let running = false, active = false, counting = 0;

    function resize() {
      const r = stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      size.dpr = Math.min(window.devicePixelRatio || 1, 3);
      size.w = r.width; size.h = r.height;
      canvas.width = Math.round(r.width * size.dpr);
      canvas.height = Math.round(r.height * size.dpr);
      canvas.style.width = r.width + "px";
      canvas.style.height = r.height + "px";
      ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      if (onResize) onResize(size.w, size.h);
      if (render) render(0);
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
    else window.addEventListener("resize", resize);

    function frame(now) {
      if (!running) return;
      let dt = (now - last) / 1000;
      last = now;
      if (dt > MAX_FRAME) dt = MAX_FRAME;
      acc += dt;
      while (acc >= STEP && running) { update(STEP); acc -= STEP; }
      if (render) render(acc / STEP);
      if (running) raf = requestAnimationFrame(frame);
    }
    function run() {
      running = true;
      acc = 0;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
    function halt() { running = false; cancelAnimationFrame(raf); }

    // 3-2-1 chalk countdown, then run.
    function countdown(then) {
      const el = $("count");
      const seq = ["3", "2", "1", "Go!"];
      const token = ++counting;
      let i = 0;
      el.hidden = false;
      const tick = () => {
        if (token !== counting) return;
        if (i >= seq.length) { el.hidden = true; then(); return; }
        el.textContent = seq[i];
        el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
        setTimeout(tick, seq[i] === "Go!" ? 450 : 650);
        i++;
      };
      tick();
    }
    const cancelCountdown = () => { counting++; $("count").hidden = true; };

    const api = {
      section, canvas, ctx, size, stage,
      hud: $("hud"), controls: $("controls"),
      get running() { return running; },
      get active() { return active; },
      show() { A.show(id); requestAnimationFrame(resize); },
      // Begin a round: countdown, then the loop.
      start(u, r) {
        update = u; render = r;
        active = true;
        api.hidePanel();
        $("paused").hidden = true;
        halt();
        resize();
        if (render) render(0);
        countdown(run);
      },
      pause() {
        if (!active || !$("paused").hidden) return;
        halt();
        cancelCountdown();
        $("paused").hidden = false;
        $("paused").querySelector("[data-act=resume]").focus({ preventScroll: true });
      },
      resume() {
        $("paused").hidden = true;
        if (!active) return;
        countdown(run);
      },
      // Stop for good (round over or leaving). The last frame stays on screen.
      stop() { halt(); cancelCountdown(); active = false; $("paused").hidden = true; },
      // Freeze briefly without the Paused screen (e.g. "Ouch!" after losing a life).
      hold(ms, then) {
        halt();
        setTimeout(() => { if (active && $("paused").hidden) { if (then) then(); run(); } }, ms);
      },
      message(text, ms) {
        const el = $("msg");
        el.textContent = text;
        el.hidden = false;
        el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
        clearTimeout(api._msgT);
        api._msgT = setTimeout(() => { el.hidden = true; }, ms || 1000);
      },
      burst(text) {
        const el = $("burst");
        el.textContent = text || "New best!";
        el.hidden = false;
        el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
        clearTimeout(api._burstT);
        api._burstT = setTimeout(() => { el.hidden = true; }, 1800);
      },
      // A panel over the stage: html plus buttons [{label, cls, run}]. split: {top, bottom} html for
      // two players facing each other (the top half is rotated to face the far player).
      showPanel({ html, split, buttons }) {
        const el = $("panel");
        el.innerHTML = split
          ? `<div class="act-split"><div class="half far">${split.top}</div><div class="act-buttons"></div><div class="half">${split.bottom}</div></div>`
          : `<div class="act-panel">${html}<div class="act-buttons col"></div></div>`;
        const box = el.querySelector(".act-buttons");
        for (const b of buttons || []) {
          const btn = document.createElement("button");
          btn.className = "btn " + (b.cls || "");
          btn.textContent = b.label;
          btn.addEventListener("click", b.run);
          box.appendChild(btn);
        }
        el.hidden = false;
      },
      hidePanel() { $("panel").hidden = true; }
    };

    $("pause").addEventListener("click", () => api.pause());
    $("paused").addEventListener("click", e => {
      const act = e.target.closest("[data-act]");
      if (!act) return;
      if (act.dataset.act === "resume") api.resume();
      else if (act.dataset.act === "restart") { api.stop(); if (onRestart) onRestart(); }
      else { api.stop(); if (onQuit) onQuit(); }
    });
    // Pause automatically when the app goes to the background or the screen locks.
    document.addEventListener("visibilitychange", () => { if (document.hidden && running) api.pause(); });
    window.addEventListener("pagehide", () => { if (running) api.pause(); });
    // Home during a round: pause first and ask.
    A.homeGuards[id] = async () => {
      if (!active) return true;
      api.pause();
      const leave = await A.confirm("Leave this game? This round won't count.", "Leave");
      if (leave) api.stop();
      return leave;
    };
    // Keyboard: Escape or P pauses / resumes.
    document.addEventListener("keydown", e => {
      if (A.currentScreen !== id || A.dialogOpen()) return;
      if (e.key === "Escape" || e.key === "p" || e.key === "P") {
        e.preventDefault();
        if (!$("paused").hidden) api.resume(); else api.pause();
      }
    });
    // No page scrolling or zooming while playing.
    stage.addEventListener("touchmove", e => e.preventDefault(), { passive: false });
    section.addEventListener("gesturestart", e => e.preventDefault());
    return api;
  }

  A.Action = { STEP, dateKey, daily, scores, topListHtml, swipes, chalkLine, dust, createScreen };
})();

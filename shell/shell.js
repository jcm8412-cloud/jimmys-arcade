/* The arcade shell: home screen, players, settings, themes, pass-the-phone screen, and the
   shared helpers every game uses. Games register with Arcade.registerGame():
     id, name, accent, icon (SVG markup for a 48x48 box; class "acc" draws in the accent color)
     comingSoon   true for a placeholder tile
     open()       show the game's own menu
     tileStat(playerId)  short text for the home tile, e.g. "Best streak: 7" (or null)
     resetStats() / forgetPlayer(id)   clear saved stats for everyone / for one removed player
     autoResume() return true if it resumed an unfinished game at launch */
(function () {
  const A = window.Arcade;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rand = n => Math.floor(Math.random() * n);
  A.esc = esc;
  A.pick = list => list[rand(list.length)];
  A.DEFAULT_ACCENT = "#f3d36b";
  A.HOME_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 L12 4 L21 11.5 M6 10 V20 H18 V10 M10 20 v-5 h4 v5"/></svg>`;
  A.MAX_NAME = 14;

  /* ---------- Settings ---------- */
  A.settings = Object.assign({ sound: false, vibrate: true, readAloud: true, theme: "classic" }, A.store.get("settings", {}));
  A.saveSettings = () => A.store.set("settings", A.settings);

  /* ---------- Players ---------- */
  A.players = {
    all: () => A.store.get("players", []),
    get: id => A.players.all().find(p => p.id === id) || null,
    save(player) {
      const list = A.players.all();
      const i = list.findIndex(p => p.id === player.id);
      if (i >= 0) list[i] = player; else list.push(player);
      A.store.set("players", list);
    },
    remove(id) {
      A.store.set("players", A.players.all().filter(p => p.id !== id));
      if (A.store.get("lastPlayer", null) === id) A.store.remove("lastPlayer");
      if (A.session.player && A.session.player.id === id) { A.session.player = null; A.session.chosen = false; }
      for (const g of A.games) if (g.forgetPlayer) g.forgetPlayer(id);
    }
  };
  A.lastPlayerId = () => A.store.get("lastPlayer", null);
  // Who is playing single-player games during this visit (asked once per launch).
  A.session = { player: null, chosen: false };
  A.GUEST = { id: null, name: "Guest", avatar: null, guest: true };

  /* ---------- Sound & vibration ---------- */
  let audio = null;
  function tones(notes, type) {
    if (!A.settings.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
      let t = audio.currentTime;
      for (const [freq, dur] of notes) {
        const osc = audio.createOscillator(), gain = audio.createGain();
        osc.type = type || "triangle";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.18, t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain).connect(audio.destination);
        osc.start(t); osc.stop(t + dur + 0.02);
        t += dur * 0.8;
      }
    } catch (e) { /* audio unavailable */ }
  }
  A.sfx = {
    right: () => tones([[660, .09], [880, .12]]),
    wrong: () => tones([[196, .22]], "square"),
    win: () => tones([[523, .12], [659, .12], [784, .12], [1047, .3]]),
    lose: () => tones([[392, .2], [330, .2], [262, .4]])
  };
  A.buzz = function () {
    if (!A.settings.vibrate || !navigator.vibrate) return;
    try { navigator.vibrate(70); } catch (e) { /* unsupported */ }
  };

  /* ---------- Screens, dialog, toast ---------- */
  A.currentScreen = null;
  A.show = function (id) {
    document.querySelectorAll(".screen").forEach(s => { s.hidden = s.id !== id; });
    A.currentScreen = id;
    $(id).scrollTop = 0;
  };
  A.setAccent = color => document.documentElement.style.setProperty("--accent", color || A.DEFAULT_ACCENT);

  // Screens can ask before the Home button leaves them (e.g. a game in progress): screenId -> async () => bool
  A.homeGuards = {};
  A.goHome = function () {
    A.setAccent(A.DEFAULT_ACCENT);
    renderHome();
    A.show("scr-home");
  };
  document.addEventListener("click", async e => {
    const btn = e.target.closest("[data-home]");
    if (!btn) return;
    const guard = A.homeGuards[A.currentScreen];
    if (guard && !(await guard())) return;
    A.goHome();
  });

  let dialogResolve = null;
  A.confirm = function (text, yesLabel) {
    $("dialog-text").textContent = text;
    $("dialog-yes").textContent = yesLabel;
    $("dialog").hidden = false;
    $("dialog-no").focus();
    return new Promise(resolve => { dialogResolve = resolve; });
  };
  function closeDialog(answer) {
    $("dialog").hidden = true;
    if (dialogResolve) { dialogResolve(answer); dialogResolve = null; }
  }
  A.dialogOpen = () => !$("dialog").hidden;
  $("dialog-yes").addEventListener("click", () => closeDialog(true));
  $("dialog-no").addEventListener("click", () => closeDialog(false));
  $("dialog").addEventListener("click", e => { if (e.target === $("dialog")) closeDialog(false); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && A.dialogOpen()) closeDialog(false); });

  let toastTimer = 0;
  A.toast = function (text) {
    const t = $("toast");
    t.textContent = text;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 1500);
  };

  /* ---------- Themes ---------- */
  let svgCount = 0;
  A.themeSvg = function (theme, view, outcome) {
    const id = "chalk" + (++svgCount);
    return `<svg class="th" viewBox="0 0 240 220" style="--accent:${theme.accent}" focusable="false">
      <defs><filter id="${id}" filterUnits="userSpaceOnUse" x="-20" y="-20" width="280" height="260">
        <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="4" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4"/></filter></defs>
      <g filter="url(#${id})">${theme.render(view, outcome)}</g></svg>`;
  };
  let lastThemeId = A.store.get("lastTheme", null);
  // "random" picks a different theme from last game's; any other choice is used as is.
  A.resolveTheme = function (choice) {
    if (choice !== "random" && A.themes.some(t => t.id === choice)) return choice;
    const ids = A.themes.map(t => t.id).filter(id => id !== lastThemeId);
    return A.pick(ids.length ? ids : A.themes.map(t => t.id));
  };
  A.noteThemeUsed = id => { lastThemeId = id; A.store.set("lastTheme", id); };
  A.themeAccent = choice => (choice === "random" ? A.DEFAULT_ACCENT : A.getTheme(choice).accent);
  A.themeName = choice => (choice === "random" ? "Random" : A.getTheme(choice).name);

  A.buildThemePicker = function (container, selected, onPick) {
    container.innerHTML = "";
    const options = A.themes.map(t => ({ id: t.id, name: t.name, theme: t })).concat([{ id: "random", name: "Random" }]);
    for (const o of options) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "theme-card";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(o.id === selected));
      if (o.theme) {
        b.style.setProperty("--card-accent", o.theme.accent);
        b.innerHTML = A.themeSvg(o.theme, A.themeView(o.theme, 4, 8), null) + `<span>${esc(o.name)}</span>`;
      } else {
        b.innerHTML = `<span class="dice" aria-hidden="true">?</span><span>Random</span>`;
      }
      b.addEventListener("click", () => {
        container.querySelectorAll(".theme-card").forEach(c => c.setAttribute("aria-checked", String(c === b)));
        onPick(o.id);
      });
      container.appendChild(b);
    }
  };

  /* ---------- Games ---------- */
  A.games = [];
  let loadingFolder = null;
  A.registerGame = function (def) {
    def.folder = loadingFolder;
    A.games.push(def);
  };
  A.getGame = id => A.games.find(g => g.id === id);

  function loadFile(src) {
    return new Promise((resolve, reject) => {
      const el = src.endsWith(".css") ? document.createElement("link") : document.createElement("script");
      if (src.endsWith(".css")) { el.rel = "stylesheet"; el.href = src; } else { el.src = src; }
      el.onload = resolve;
      el.onerror = () => reject(new Error("Couldn't load " + src));
      document.head.appendChild(el);
    });
  }
  async function loadGames() {
    for (const entry of A.GAME_LIST) {
      loadingFolder = entry.folder;
      try {
        for (const f of entry.files) {
          if (/\.(js|css)$/.test(f)) await loadFile(`games/${entry.folder}/${f}`);
        }
      } catch (e) { console.error(e); }
    }
    loadingFolder = null;
  }

  /* ---------- Home ---------- */
  function renderHome() {
    const box = $("tiles");
    box.innerHTML = "";
    const lastId = A.lastPlayerId();
    for (const g of A.games) {
      const b = document.createElement("button");
      b.className = "tile" + (g.comingSoon ? " soon" : "");
      b.style.setProperty("--tile", g.accent);
      const stat = g.comingSoon ? "Coming soon" : (g.tileStat && lastId ? g.tileStat(lastId) : null) || "Tap to play";
      // Optional badge (the action games' "Daily twist").
      const badge = !g.comingSoon && g.badge ? g.badge() : null;
      b.innerHTML = `${badge ? `<span class="tile-badge">${esc(badge)}</span>` : ""}<svg class="tile-icon" viewBox="0 0 48 48" aria-hidden="true">${g.icon}</svg>
        <span class="tile-name">${esc(g.name)}</span><span class="tile-stat">${esc(stat)}</span>`;
      b.setAttribute("aria-label", `${g.name}. ${badge ? badge + ". " : ""}${stat}`);
      b.addEventListener("click", () => {
        if (g.comingSoon) { A.toast(`${g.name} is coming soon!`); return; }
        A.setAccent(g.accent);
        g.open();
      });
      box.appendChild(b);
    }
  }
  $("btn-players").addEventListener("click", showPlayers);
  $("btn-settings").addEventListener("click", showSettings);

  /* ---------- Players screens ---------- */
  function showPlayers() {
    const box = $("player-list");
    const list = A.players.all();
    box.innerHTML = list.length ? "" : `<p class="note">No players yet. Add one for each kid so everyone gets their own stats.</p>`;
    for (const p of list) {
      const b = document.createElement("button");
      b.className = "player-item";
      b.innerHTML = `${A.avatarSvg(p)}<span>${esc(p.name)}</span><span class="edit">Edit</span>`;
      b.addEventListener("click", () => editPlayer({ player: p, onDone: showPlayers }));
      box.appendChild(b);
    }
    A.show("scr-players");
  }
  $("btn-add-player").addEventListener("click", () => editPlayer({ onDone: showPlayers }));

  // Add or edit a player. onDone(player or null) runs after saving, deleting or going back.
  let editing = null;
  function editPlayer({ player, note, onDone }) {
    editing = { player: player ? Object.assign({}, player) : { id: A.newId(), name: "", avatar: null }, isNew: !player, onDone };
    $("edit-title").textContent = player && !player.needsName ? "Edit player" : "New player";
    $("edit-note").textContent = note || "";
    $("edit-note").hidden = !note;
    $("edit-name").value = player && !player.needsName ? player.name : "";
    $("edit-name").placeholder = player && player.needsName ? player.name : "Name";
    $("edit-err").textContent = "";
    $("btn-delete-player").hidden = editing.isNew || !!(player && player.needsName);
    if (!editing.player.avatar || editing.isNew) {
      const used = A.players.all().map(p => p.avatar);
      editing.player.avatar = editing.player.avatar || A.AVATAR_IDS.find(a => !used.includes(a)) || A.AVATAR_IDS[0];
    }
    const grid = $("avatar-grid");
    grid.innerHTML = "";
    for (const id of A.AVATAR_IDS) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "avatar-pick";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-label", A.AVATARS[id].name);
      b.setAttribute("aria-checked", String(id === editing.player.avatar));
      b.innerHTML = A.avatarSvg({ avatar: id });
      b.addEventListener("click", () => {
        editing.player.avatar = id;
        grid.querySelectorAll(".avatar-pick").forEach(x => x.setAttribute("aria-checked", String(x === b)));
      });
      grid.appendChild(b);
    }
    A.show("scr-player-edit");
  }
  A.editPlayer = editPlayer;
  $("edit-name").addEventListener("input", () => { $("edit-err").textContent = ""; });
  $("edit-name").addEventListener("keydown", e => { if (e.key === "Enter") $("btn-save-player").click(); });
  $("btn-save-player").addEventListener("click", () => {
    const p = editing.player;
    const name = $("edit-name").value.trim().replace(/\s+/g, " ").slice(0, A.MAX_NAME) || (p.needsName ? p.name : "");
    if (!name) { $("edit-err").textContent = "Type a name first."; $("edit-name").focus(); return; }
    if (A.players.all().some(o => o.id !== p.id && o.name.toLowerCase() === name.toLowerCase())) {
      $("edit-err").textContent = "Someone already has that name."; return;
    }
    p.name = name;
    delete p.needsName;
    A.players.save(p);
    $("edit-name").blur();
    editing.onDone(p);
  });
  $("btn-edit-back").addEventListener("click", () => {
    const p = editing.player;
    if (p.needsName) { delete p.needsName; A.players.save(p); }
    editing.onDone(editing.isNew ? null : A.players.get(p.id));
  });
  $("btn-delete-player").addEventListener("click", async () => {
    const p = editing.player;
    if (!(await A.confirm(`Remove ${p.name}? Their stats will be deleted too.`, "Remove"))) return;
    A.players.remove(p.id);
    editing.onDone(null);
  });

  /* ---------- Who's playing? (single-player games) ---------- */
  // Calls onDone(player) once someone is chosen; asks only once per launch unless force is set.
  A.whoIsPlaying = function ({ onDone, onBack, backLabel, force }) {
    if (A.session.chosen && !force) { onDone(A.session.player); return; }
    const box = $("who-grid");
    box.innerHTML = "";
    const lastId = A.lastPlayerId();
    const choose = player => {
      A.session.player = player;
      A.session.chosen = true;
      if (player.id) A.store.set("lastPlayer", player.id);
      onDone(player);
    };
    const card = (player, label, extraCls, run) => {
      const b = document.createElement("button");
      b.className = "who-card" + (extraCls ? " " + extraCls : "");
      b.innerHTML = (player ? A.avatarSvg(player) : `<span class="plus" aria-hidden="true">+</span>`) + `<span>${esc(label)}</span>`;
      if (player && player.id && player.id === lastId) b.setAttribute("aria-current", "true");
      b.addEventListener("click", run);
      box.appendChild(b);
    };
    for (const p of A.players.all()) card(p, p.name, "", () => choose(p));
    card(A.GUEST, "Guest", "guest", () => choose(A.GUEST));
    card(null, "New player", "new", () => editPlayer({
      onDone: p => (p ? choose(p) : A.whoIsPlaying({ onDone, onBack, backLabel, force: true }))
    }));
    $("who-back").textContent = "‹ " + (backLabel || "Back");
    whoBack = onBack;
    $("who-note").textContent = A.players.all().length ? "Tap your picture." : "Add a player so your stats are saved, or play as a guest.";
    A.show("scr-who");
  };
  let whoBack = null;
  $("who-back").addEventListener("click", () => whoBack && whoBack());

  /* ---------- Settings ---------- */
  function showSettings() {
    $("set-sound").checked = A.settings.sound;
    $("set-vibrate").checked = A.settings.vibrate;
    $("set-read").checked = A.settings.readAloud;
    $("reset-note").textContent = "";
    A.buildThemePicker($("settings-themes"), A.settings.theme, id => { A.settings.theme = id; A.saveSettings(); });
    A.show("scr-settings");
  }
  $("set-sound").addEventListener("change", e => { A.settings.sound = e.target.checked; A.saveSettings(); if (A.settings.sound) A.sfx.right(); });
  $("set-vibrate").addEventListener("change", e => { A.settings.vibrate = e.target.checked; A.saveSettings(); A.buzz(); });
  $("set-read").addEventListener("change", e => { A.settings.readAloud = e.target.checked; A.saveSettings(); });
  $("btn-reset-stats").addEventListener("click", async () => {
    if (!(await A.confirm("Reset stats for every player in every game?", "Reset"))) return;
    for (const g of A.games) if (g.resetStats) g.resetStats();
    $("reset-note").textContent = "Stats reset.";
  });

  /* ---------- Pass the phone ---------- */
  // opts: { player: {name, avatar}, small, note, onReady, onHome (async () => bool, optional) }
  let passReady = null;
  A.pass = function ({ player, small, note, onReady, onHome }) {
    $("pass-avatar").innerHTML = A.avatarSvg(player, "big");
    $("pass-small").textContent = small || "";
    $("pass-name").textContent = player.name;
    $("pass-note").textContent = note || "";
    passReady = onReady;
    if (onHome) A.homeGuards["scr-pass"] = onHome; else delete A.homeGuards["scr-pass"];
    A.show("scr-pass");
    $("pass-ready").focus({ preventScroll: true });
  };
  $("pass-ready").addEventListener("click", () => passReady && passReady());

  /* ---------- Player picker for multiplayer setup screens ---------- */
  /* Tap players from the shared list (in play order) or add a one-off guest name.
     initial: [{ id } | { guest: "Name" }]. Returns { get() -> [{ name, avatar, id|null }], entries() }. */
  A.playerPicker = function (container, { min, max, initial, onChange }) {
    let chosen = (initial || []).filter(e => e.guest || A.players.get(e.id)).slice(0, max);
    const resolve = e => (e.guest ? { id: null, name: e.guest, avatar: null } : A.players.get(e.id));
    function render() {
      const all = A.players.all();
      const free = all.filter(p => !chosen.some(e => e.id === p.id));
      container.innerHTML = `
        <ol class="pp-chosen">${chosen.map((e, i) => {
          const p = resolve(e);
          return `<li>${A.avatarSvg(p)}<span>${esc(p.name)}</span>
            <button class="icon-btn" type="button" data-rm="${i}" aria-label="Remove ${esc(p.name)}">&times;</button></li>`;
        }).join("")}</ol>
        <p class="note pp-count">${chosen.length < min ? `Pick at least ${min} players.` : `${chosen.length} players`}${chosen.length >= max ? " (that's the most)" : ""}</p>
        ${free.length && chosen.length < max ? `<p class="label">Tap to add</p><div class="pp-free">${free.map(p =>
          `<button class="who-card small" type="button" data-add="${p.id}">${A.avatarSvg(p)}<span>${esc(p.name)}</span></button>`).join("")}</div>` : ""}
        ${chosen.length < max ? `<div class="pp-guest"><input type="text" maxlength="${A.MAX_NAME}" placeholder="Guest name" aria-label="Guest name" autocomplete="off">
          <button class="btn ghost" type="button" data-guest>Add guest</button></div>` : ""}`;
      container.querySelectorAll("[data-rm]").forEach(b => b.addEventListener("click", () => { chosen.splice(+b.dataset.rm, 1); changed(); }));
      container.querySelectorAll("[data-add]").forEach(b => b.addEventListener("click", () => { chosen.push({ id: b.dataset.add }); changed(); }));
      const input = container.querySelector(".pp-guest input");
      const addGuest = () => {
        const name = input.value.trim().replace(/\s+/g, " ").slice(0, A.MAX_NAME);
        if (!name) { input.focus(); return; }
        const taken = chosen.map(resolve).some(p => p.name.toLowerCase() === name.toLowerCase());
        chosen.push({ guest: taken ? `${name} 2` : name });
        changed();
      };
      if (input) {
        container.querySelector("[data-guest]").addEventListener("click", addGuest);
        input.addEventListener("keydown", e => { if (e.key === "Enter") addGuest(); });
      }
    }
    function changed() { render(); if (onChange) onChange(chosen.length); }
    render();
    return { get: () => chosen.map(resolve), entries: () => chosen.slice(), count: () => chosen.length };
  };

  /* ---------- Start ---------- */
  async function boot() {
    await loadGames();
    // Every Home button (shell's and games') gets the same house icon.
    document.querySelectorAll("[data-home]").forEach(b => { if (!b.innerHTML.trim()) b.innerHTML = A.HOME_ICON; });
    const start = () => {
      for (const g of A.games) if (g.autoResume && g.autoResume()) return;
      A.goHome();
    };
    const unnamed = A.players.all().find(p => p.needsName);
    if (unnamed) {
      editPlayer({
        player: unnamed,
        note: "Welcome to Jimmy's Arcade! Your Hangman stats were saved. Who do they belong to?",
        onDone: start
      });
    } else {
      start();
    }
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      // updateViaCache "none": check sw.js and the game list it imports without the HTTP cache.
      navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {});
    }
  }
  boot();
})();

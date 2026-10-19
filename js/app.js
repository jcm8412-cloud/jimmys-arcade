/* App controller: screens, settings, stats, single player and pass-and-play multiplayer. */
(function () {
  const $ = id => document.getElementById(id);
  const LETTERS = "abcdefghijklmnopqrstuvwxyz";
  const DEFAULT_ACCENT = "#f3d36b";
  const rand = n => Math.floor(Math.random() * n);
  const pick = list => list[rand(list.length)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const DIFFS = {
    easy: { name: "Easy", desc: "Common words, 8 misses, a free letter", misses: 8, freeLetter: true },
    medium: { name: "Medium", desc: "5–7 letter words", misses: 6 },
    hard: { name: "Hard", desc: "8+ letter words", misses: 6 },
    impossible: { name: "Impossible", desc: "Long words, no hint", misses: 6 }
  };
  const CHEERS = ["You got it!", "Awesome job!", "Super speller!", "Nailed it!", "Brain power!", "Hooray!"];
  const MP_MIN = 2, MP_MAX = 6;
  const MP_POINTS = { letter: 1, lastLetter: 3, stumped: 2 };

  /* ---------- Storage (all access wrapped; the game works without it) ---------- */
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ } },
    remove(key) { try { localStorage.removeItem(key); } catch (e) { /* storage unavailable */ } }
  };

  const settings = Object.assign({ sound: false, vibrate: true, theme: "classic" }, store.get("hm.settings", {}));
  const saveSettings = () => store.set("hm.settings", settings);

  const blankStats = () => ({ wins: 0, streak: 0, best: 0 });
  let stats = store.get("hm.stats", {});
  for (const d in DIFFS) stats[d] = Object.assign(blankStats(), stats[d]);
  const saveStats = () => store.set("hm.stats", stats);

  const lastWords = store.get("hm.lastWords", {});
  let lastThemeId = store.get("hm.lastTheme", null);

  /* ---------- Sound & vibration ---------- */
  let audio = null;
  function tones(notes, type) {
    if (!settings.sound) return;
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
  const sfx = {
    right: () => tones([[660, .09], [880, .12]]),
    wrong: () => tones([[196, .22]], "square"),
    win: () => tones([[523, .12], [659, .12], [784, .12], [1047, .3]]),
    lose: () => tones([[392, .2], [330, .2], [262, .4]])
  };
  function buzz() {
    if (!settings.vibrate || !navigator.vibrate) return;
    try { navigator.vibrate(70); } catch (e) { /* unsupported */ }
  }

  /* ---------- Themes ---------- */
  let svgCount = 0;
  function themeSvg(theme, view, outcome) {
    const id = "chalk" + (++svgCount);
    return `<svg class="th" viewBox="0 0 240 220" style="--accent:${theme.accent}" focusable="false">
      <defs><filter id="${id}" filterUnits="userSpaceOnUse" x="-20" y="-20" width="280" height="260">
        <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="4" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4"/></filter></defs>
      <g filter="url(#${id})">${theme.render(view, outcome)}</g></svg>`;
  }
  function resolveTheme(choice) {
    if (choice !== "random" && HM.themes.some(t => t.id === choice)) return choice;
    const ids = HM.themes.map(t => t.id).filter(id => id !== lastThemeId);
    return pick(ids.length ? ids : HM.themes.map(t => t.id));
  }
  function noteThemeUsed(id) { lastThemeId = id; store.set("hm.lastTheme", id); }
  function setAccent(color) { document.documentElement.style.setProperty("--accent", color || DEFAULT_ACCENT); }
  const accentFor = choice => (choice === "random" ? DEFAULT_ACCENT : HM.getTheme(choice).accent);
  const themeName = choice => (choice === "random" ? "Random" : HM.getTheme(choice).name);

  function buildThemePicker(container, selected, onPick) {
    container.innerHTML = "";
    const options = HM.themes.map(t => ({ id: t.id, name: t.name, theme: t })).concat([{ id: "random", name: "Random" }]);
    for (const o of options) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "theme-card";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(o.id === selected));
      if (o.theme) {
        b.style.setProperty("--card-accent", o.theme.accent);
        b.innerHTML = themeSvg(o.theme, HM.themeView(o.theme, 4, 8), null) + `<span>${esc(o.name)}</span>`;
      } else {
        b.innerHTML = `<span class="dice" aria-hidden="true">?</span><span>Random</span>`;
      }
      b.addEventListener("click", () => {
        container.querySelectorAll(".theme-card").forEach(c => c.setAttribute("aria-checked", String(c === b)));
        onPick(o.id);
      });
      container.appendChild(b);
    }
  }

  /* ---------- Screens, dialog, toast ---------- */
  let currentScreen = null;
  function show(id) {
    document.querySelectorAll(".screen").forEach(s => { s.hidden = s.id !== id; });
    currentScreen = id;
    const scr = $(id);
    scr.scrollTop = 0;
  }

  let dialogResolve = null;
  function confirmBox(text, yesLabel) {
    $("dialog-text").textContent = text;
    $("dialog-yes").textContent = yesLabel;
    $("dialog").hidden = false;
    $("dialog-no").focus();
    return new Promise(resolve => { dialogResolve = resolve; });
  }
  function closeDialog(answer) {
    $("dialog").hidden = true;
    if (dialogResolve) { dialogResolve(answer); dialogResolve = null; }
  }
  $("dialog-yes").addEventListener("click", () => closeDialog(true));
  $("dialog-no").addEventListener("click", () => closeDialog(false));
  $("dialog").addEventListener("click", e => { if (e.target === $("dialog")) closeDialog(false); });

  let toastTimer = 0;
  function toast(text) {
    const t = $("toast");
    t.textContent = text;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 1400);
  }

  /* ---------- Main menu ---------- */
  function showMenu() {
    setAccent(accentFor(settings.theme));
    $("resume-card").hidden = !mpInProgress();
    show("scr-menu");
  }
  buildThemePicker($("menu-themes"), settings.theme, id => {
    settings.theme = id; saveSettings(); setAccent(accentFor(id));
  });
  document.querySelectorAll("[data-back]").forEach(b => b.addEventListener("click", showMenu));
  $("btn-howto").addEventListener("click", () => show("scr-howto"));
  $("btn-settings").addEventListener("click", () => {
    $("set-sound").checked = settings.sound;
    $("set-vibrate").checked = settings.vibrate;
    $("reset-note").textContent = "";
    show("scr-settings");
  });
  $("btn-single").addEventListener("click", showDifficulty);
  $("btn-multi").addEventListener("click", showMpSetup);
  $("btn-resume").addEventListener("click", resumeMp);
  $("btn-discard").addEventListener("click", async () => {
    if (await confirmBox("Quit the game in progress? Scores will be lost.", "Quit game")) { clearMp(); showMenu(); }
  });

  /* ---------- Settings ---------- */
  $("set-sound").addEventListener("change", e => { settings.sound = e.target.checked; saveSettings(); if (settings.sound) sfx.right(); });
  $("set-vibrate").addEventListener("change", e => { settings.vibrate = e.target.checked; saveSettings(); buzz(); });
  $("btn-reset-stats").addEventListener("click", async () => {
    if (!(await confirmBox("Reset wins and streaks for every level?", "Reset"))) return;
    for (const d in DIFFS) stats[d] = blankStats();
    saveStats();
    $("reset-note").textContent = "Stats reset.";
  });

  /* ---------- Single player ---------- */
  function showDifficulty() {
    const box = $("levels");
    box.innerHTML = "";
    for (const [id, d] of Object.entries(DIFFS)) {
      const s = stats[id];
      const b = document.createElement("button");
      b.className = "level" + (id === "impossible" ? " impossible" : "");
      b.innerHTML = `<b>${d.name}</b><small>${d.desc}</small>
        <span class="stats" aria-hidden="true"><span>${s.wins}</span><span>${s.streak}</span><span>${s.best}</span><i>wins</i><i>streak</i><i>best</i></span>`;
      b.setAttribute("aria-label", `${d.name}: ${d.desc}. Wins ${s.wins}, streak ${s.streak}, best ${s.best}.`);
      b.addEventListener("click", () => startSingle(id));
      box.appendChild(b);
    }
    $("diff-theme").textContent = themeName(settings.theme);
    setAccent(accentFor(settings.theme));
    show("scr-difficulty");
  }

  function pickWord(diff) {
    const cats = HM.WORDS[diff];
    const names = Object.keys(cats);
    let word, category, tries = 0;
    do {
      category = pick(names);
      word = pick(cats[category]);
    } while (word === lastWords[diff] && ++tries < 50);
    lastWords[diff] = word;
    store.set("hm.lastWords", lastWords);
    return { word, category };
  }

  function startSingle(diff) {
    let game, hint;
    if (diff === "impossible") {
      const lengths = Object.keys(HM.IMPOSSIBLE_WORDS);
      let len = pick(lengths);
      // Avoid starting at the same length as last time so it feels fresh.
      if (lengths.length > 1 && String(len) === String(lastWords.impossibleLen)) len = pick(lengths.filter(l => l !== String(len)));
      lastWords.impossibleLen = len;
      store.set("hm.lastWords", lastWords);
      game = HM.Engine.newEvil(HM.IMPOSSIBLE_WORDS[len], DIFFS.impossible.misses);
      hint = null;
    } else {
      const w = pickWord(diff);
      game = HM.Engine.newFixed(w.word, DIFFS[diff].misses);
      const free = DIFFS[diff].freeLetter ? HM.Engine.revealRandom(game) : null;
      if (free) setTimeout(() => toast(`Here's a free letter: ${free.toUpperCase()}`), 300);
      hint = w.category;
    }
    const themeId = resolveTheme(settings.theme);
    noteThemeUsed(themeId);
    G = { mode: "sp", diff, game, hint, themeId, title: DIFFS[diff].name };
    openGame();
  }

  function finishSingle(r) {
    const s = stats[G.diff];
    if (r.won) { s.wins++; s.streak++; s.best = Math.max(s.best, s.streak); }
    else s.streak = 0;
    saveStats();
    const word = G.game.word;
    if (G.diff === "impossible" && G.game.mode === "evil" && r.won) lastWords.impossible = word;
    showResult({
      win: r.won,
      banner: r.won ? pick(CHEERS) : (G.diff === "impossible" ? "Gotcha! Tricky one." : "So close!"),
      reveal: r.won ? `Streak: ${s.streak}${s.streak === s.best && s.best > 1 ? " — a new best!" : ""}` : `The word was <b>${esc(word)}</b>`,
      actions: [
        { label: "Next word", primary: true, run: () => startSingle(G.diff) },
        { label: "Menu", run: showMenu }
      ]
    });
  }

  /* ---------- Game screen (both modes) ---------- */
  let G = null;          // current game context
  let drawnKey = "";     // avoids re-rendering (and replaying) the drawing when nothing changed
  let resultActions = [];

  const keyButtons = {};
  for (const ch of LETTERS) {
    const b = document.createElement("button");
    b.className = "key";
    b.textContent = ch.toUpperCase();
    b.setAttribute("aria-label", ch.toUpperCase());
    b.addEventListener("click", () => onGuess(ch));
    $("keys").appendChild(b);
    keyButtons[ch] = b;
  }

  function openGame() {
    drawnKey = "";
    setAccent(HM.getTheme(G.themeId).accent);
    $("result").hidden = true;
    $("keys").hidden = false;
    show("scr-game");
    renderGame();
    if (G.game.over) restoreResult();
  }

  function renderGame(popLetter) {
    const g = G.game;
    const theme = HM.getTheme(G.themeId);
    $("game-title").textContent = G.title;

    // Hearts
    const left = g.maxMisses - g.wrong.length;
    $("hearts").innerHTML = "♥".repeat(Math.max(0, left)) + `<span class="gone">${"♥".repeat(g.wrong.length)}</span>`;
    $("hearts").setAttribute("aria-label", `${left} guesses left`);

    // Drawing
    const view = HM.themeView(theme, g.wrong.length, g.maxMisses);
    const outcome = g.over ? (g.won ? "win" : "lose") : null;
    const key = `${G.themeId}|${view.done.length}|${outcome}`;
    if (key !== drawnKey) {
      $("drawing").innerHTML = themeSvg(theme, view, outcome);
      drawnKey = key;
    }

    // Hint
    if (G.mode === "sp") {
      $("hint").innerHTML = G.hint ? `Hint: <b>${esc(G.hint)}</b>` : `No hints here! ${g.revealed.length} letters.`;
    } else {
      $("hint").innerHTML = G.hint ? `Hint: <b>${esc(G.hint)}</b>` : "";
    }

    renderWord(popLetter);

    // Keys
    for (const ch of LETTERS) {
      const b = keyButtons[ch];
      const used = g.guessed.includes(ch);
      b.disabled = used || g.over;
      b.className = "key" + (used ? (g.wrong.includes(ch) ? " wrong" : " right") : "");
    }

    // Whose turn (multiplayer)
    $("turn").textContent = G.mode === "mp" && !g.over ? `${mpCurrentGuesser().name}'s turn` : "";
  }

  function renderWord(popLetter) {
    const g = G.game;
    const groups = [[]];
    for (let i = 0; i < g.revealed.length; i++) {
      if (g.mode === "fixed" && g.word[i] === " ") groups.push([]);
      else groups[groups.length - 1].push(i);
    }
    const el = $("word");
    el.innerHTML = groups.map(idx => `<span class="w">${idx.map(i => {
      const ch = g.revealed[i];
      if (ch) return `<span class="slot${ch === popLetter ? " pop" : ""}">${ch}</span>`;
      if (g.over && g.word) return `<span class="slot missed">${g.word[i]}</span>`;
      return `<span class="slot"></span>`;
    }).join("")}</span>`).join("");
    el.setAttribute("aria-label", groups.map(idx => idx.map(i => g.revealed[i] || "blank").join(" ")).join(", "));
    sizeSlots();
  }

  function sizeSlots() {
    if (!G) return;
    const el = $("word");
    const lengths = [...el.querySelectorAll(".w")].map(w => w.children.length);
    const width = (el.clientWidth || 320) - 4;
    const WORD_GAP = 18; // px between words, matches .word gap
    // Prefer one line for the whole phrase; if that makes letters too small, size by the longest word and wrap.
    const total = lengths.reduce((a, b) => a + b, 0);
    const oneLine = (width - WORD_GAP * (lengths.length - 1)) / (total + 0.14 * (total - lengths.length));
    const longest = Math.max(1, ...lengths);
    const wrapped = width / (longest + 0.14 * (longest - 1));
    const slot = Math.floor(oneLine >= 28 ? oneLine : wrapped);
    el.style.setProperty("--slot", Math.max(14, Math.min(46, slot)) + "px");
  }
  window.addEventListener("resize", sizeSlots);

  function onGuess(ch) {
    if (!G || currentScreen !== "scr-game" || !$("dialog").hidden) return;
    const guesser = G.mode === "mp" ? mpCurrentGuesser() : null;
    const r = HM.Engine.guess(G.game, ch);
    if (!r) return;
    if (r.correct) sfx.right(); else { sfx.wrong(); buzz(); }
    if (G.mode === "mp") mpAfterGuess(r, guesser);
    renderGame(r.correct ? ch : null);
    if (r.won || r.lost) {
      setTimeout(() => (r.won ? sfx.win() : sfx.lose()), 250);
      if (G.mode === "sp") finishSingle(r); else mpRoundOver();
    }
  }

  function showResult({ win, banner, reveal, actions }) {
    $("keys").hidden = true;
    $("result").hidden = false;
    $("banner").textContent = banner;
    $("banner").className = "banner " + (win ? "win" : "lose");
    $("reveal").innerHTML = reveal || "";
    resultActions = actions;
    const box = $("result-actions");
    box.innerHTML = "";
    actions.forEach(a => {
      const b = document.createElement("button");
      b.className = "btn" + (a.primary ? "" : " ghost");
      b.textContent = a.label;
      b.addEventListener("click", a.run);
      box.appendChild(b);
    });
  }
  function restoreResult() { if (G.mode === "mp") mpRoundOver(); }

  $("btn-game-menu").addEventListener("click", async () => {
    if (G && G.mode === "mp") return leaveMp();
    showMenu();
  });

  document.addEventListener("keydown", e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!$("dialog").hidden) { if (e.key === "Escape") closeDialog(false); return; }
    if (currentScreen !== "scr-game" || !G) return;
    if (e.target.tagName === "INPUT") return;
    if (/^[a-zA-Z]$/.test(e.key)) { e.preventDefault(); onGuess(e.key.toLowerCase()); }
    else if (e.key === "Enter" && G.game.over && resultActions.length && !e.target.closest("button")) {
      e.preventDefault(); resultActions[0].run();
    }
  });

  /* ---------- Multiplayer ---------- */
  let mp = store.get("hm.mp", null);
  const saveMp = () => store.set("hm.mp", mp);
  function clearMp() { mp = null; store.remove("hm.mp"); }
  const mpInProgress = () => !!(mp && mp.phase && mp.phase !== "final");

  // Setup screen
  let setupNames = store.get("hm.lastPlayers", ["", "", ""]);
  if (!Array.isArray(setupNames) || setupNames.length < MP_MIN) setupNames = ["", "", ""];
  let setupRounds = null; // null = follow the number of players

  function showMpSetup() {
    setAccent(accentFor(settings.theme));
    renderSetup();
    show("scr-mp-setup");
  }
  function renderSetup() {
    const box = $("mp-players");
    box.innerHTML = "";
    setupNames.forEach((name, i) => {
      const row = document.createElement("div");
      row.className = "player-row";
      row.innerHTML = `<span class="num">${i + 1}</span>
        <input type="text" maxlength="14" autocomplete="off" autocapitalize="words" placeholder="Player ${i + 1}" aria-label="Player ${i + 1} name">
        <button class="icon-btn" type="button" aria-label="Remove player ${i + 1}">&times;</button>`;
      const input = row.querySelector("input");
      input.value = name;
      input.addEventListener("input", () => { setupNames[i] = input.value; });
      input.addEventListener("keydown", e => {
        if (e.key === "Enter") { const next = box.querySelectorAll("input")[i + 1]; if (next) next.focus(); else input.blur(); }
      });
      const rm = row.querySelector("button");
      rm.hidden = setupNames.length <= MP_MIN;
      rm.addEventListener("click", () => { setupNames.splice(i, 1); renderSetup(); });
      box.appendChild(row);
    });
    $("mp-add").hidden = setupNames.length >= MP_MAX;
    const rounds = setupRounds || setupNames.length;
    $("mp-rounds").textContent = rounds;
    $("mp-rounds-note").textContent = rounds === setupNames.length
      ? "Everyone is the Word Master once."
      : rounds % setupNames.length === 0
        ? `Everyone is the Word Master ${rounds / setupNames.length} times.`
        : "The Word Master changes every round.";
  }
  $("mp-add").addEventListener("click", () => {
    if (setupNames.length >= MP_MAX) return;
    setupNames.push("");
    renderSetup();
    const inputs = $("mp-players").querySelectorAll("input");
    inputs[inputs.length - 1].focus();
  });
  $("mp-rounds-minus").addEventListener("click", () => { setupRounds = Math.max(1, (setupRounds || setupNames.length) - 1); renderSetup(); });
  $("mp-rounds-plus").addEventListener("click", () => { setupRounds = Math.min(18, (setupRounds || setupNames.length) + 1); renderSetup(); });

  $("mp-start").addEventListener("click", async () => {
    if (mpInProgress() && !(await confirmBox("Start a new game? The game in progress will be lost.", "Start new"))) return;
    const names = setupNames.map((n, i) => n.trim().replace(/\s+/g, " ") || `Player ${i + 1}`);
    // Make duplicate names distinguishable.
    const seen = {};
    const unique = names.map(n => { seen[n] = (seen[n] || 0) + 1; return seen[n] > 1 ? `${n} ${seen[n]}` : n; });
    store.set("hm.lastPlayers", setupNames);
    newMpGame(unique.map(name => ({ name, score: 0 })), setupRounds || unique.length);
  });

  function newMpGame(players, rounds) {
    mp = { players, rounds, round: 0, phase: "pass", themeChoice: settings.theme, r: null };
    saveMp();
    mpGo();
  }

  const mpWordMaster = () => mp.players[mp.round % mp.players.length];
  function mpGuesserOrder() {
    const n = mp.players.length, wm = mp.round % n, order = [];
    for (let k = 1; k < n; k++) order.push((wm + k) % n);
    return order;
  }
  function mpCurrentGuesser() {
    const order = mpGuesserOrder();
    return mp.players[order[mp.r.turn % order.length]];
  }

  // Route to the screen for the saved phase (also used to resume after the app was closed).
  function mpGo() {
    const themeAccent = mp.r && mp.r.themeId ? HM.getTheme(mp.r.themeId).accent : accentFor(mp.themeChoice);
    switch (mp.phase) {
      case "pass":
      case "word":
        mp.phase = "pass";
        setAccent(accentFor(mp.themeChoice));
        showPass({
          small: `Round ${mp.round + 1} of ${mp.rounds}`,
          big: `Pass the phone to ${mpWordMaster().name}`,
          note: `${mpWordMaster().name} is the Word Master. No peeking, everyone else!`,
          go: `I'm ${mpWordMaster().name}!`,
          run: showWordEntry
        });
        break;
      case "ready":
        setAccent(themeAccent);
        showPass({
          small: "Got it!",
          big: "Hide the word and pass to the guessers",
          note: "Guessers: " + mpGuesserOrder().map(i => mp.players[i].name).join(", "),
          go: "Start guessing",
          run: () => { mp.phase = "guess"; saveMp(); mpGo(); }
        });
        break;
      case "guess":
        G = {
          mode: "mp", game: mp.r.game, hint: mp.r.hint, themeId: mp.r.themeId,
          title: `Round ${mp.round + 1} of ${mp.rounds}`
        };
        openGame();
        break;
      case "roundEnd":
      case "final":
        setAccent(themeAccent);
        showScores();
        break;
    }
  }

  function showPass({ small, big, note, go, run }) {
    $("pass-small").textContent = small;
    $("pass-big").textContent = big;
    $("pass-note").textContent = note;
    $("pass-go").textContent = go;
    passRun = run;
    show("scr-pass");
  }
  let passRun = null;
  $("pass-go").addEventListener("click", () => passRun && passRun());
  $("pass-menu").addEventListener("click", leaveMp);

  async function leaveMp() {
    if (await confirmBox("Leave this game? You can resume it from the menu.", "Leave")) showMenu();
  }

  // Word Master enters the secret word
  let wordThemeChoice = "classic";
  function showWordEntry() {
    mp.phase = "word";
    saveMp();
    $("mp-word-title").textContent = `${mpWordMaster().name}'s secret word`;
    $("mp-secret").value = "";
    $("mp-secret").type = "password";
    $("mp-peek").setAttribute("aria-pressed", "false");
    $("mp-peek").setAttribute("aria-label", "Show word");
    $("mp-hint").value = "";
    $("mp-secret-err").textContent = "";
    wordThemeChoice = mp.themeChoice || "classic";
    buildThemePicker($("mp-themes"), wordThemeChoice, id => { wordThemeChoice = id; setAccent(accentFor(id)); });
    setAccent(accentFor(wordThemeChoice));
    show("scr-mp-word");
  }
  $("mp-peek").addEventListener("click", () => {
    const input = $("mp-secret");
    const showing = input.type === "password";
    input.type = showing ? "text" : "password";
    $("mp-peek").setAttribute("aria-pressed", String(showing));
    $("mp-peek").setAttribute("aria-label", showing ? "Hide word" : "Show word");
  });
  $("mp-secret").addEventListener("keydown", e => { if (e.key === "Enter") $("mp-hint").focus(); });
  $("mp-secret").addEventListener("input", () => { $("mp-secret-err").textContent = ""; });
  $("mp-hint").addEventListener("keydown", e => { if (e.key === "Enter") $("mp-word-done").click(); });
  $("mp-word-menu").addEventListener("click", leaveMp);

  $("mp-word-done").addEventListener("click", () => {
    const raw = $("mp-secret").value.toLowerCase().trim().replace(/\s+/g, " ");
    const letters = raw.replace(/ /g, "").length;
    let err = "";
    if (!raw) err = "Type a secret word first.";
    else if (!/^[a-z ]+$/.test(raw)) err = "Use letters and spaces only.";
    else if (letters < 2) err = "Use at least 2 letters.";
    else if (letters > 20) err = "Keep it to 20 letters or fewer.";
    $("mp-secret-err").textContent = err;
    if (err) { $("mp-secret").focus(); return; }

    mp.themeChoice = wordThemeChoice;
    const themeId = resolveTheme(wordThemeChoice);
    noteThemeUsed(themeId);
    mp.r = {
      word: raw,
      hint: $("mp-hint").value.trim().slice(0, 30),
      themeId,
      game: HM.Engine.newFixed(raw, 6),
      turn: 0,
      points: mp.players.map(() => 0)
    };
    mp.phase = "ready";
    $("mp-secret").value = "";
    $("mp-secret").blur();
    saveMp();
    mpGo();
  });

  function addPoints(player, pts) {
    const i = mp.players.indexOf(player);
    mp.players[i].score += pts;
    mp.r.points[i] += pts;
  }

  function mpAfterGuess(r, guesser) {
    if (r.correct) {
      const pts = MP_POINTS.letter + (r.won ? MP_POINTS.lastLetter : 0);
      addPoints(guesser, pts);
      toast(`+${pts} ${guesser.name}${r.won ? "!" : ""}`);
    }
    if (r.lost) addPoints(mpWordMaster(), MP_POINTS.stumped);
    if (!r.won && !r.lost) mp.r.turn++;
    else mp.r.lastGuesser = guesser.name;
    saveMp();
  }

  function mpRoundOver() {
    const g = mp.r.game;
    showResult({
      win: g.won,
      banner: g.won ? `${mp.r.lastGuesser || "The guessers"} got it!` : `${mpWordMaster().name} stumped everyone!`,
      reveal: g.won ? `The word was <b>${esc(g.word)}</b>` : `The word was <b>${esc(g.word)}</b> · +${MP_POINTS.stumped} for ${esc(mpWordMaster().name)}`,
      actions: [{
        label: "See scores", primary: true,
        run: () => { mp.phase = "roundEnd"; saveMp(); mpGo(); }
      }]
    });
  }

  function showScores() {
    const final = mp.phase === "final";
    const wmIndex = mp.round % mp.players.length;
    $("scores-title").textContent = final ? "Final scores" : `Round ${mp.round + 1} of ${mp.rounds}`;
    $("scores-word").innerHTML = final ? "" : `The word was <b>${esc(mp.r.word)}</b>`;
    $("scores-round-h").hidden = final;

    const top = Math.max(...mp.players.map(p => p.score));
    const rows = mp.players.map((p, i) => ({ p, i }));
    if (final) rows.sort((a, b) => b.p.score - a.p.score);
    $("scores-body").innerHTML = rows.map(({ p, i }) => `
      <tr class="${final && p.score === top ? "top" : ""}">
        <td>${esc(p.name)}${!final && i === wmIndex ? ' <span class="role">(Word Master)</span>' : ""}</td>
        ${final ? "" : `<td class="plus">${mp.r.points[i] ? "+" + mp.r.points[i] : "–"}</td>`}
        <td>${p.score}</td>
      </tr>`).join("");

    if (final) {
      const winners = mp.players.filter(p => p.score === top).map(p => p.name);
      $("scores-winner").textContent = winners.length === 1 ? `${winners[0]} wins!` : `It's a tie: ${winners.join(" & ")}!`;
    } else {
      $("scores-winner").textContent = "";
    }

    const box = $("scores-actions");
    box.innerHTML = "";
    const add = (label, cls, run) => {
      const b = document.createElement("button");
      b.className = "btn " + cls;
      b.textContent = label;
      b.addEventListener("click", run);
      box.appendChild(b);
    };
    if (final) {
      add("Play again (same players)", "big", () => {
        newMpGame(mp.players.map(p => ({ name: p.name, score: 0 })), mp.rounds);
      });
      add("Menu", "ghost", () => { clearMp(); showMenu(); });
    } else if (mp.round + 1 < mp.rounds) {
      const next = mp.players[(mp.round + 1) % mp.players.length].name;
      add(`Next round: pass to ${next}`, "big", () => { mp.round++; mp.r = null; mp.phase = "pass"; saveMp(); mpGo(); });
    } else {
      add("See final scores", "big", () => { mp.phase = "final"; saveMp(); mpGo(); });
    }
    show("scr-scores");
  }
  $("scores-menu").addEventListener("click", () => {
    if (mp && mp.phase === "final") { clearMp(); showMenu(); } else leaveMp();
  });

  function resumeMp() { if (mpInProgress()) mpGo(); }

  /* ---------- Start ---------- */
  if (mpInProgress()) { resumeMp(); toast("Game resumed"); }
  else { if (mp) clearMp(); showMenu(); }

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();

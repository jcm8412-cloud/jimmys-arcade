/* Hangman: single player (4 levels, stats per player) and pass-and-play multiplayer.
   Uses the arcade shell (Arcade.*) for players, settings, themes, sound, dialogs and the pass screen.
   Saved data: hangman:stats {playerId: {level: {wins, streak, best}}}, hangman:lastWords,
   hangman:mp (multiplayer game in progress), hangman:lastSetup (last multiplayer line-up). */
(function () {
  const A = window.Arcade;
  const $ = id => document.getElementById(id);
  const esc = A.esc, pick = A.pick;
  const LETTERS = "abcdefghijklmnopqrstuvwxyz";
  const ACCENT = "#f3d36b";

  const DIFFS = {
    easy: { name: "Easy", desc: "Common words, 8 misses, a free letter", misses: 8, freeLetter: true },
    medium: { name: "Medium", desc: "5–7 letter words", misses: 6 },
    hard: { name: "Hard", desc: "8+ letter words", misses: 6 },
    impossible: { name: "Impossible", desc: "Long words, no hint", misses: 6 }
  };
  const CHEERS = ["You got it!", "Awesome job!", "Super speller!", "Nailed it!", "Brain power!", "Hooray!"];
  const MP_MIN = 2, MP_MAX = 6;
  const MP_POINTS = { letter: 1, lastLetter: 3, stumped: 2 };

  /* ---------- Screens ---------- */
  const home = `<button class="icon-btn" data-home aria-label="Home"></button>`;
  const back = `<button class="back-link" data-hm-back>‹ Hangman</button>`;
  $("game-root").insertAdjacentHTML("beforeend", `
  <section class="screen hm menu" id="hm-menu" hidden>
    <header class="topbar"><div class="tb-left">${home}</div><h2></h2>
      <div class="tb-right"><button class="icon-btn" id="hm-btn-howto" aria-label="How to play">?</button></div></header>
    <h1 class="title">Hang<span>man</span></h1>
    <p class="tagline">Guess the word before the picture is finished!</p>
    <div class="resume" id="hm-resume" hidden>
      <p>You have a multiplayer game in progress.</p>
      <div class="row">
        <button class="btn" id="hm-btn-resume">Resume game</button>
        <button class="btn ghost" id="hm-btn-discard">Quit it</button>
      </div>
    </div>
    <div class="menu-buttons">
      <button class="btn big" id="hm-btn-single">Single Player</button>
      <button class="btn big" id="hm-btn-multi">Multiplayer</button>
    </div>
    <h2 class="label">Picture theme</h2>
    <div class="theme-grid" id="hm-menu-themes" role="radiogroup" aria-label="Picture theme"></div>
  </section>

  <section class="screen hm" id="hm-howto" hidden>
    <header class="topbar"><div class="tb-left">${home}${back}</div><h2>How to play</h2><div class="tb-right"></div></header>
    <ol class="howto">
      <li>Guess the secret word one letter at a time.</li>
      <li>Right letters fill in the blanks. Wrong letters add to the picture.</li>
      <li>Fill in the whole word before the picture is finished to win!</li>
      <li>Playing with friends? One player picks a word, everyone else takes turns guessing.</li>
    </ol>
  </section>

  <section class="screen hm" id="hm-difficulty" hidden>
    <header class="topbar"><div class="tb-left">${home}${back}</div><h2>Pick a level</h2><div class="tb-right"></div></header>
    <div class="playing-as" id="hm-playing-as"></div>
    <div class="levels" id="hm-levels"></div>
    <p class="note">Theme: <b id="hm-diff-theme"></b> &middot; change it on the Hangman menu</p>
  </section>

  <section class="screen hm game" id="hm-game" hidden>
    <header class="topbar">
      <div class="tb-left">${home}</div>
      <h2 id="hm-game-title"></h2>
      <div class="tb-right"><span class="hearts" id="hm-hearts"></span></div>
    </header>
    <div class="drawing" id="hm-drawing" aria-hidden="true"></div>
    <p class="hint" id="hm-hint"></p>
    <div class="word" id="hm-word" aria-live="polite"></div>
    <p class="turn" id="hm-turn" aria-live="polite"></p>
    <div class="bottom">
      <div class="keys" id="hm-keys" aria-label="Letters"></div>
      <div class="result" id="hm-result" hidden>
        <p class="banner" id="hm-banner" aria-live="assertive"></p>
        <p class="reveal" id="hm-reveal"></p>
        <div class="row" id="hm-result-actions"></div>
      </div>
    </div>
  </section>

  <section class="screen hm" id="hm-mp-setup" hidden>
    <header class="topbar"><div class="tb-left">${home}${back}</div><h2>Multiplayer</h2><div class="tb-right"></div></header>
    <h3 class="label">Players (in turn order)</h3>
    <div id="hm-mp-picker"></div>
    <h3 class="label">Rounds</h3>
    <div class="stepper">
      <button class="icon-btn" id="hm-rounds-minus" aria-label="Fewer rounds">&minus;</button>
      <output id="hm-rounds">3</output>
      <button class="icon-btn" id="hm-rounds-plus" aria-label="More rounds">+</button>
    </div>
    <p class="note" id="hm-rounds-note"></p>
    <p class="err" id="hm-setup-err" aria-live="polite"></p>
    <button class="btn big" id="hm-mp-start">Start game</button>
  </section>

  <section class="screen hm" id="hm-mp-word" hidden>
    <header class="topbar"><div class="tb-left">${home}</div><h2 id="hm-word-title"></h2><div class="tb-right"></div></header>
    <label class="field">
      <span>Secret word or short phrase</span>
      <span class="secret-row">
        <input id="hm-secret" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="40" placeholder="Shh... type it here">
        <button class="icon-btn" id="hm-peek" type="button" aria-label="Show word" aria-pressed="false">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </span>
    </label>
    <p class="err" id="hm-secret-err" aria-live="polite"></p>
    <label class="field">
      <span>Hint (optional)</span>
      <input id="hm-hint-input" type="text" autocomplete="off" maxlength="30" placeholder="e.g. An animal">
    </label>
    <h3 class="label">Picture theme for this round</h3>
    <div class="theme-grid" id="hm-mp-themes" role="radiogroup" aria-label="Picture theme"></div>
    <button class="btn big" id="hm-word-done">Done</button>
  </section>

  <section class="screen hm" id="hm-scores" hidden>
    <header class="topbar"><div class="tb-left">${home}</div><h2 id="hm-scores-title"></h2><div class="tb-right"></div></header>
    <p class="scores-word" id="hm-scores-word"></p>
    <table class="scoreboard">
      <thead><tr><th>Player</th><th id="hm-scores-round-h">This round</th><th>Total</th></tr></thead>
      <tbody id="hm-scores-body"></tbody>
    </table>
    <p class="winner" id="hm-scores-winner"></p>
    <div class="col scores-actions" id="hm-scores-actions"></div>
  </section>`);

  /* ---------- Stats (per player; guests' stats aren't saved) ---------- */
  const blankLevels = () => Object.fromEntries(Object.keys(DIFFS).map(d => [d, { wins: 0, streak: 0, best: 0 }]));
  let allStats = A.store.get("hangman:stats", {});
  let guestStats = blankLevels();
  function statsFor(player) {
    if (!player || !player.id) return guestStats;
    const s = allStats[player.id] = allStats[player.id] || {};
    for (const d in DIFFS) s[d] = Object.assign({ wins: 0, streak: 0, best: 0 }, s[d]);
    return s;
  }
  const saveStats = () => A.store.set("hangman:stats", allStats);
  const lastWords = A.store.get("hangman:lastWords", {});

  /* ---------- Menu ---------- */
  function showMenu() {
    A.setAccent(ACCENT);
    $("hm-resume").hidden = !mpInProgress();
    A.buildThemePicker($("hm-menu-themes"), A.settings.theme, id => { A.settings.theme = id; A.saveSettings(); });
    A.show("hm-menu");
  }
  document.querySelectorAll("[data-hm-back]").forEach(b => b.addEventListener("click", showMenu));
  $("hm-btn-howto").addEventListener("click", () => A.show("hm-howto"));
  $("hm-btn-single").addEventListener("click", () =>
    A.whoIsPlaying({ onDone: showDifficulty, onBack: showMenu, backLabel: "Hangman" }));
  $("hm-btn-multi").addEventListener("click", showMpSetup);
  $("hm-btn-resume").addEventListener("click", resumeMp);
  $("hm-btn-discard").addEventListener("click", async () => {
    if (await A.confirm("Quit the game in progress? Scores will be lost.", "Quit game")) { clearMp(); showMenu(); }
  });

  /* ---------- Single player ---------- */
  function showDifficulty() {
    const player = A.session.player;
    const stats = statsFor(player);
    $("hm-playing-as").innerHTML = `${A.avatarSvg(player)}<span>Playing: <b>${esc(player.name)}</b></span>
      <button class="btn ghost" id="hm-switch">Switch</button>`;
    $("hm-switch").addEventListener("click", () =>
      A.whoIsPlaying({ force: true, onDone: showDifficulty, onBack: showDifficulty, backLabel: "Levels" }));
    const box = $("hm-levels");
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
    $("hm-diff-theme").textContent = A.themeName(A.settings.theme);
    A.setAccent(ACCENT);
    A.show("hm-difficulty");
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
    A.store.set("hangman:lastWords", lastWords);
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
      A.store.set("hangman:lastWords", lastWords);
      game = HM.Engine.newEvil(HM.IMPOSSIBLE_WORDS[len], DIFFS.impossible.misses);
      hint = null;
    } else {
      const w = pickWord(diff);
      game = HM.Engine.newFixed(w.word, DIFFS[diff].misses);
      const free = DIFFS[diff].freeLetter ? HM.Engine.revealRandom(game) : null;
      if (free) setTimeout(() => A.toast(`Here's a free letter: ${free.toUpperCase()}`), 300);
      hint = w.category;
    }
    const themeId = A.resolveTheme(A.settings.theme);
    A.noteThemeUsed(themeId);
    G = { mode: "sp", diff, game, hint, themeId, title: DIFFS[diff].name, player: A.session.player };
    openGame();
  }

  function finishSingle(r) {
    const s = statsFor(G.player)[G.diff];
    if (r.won) { s.wins++; s.streak++; s.best = Math.max(s.best, s.streak); }
    else s.streak = 0;
    if (G.player && G.player.id) saveStats();
    showResult({
      win: r.won,
      banner: r.won ? pick(CHEERS) : (G.diff === "impossible" ? "Gotcha! Tricky one." : "So close!"),
      reveal: r.won ? `Streak: ${s.streak}${s.streak === s.best && s.best > 1 ? " — a new best!" : ""}` : `The word was <b>${esc(G.game.word)}</b>`,
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
    $("hm-keys").appendChild(b);
    keyButtons[ch] = b;
  }

  function openGame() {
    drawnKey = "";
    A.setAccent(A.getTheme(G.themeId).accent);
    $("hm-result").hidden = true;
    $("hm-keys").hidden = false;
    A.show("hm-game");
    renderGame();
    if (G.game.over) restoreResult();
  }

  function renderGame(popLetter) {
    const g = G.game;
    const theme = A.getTheme(G.themeId);
    $("hm-game-title").textContent = G.title;

    const left = g.maxMisses - g.wrong.length;
    $("hm-hearts").innerHTML = "♥".repeat(Math.max(0, left)) + `<span class="gone">${"♥".repeat(g.wrong.length)}</span>`;
    $("hm-hearts").setAttribute("aria-label", `${left} guesses left`);

    const view = A.themeView(theme, g.wrong.length, g.maxMisses);
    const outcome = g.over ? (g.won ? "win" : "lose") : null;
    const key = `${G.themeId}|${view.done.length}|${outcome}`;
    if (key !== drawnKey) {
      $("hm-drawing").innerHTML = A.themeSvg(theme, view, outcome);
      drawnKey = key;
    }

    if (G.mode === "sp") {
      $("hm-hint").innerHTML = G.hint ? `Hint: <b>${esc(G.hint)}</b>` : `No hints here! ${g.revealed.length} letters.`;
    } else {
      $("hm-hint").innerHTML = G.hint ? `Hint: <b>${esc(G.hint)}</b>` : "";
    }

    renderWord(popLetter);

    for (const ch of LETTERS) {
      const b = keyButtons[ch];
      const used = g.guessed.includes(ch);
      b.disabled = used || g.over;
      b.className = "key" + (used ? (g.wrong.includes(ch) ? " wrong" : " right") : "");
    }

    if (G.mode === "mp" && !g.over) {
      const p = mpCurrentGuesser();
      $("hm-turn").innerHTML = `${A.avatarSvg(p)}<span>${esc(p.name)}'s turn</span>`;
    } else {
      $("hm-turn").innerHTML = "";
    }
  }

  function renderWord(popLetter) {
    const g = G.game;
    const groups = [[]];
    for (let i = 0; i < g.revealed.length; i++) {
      if (g.mode === "fixed" && g.word[i] === " ") groups.push([]);
      else groups[groups.length - 1].push(i);
    }
    const el = $("hm-word");
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
    if (!G || A.currentScreen !== "hm-game") return;
    const el = $("hm-word");
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
    if (!G || A.currentScreen !== "hm-game" || A.dialogOpen()) return;
    const guesser = G.mode === "mp" ? mpCurrentGuesser() : null;
    const r = HM.Engine.guess(G.game, ch);
    if (!r) return;
    if (r.correct) A.sfx.right(); else { A.sfx.wrong(); A.buzz(); }
    if (G.mode === "mp") mpAfterGuess(r, guesser);
    renderGame(r.correct ? ch : null);
    if (r.won || r.lost) {
      setTimeout(() => (r.won ? A.sfx.win() : A.sfx.lose()), 250);
      if (G.mode === "sp") finishSingle(r); else mpRoundOver();
    }
  }

  function showResult({ win, banner, reveal, actions }) {
    $("hm-keys").hidden = true;
    $("hm-result").hidden = false;
    $("hm-banner").textContent = banner;
    $("hm-banner").className = "banner " + (win ? "win" : "lose");
    $("hm-reveal").innerHTML = reveal || "";
    resultActions = actions;
    const box = $("hm-result-actions");
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

  document.addEventListener("keydown", e => {
    if (e.ctrlKey || e.metaKey || e.altKey || A.dialogOpen()) return;
    if (A.currentScreen !== "hm-game" || !G) return;
    if (e.target.tagName === "INPUT") return;
    if (/^[a-zA-Z]$/.test(e.key)) { e.preventDefault(); onGuess(e.key.toLowerCase()); }
    else if (e.key === "Enter" && G.game.over && resultActions.length && !e.target.closest("button")) {
      e.preventDefault(); resultActions[0].run();
    }
  });

  /* ---------- Multiplayer ---------- */
  let mp = A.store.get("hangman:mp", null);
  const saveMp = () => A.store.set("hangman:mp", mp);
  function clearMp() { mp = null; A.store.remove("hangman:mp"); }
  const mpInProgress = () => !!(mp && mp.phase && mp.phase !== "final");

  // Leaving a multiplayer game (Home button) asks first; the game stays saved.
  const leaveMp = () => A.confirm("Leave this game? You can resume it from the Hangman menu.", "Leave");
  const mpGuard = () => (mpInProgress() ? leaveMp() : Promise.resolve(true));
  A.homeGuards["hm-game"] = () => (G && G.mode === "mp" ? mpGuard() : Promise.resolve(true));
  A.homeGuards["hm-mp-word"] = mpGuard;
  A.homeGuards["hm-scores"] = mpGuard;

  // Setup screen
  let picker = null;
  let setupRounds = null; // null = follow the number of players
  function showMpSetup() {
    A.setAccent(ACCENT);
    $("hm-setup-err").textContent = "";
    picker = A.playerPicker($("hm-mp-picker"), {
      min: MP_MIN, max: MP_MAX, initial: A.store.get("hangman:lastSetup", []),
      onChange: () => { $("hm-setup-err").textContent = ""; renderRounds(); }
    });
    renderRounds();
    A.show("hm-mp-setup");
  }
  function renderRounds() {
    const n = Math.max(MP_MIN, picker.count());
    const rounds = setupRounds || n;
    $("hm-rounds").textContent = rounds;
    $("hm-rounds-note").textContent = rounds === n
      ? "Everyone is the Word Master once."
      : rounds % n === 0 ? `Everyone is the Word Master ${rounds / n} times.` : "The Word Master changes every round.";
  }
  const currentRounds = () => setupRounds || Math.max(MP_MIN, picker.count());
  $("hm-rounds-minus").addEventListener("click", () => { setupRounds = Math.max(1, currentRounds() - 1); renderRounds(); });
  $("hm-rounds-plus").addEventListener("click", () => { setupRounds = Math.min(18, currentRounds() + 1); renderRounds(); });

  $("hm-mp-start").addEventListener("click", async () => {
    if (picker.count() < MP_MIN) { $("hm-setup-err").textContent = `Pick at least ${MP_MIN} players.`; return; }
    if (mpInProgress() && !(await A.confirm("Start a new game? The game in progress will be lost.", "Start new"))) return;
    A.store.set("hangman:lastSetup", picker.entries());
    const players = picker.get().map(p => ({ id: p.id, name: p.name, avatar: p.avatar, score: 0 }));
    newMpGame(players, currentRounds());
  });

  function newMpGame(players, rounds) {
    mp = { players, rounds, round: 0, phase: "pass", themeChoice: A.settings.theme, r: null };
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
    const themeAccent = mp.r && mp.r.themeId ? A.getTheme(mp.r.themeId).accent : A.themeAccent(mp.themeChoice);
    switch (mp.phase) {
      case "pass":
      case "word":
        mp.phase = "pass";
        A.setAccent(ACCENT);
        A.pass({
          player: mpWordMaster(),
          small: `Round ${mp.round + 1} of ${mp.rounds} · Word Master`,
          note: `${mpWordMaster().name} picks the secret word. No peeking, everyone else!`,
          onReady: showWordEntry,
          onHome: mpGuard
        });
        break;
      case "ready": {
        A.setAccent(themeAccent);
        const guessers = mpGuesserOrder().map(i => mp.players[i]);
        A.pass({
          player: guessers[0],
          small: "The word is hidden!",
          note: `${mpWordMaster().name} picked a word. Guessers: ${guessers.map(p => p.name).join(", ")}`,
          onReady: () => { mp.phase = "guess"; saveMp(); mpGo(); },
          onHome: mpGuard
        });
        break;
      }
      case "guess":
        G = {
          mode: "mp", game: mp.r.game, hint: mp.r.hint, themeId: mp.r.themeId,
          title: `Round ${mp.round + 1} of ${mp.rounds}`
        };
        openGame();
        break;
      case "roundEnd":
      case "final":
        A.setAccent(themeAccent);
        showScores();
        break;
    }
  }

  // Word Master enters the secret word
  let wordThemeChoice = "classic";
  function showWordEntry() {
    mp.phase = "word";
    saveMp();
    $("hm-word-title").textContent = `${mpWordMaster().name}'s secret word`;
    $("hm-secret").value = "";
    $("hm-secret").type = "password";
    $("hm-peek").setAttribute("aria-pressed", "false");
    $("hm-peek").setAttribute("aria-label", "Show word");
    $("hm-hint-input").value = "";
    $("hm-secret-err").textContent = "";
    wordThemeChoice = mp.themeChoice || "classic";
    A.buildThemePicker($("hm-mp-themes"), wordThemeChoice, id => { wordThemeChoice = id; A.setAccent(A.themeAccent(id)); });
    A.setAccent(A.themeAccent(wordThemeChoice));
    A.show("hm-mp-word");
  }
  $("hm-peek").addEventListener("click", () => {
    const input = $("hm-secret");
    const showing = input.type === "password";
    input.type = showing ? "text" : "password";
    $("hm-peek").setAttribute("aria-pressed", String(showing));
    $("hm-peek").setAttribute("aria-label", showing ? "Hide word" : "Show word");
  });
  $("hm-secret").addEventListener("keydown", e => { if (e.key === "Enter") $("hm-hint-input").focus(); });
  $("hm-secret").addEventListener("input", () => { $("hm-secret-err").textContent = ""; });
  $("hm-hint-input").addEventListener("keydown", e => { if (e.key === "Enter") $("hm-word-done").click(); });

  $("hm-word-done").addEventListener("click", () => {
    const raw = $("hm-secret").value.toLowerCase().trim().replace(/\s+/g, " ");
    const letters = raw.replace(/ /g, "").length;
    let err = "";
    if (!raw) err = "Type a secret word first.";
    else if (!/^[a-z ]+$/.test(raw)) err = "Use letters and spaces only.";
    else if (letters < 2) err = "Use at least 2 letters.";
    else if (letters > 20) err = "Keep it to 20 letters or fewer.";
    $("hm-secret-err").textContent = err;
    if (err) { $("hm-secret").focus(); return; }

    mp.themeChoice = wordThemeChoice;
    const themeId = A.resolveTheme(wordThemeChoice);
    A.noteThemeUsed(themeId);
    mp.r = {
      word: raw,
      hint: $("hm-hint-input").value.trim().slice(0, 30),
      themeId,
      game: HM.Engine.newFixed(raw, 6),
      turn: 0,
      points: mp.players.map(() => 0)
    };
    mp.phase = "ready";
    $("hm-secret").value = "";
    $("hm-secret").blur();
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
      A.toast(`+${pts} ${guesser.name}${r.won ? "!" : ""}`);
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
    $("hm-scores-title").textContent = final ? "Final scores" : `Round ${mp.round + 1} of ${mp.rounds}`;
    $("hm-scores-word").innerHTML = final ? "" : `The word was <b>${esc(mp.r.word)}</b>`;
    $("hm-scores-round-h").hidden = final;

    const top = Math.max(...mp.players.map(p => p.score));
    const rows = mp.players.map((p, i) => ({ p, i }));
    if (final) rows.sort((a, b) => b.p.score - a.p.score);
    $("hm-scores-body").innerHTML = rows.map(({ p, i }) => `
      <tr class="${final && p.score === top ? "top" : ""}">
        <td><span class="who">${A.avatarSvg(p)}<span>${esc(p.name)}${!final && i === wmIndex ? ' <span class="role">(Word Master)</span>' : ""}</span></span></td>
        ${final ? "" : `<td class="plus">${mp.r.points[i] ? "+" + mp.r.points[i] : "–"}</td>`}
        <td>${p.score}</td>
      </tr>`).join("");

    if (final) {
      const winners = mp.players.filter(p => p.score === top).map(p => p.name);
      $("hm-scores-winner").textContent = winners.length === 1 ? `${winners[0]} wins!` : `It's a tie: ${winners.join(" & ")}!`;
    } else {
      $("hm-scores-winner").textContent = "";
    }

    const box = $("hm-scores-actions");
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
        newMpGame(mp.players.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, score: 0 })), mp.rounds);
      });
      add("Hangman menu", "ghost", () => { clearMp(); showMenu(); });
    } else if (mp.round + 1 < mp.rounds) {
      const next = mp.players[(mp.round + 1) % mp.players.length].name;
      add(`Next round: pass to ${next}`, "big", () => { mp.round++; mp.r = null; mp.phase = "pass"; saveMp(); mpGo(); });
    } else {
      add("See final scores", "big", () => { mp.phase = "final"; saveMp(); mpGo(); });
    }
    A.show("hm-scores");
  }

  function resumeMp() { if (mpInProgress()) mpGo(); }

  /* ---------- Register with the arcade ---------- */
  A.registerGame({
    id: "hangman",
    name: "Hangman",
    accent: ACCENT,
    icon: `<path d="M8 44 H26 M14 44 V6 H34 V12"/><circle class="acc" cx="34" cy="17" r="5"/>
      <path class="acc" d="M34 22 V32 M34 25 L29 30 M34 25 L39 30 M34 32 L30 39 M34 32 L38 39"/>`,
    open: showMenu,
    tileStat(playerId) {
      const s = allStats[playerId];
      if (!s) return null;
      const best = Math.max(0, ...Object.values(s).map(l => (l && l.best) || 0));
      return best ? `Best streak: ${best}` : null;
    },
    resetStats() { allStats = {}; guestStats = blankLevels(); saveStats(); },
    forgetPlayer(id) {
      delete allStats[id];
      saveStats();
      A.store.set("hangman:lastSetup", A.store.get("hangman:lastSetup", []).filter(e => e.id !== id));
    },
    autoResume() {
      if (!mpInProgress()) { if (mp) clearMp(); return false; }
      A.setAccent(ACCENT);
      resumeMp();
      A.toast("Game resumed");
      return true;
    }
  });
})();

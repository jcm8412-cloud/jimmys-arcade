/* Silly Stories: players fill in typed blanks without seeing the story, then it's revealed
   (and read aloud where the device supports it). Solo or pass-and-play for 2–6 players.
   Templates live in stories.json: "{type}" is a blank; "{type|key}" reuses one answer wherever
   the same key appears. Saved data: silly-stories:favorites (up to 50), silly-stories:stats
   {playerId: {stories}}, silly-stories:recent (template ids), silly-stories:lastSetup. */
(function () {
  const A = window.Arcade;
  const $ = id => document.getElementById(id);
  const esc = A.esc, pick = A.pick;
  const ACCENT = "#f29a9a";
  const MAX_FAVORITES = 50;
  const RECENT = 15;
  const NAME_TYPE = "name of a person in the room";

  /* ---------- Screens ---------- */
  const home = `<button class="icon-btn" data-home aria-label="Home"></button>`;
  const back = `<button class="back-link" data-ss-back>‹ Silly Stories</button>`;
  $("game-root").insertAdjacentHTML("beforeend", `
  <section class="screen ss menu" id="ss-menu" hidden>
    <header class="topbar"><div class="tb-left">${home}</div><h2></h2><div class="tb-right"></div></header>
    <h1 class="title">Silly <span>Stories</span></h1>
    <p class="tagline">Fill in the blanks without peeking, then hear your silly story!</p>
    <div class="menu-buttons">
      <button class="btn big" id="ss-btn-solo">Solo</button>
      <button class="btn big" id="ss-btn-pass">Pass-and-play</button>
      <button class="btn ghost" id="ss-btn-favs">Favorites</button>
    </div>
  </section>

  <section class="screen ss" id="ss-setup" hidden>
    <header class="topbar"><div class="tb-left">${home}${back}</div><h2>Pass-and-play</h2><div class="tb-right"></div></header>
    <p class="note">Everyone takes turns filling in words. Nobody sees the story until the end!</p>
    <h3 class="label">Players (in turn order)</h3>
    <div id="ss-picker"></div>
    <p class="err" id="ss-setup-err" aria-live="polite"></p>
    <button class="btn big" id="ss-start">Start story</button>
  </section>

  <section class="screen ss fill" id="ss-fill" hidden>
    <header class="topbar"><div class="tb-left">${home}</div><h2 id="ss-progress"></h2><div class="tb-right" id="ss-writer"></div></header>
    <div class="dots" id="ss-dots" aria-hidden="true"></div>
    <div class="ask">
      <p class="type" id="ss-type"></p>
      <p class="explain" id="ss-explain"></p>
    </div>
    <input type="text" id="ss-input" class="word-input" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="40" aria-labelledby="ss-type">
    <p class="err" id="ss-err" aria-live="polite"></p>
    <div class="chips" id="ss-chips"></div>
    <button class="btn ghost" id="ss-idea">Give me an idea</button>
    <div class="fill-nav">
      <button class="btn ghost" id="ss-back">Back</button>
      <button class="btn big" id="ss-next">Next</button>
    </div>
  </section>

  <section class="screen ss reveal" id="ss-reveal" hidden>
    <header class="topbar"><div class="tb-left">${home}<button class="back-link" id="ss-reveal-back">‹ Silly Stories</button></div><h2></h2><div class="tb-right"></div></header>
    <article class="story" id="ss-story" aria-live="polite"></article>
    <div class="col" id="ss-reveal-actions"></div>
  </section>

  <section class="screen ss" id="ss-favs" hidden>
    <header class="topbar"><div class="tb-left">${home}${back}</div><h2>Favorites</h2><div class="tb-right"></div></header>
    <p class="note" id="ss-favs-note"></p>
    <div class="fav-list" id="ss-fav-list"></div>
  </section>`);

  /* ---------- Templates ---------- */
  let templates = null;
  async function loadTemplates() {
    if (templates) return templates;
    const res = await fetch("games/silly-stories/stories.json");
    if (!res.ok) throw new Error("stories.json " + res.status);
    templates = await res.json();
    return templates;
  }

  // Split a template string into text pieces and blank references, collecting the blanks to ask for.
  const BLANK = /\{([^}|]+)(?:\|([^}]+))?\}/g;
  function parse(template) {
    const blanks = [];
    const byKey = {};
    const toParts = str => {
      const parts = [];
      let last = 0;
      for (const m of str.matchAll(BLANK)) {
        if (m.index > last) parts.push(str.slice(last, m.index));
        const type = m[1].trim();
        const key = m[2] ? `${type}|${m[2].trim()}` : null;
        let index = key != null ? byKey[key] : undefined;
        if (index === undefined) {
          index = blanks.length;
          blanks.push({ type });
          if (key != null) byKey[key] = index;
        }
        parts.push({ b: index });
        last = m.index + m[0].length;
      }
      if (last < str.length) parts.push(str.slice(last));
      return parts;
    };
    const title = toParts(template.title);
    const text = toParts(template.text);
    return { id: template.id, title, text, blanks };
  }
  SS.parse = parse;

  // Fill parts with words: [{t: text} | {w: word, by}]. Capitalizes sentence starts and fixes "a" -> "an".
  function assemble(parts, words, by) {
    const segs = [];
    let soFar = "";
    for (const p of parts) {
      if (typeof p === "string") { segs.push({ t: p }); soFar += p; continue; }
      let w = words[p.b] || "";
      const before = soFar.replace(/\s+$/, "");
      if (!before || /[.!?]$/.test(before) || /(^|[\s,:(])"$/.test(before)) w = w.charAt(0).toUpperCase() + w.slice(1);
      const prev = segs[segs.length - 1];
      if (prev && prev.t !== undefined && /(^|[\s"(])[Aa] $/.test(prev.t) && /^([aeiou]|8|11 |11$|18)/i.test(w)) {
        prev.t = prev.t.replace(/([Aa]) $/, "$1n ");
        soFar = soFar.replace(/([Aa]) $/, "$1n ");
      }
      segs.push({ w, by: by ? by[p.b] || null : null });
      soFar += w;
    }
    return segs;
  }
  SS.assemble = assemble;
  const plain = segs => segs.map(s => (s.t !== undefined ? s.t : s.w)).join("");

  /* ---------- Saved data ---------- */
  let stats = A.store.get("silly-stories:stats", {});
  const saveStats = () => A.store.set("silly-stories:stats", stats);
  const favorites = () => A.store.get("silly-stories:favorites", []);
  const saveFavorites = list => A.store.set("silly-stories:favorites", list);

  /* ---------- Speech ---------- */
  const canSpeak = () => A.settings.readAloud && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
  let speakingBtn = null;
  function stopSpeaking() {
    try { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    if (speakingBtn) { speakingBtn.textContent = "Read it to me"; speakingBtn = null; }
  }
  function toggleSpeak(btn, text) {
    if (speakingBtn) { stopSpeaking(); return; }
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.9;
      u.pitch = 1.05;
      u.onend = u.onerror = () => { if (speakingBtn === btn) { btn.textContent = "Read it to me"; speakingBtn = null; } };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
      speakingBtn = btn;
      btn.textContent = "Stop reading";
    } catch (e) { A.toast("Reading aloud isn't working on this device."); }
  }
  A.homeGuards["ss-reveal"] = () => { stopSpeaking(); return Promise.resolve(true); };

  /* ---------- Menu ---------- */
  function showMenu() {
    stopSpeaking();
    A.setAccent(ACCENT);
    const n = favorites().length;
    $("ss-btn-favs").textContent = n ? `Favorites (${n})` : "Favorites";
    A.show("ss-menu");
  }
  document.querySelectorAll("[data-ss-back]").forEach(b => b.addEventListener("click", showMenu));
  $("ss-btn-solo").addEventListener("click", () =>
    A.whoIsPlaying({ onDone: p => startStory({ mode: "solo", players: [p] }), onBack: showMenu, backLabel: "Silly Stories" }));
  $("ss-btn-pass").addEventListener("click", showSetup);
  $("ss-btn-favs").addEventListener("click", showFavorites);

  /* ---------- Pass-and-play setup ---------- */
  let picker = null;
  function showSetup() {
    A.setAccent(ACCENT);
    $("ss-setup-err").textContent = "";
    picker = A.playerPicker($("ss-picker"), {
      min: 2, max: 6, initial: A.store.get("silly-stories:lastSetup", []),
      onChange: () => { $("ss-setup-err").textContent = ""; }
    });
    A.show("ss-setup");
  }
  $("ss-start").addEventListener("click", () => {
    if (picker.count() < 2) { $("ss-setup-err").textContent = "Pick at least 2 players."; return; }
    A.store.set("silly-stories:lastSetup", picker.entries());
    startStory({ mode: "pass", players: picker.get() });
  });

  /* ---------- Filling in the words ---------- */
  let S = null; // { mode, players, story (parsed), words, by, offset, counted, saved }

  async function startStory({ mode, players, templateId, offset }) {
    stopSpeaking();
    try { await loadTemplates(); } catch (e) { A.toast("Couldn't load the stories. Try again online."); return; }
    let template = templateId && templates.find(t => t.id === templateId);
    if (!template) {
      const recent = A.store.get("silly-stories:recent", []);
      const fresh = templates.filter(t => !recent.includes(t.id));
      template = pick(fresh.length ? fresh : templates);
      A.store.set("silly-stories:recent", [template.id].concat(recent.filter(id => id !== template.id)).slice(0, RECENT));
    }
    const story = parse(template);
    offset = offset || 0;
    S = {
      mode, players, story, offset,
      words: new Array(story.blanks.length).fill(""),
      by: story.blanks.map((_, i) => players[(i + offset) % players.length]),
      counted: false, saved: false
    };
    A.setAccent(ACCENT);
    goTo(0);
  }

  function goTo(i) {
    if (S.mode === "pass") {
      A.pass({
        player: S.by[i],
        small: `Word ${i + 1} of ${S.words.length}`,
        note: "Fill in your word. No peeking at anyone else's!",
        onReady: () => showFill(i),
        onHome: leaveGuard
      });
    } else {
      showFill(i);
    }
  }

  const hasWords = () => S && S.words.some(w => w);
  const leaveGuard = () => (hasWords() ? A.confirm("Leave this story? The words so far will be lost.", "Leave") : Promise.resolve(true));
  A.homeGuards["ss-fill"] = leaveGuard;

  let filling = 0;
  function showFill(i) {
    filling = i;
    const n = S.words.length;
    const type = SS.TYPES[S.story.blanks[i].type];
    $("ss-progress").textContent = `Word ${i + 1} of ${n}`;
    $("ss-writer").innerHTML = S.mode === "pass" ? A.avatarSvg(S.by[i]) : "";
    $("ss-dots").innerHTML = S.words.map((_, k) => `<i class="${k < i ? "done" : k === i ? "now" : ""}"></i>`).join("");
    $("ss-type").textContent = type.label;
    $("ss-explain").innerHTML = `${esc(type.explain)}, like <em>${esc(type.examples[0])}</em>, <em>${esc(type.examples[1])}</em>, or <em>${esc(type.examples[2])}</em>.`;
    $("ss-input").value = S.words[i];
    $("ss-err").textContent = "";

    // Quick-tap names for "name of a person in the room".
    const chips = $("ss-chips");
    chips.innerHTML = "";
    if (S.story.blanks[i].type === NAME_TYPE) {
      const names = [...new Set(S.players.filter(p => p && !p.guest).map(p => p.name)
        .concat(A.players.all().map(p => p.name)))].slice(0, 8);
      for (const name of names) {
        const b = document.createElement("button");
        b.className = "chip";
        b.type = "button";
        b.textContent = name;
        b.addEventListener("click", () => { $("ss-input").value = name; $("ss-err").textContent = ""; });
        chips.appendChild(b);
      }
    }

    // Back changes the previous word. In pass-and-play the previous word is someone else's secret, so it's hidden.
    $("ss-back").hidden = S.mode === "pass";
    $("ss-back").textContent = i === 0 ? "Menu" : "Back";
    $("ss-next").textContent = i === n - 1 ? "Show my story!" : "Next";
    A.show("ss-fill");
    $("ss-input").focus({ preventScroll: true });
  }

  $("ss-input").addEventListener("input", () => { $("ss-err").textContent = ""; });
  $("ss-input").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $("ss-next").click(); } });
  $("ss-idea").addEventListener("click", () => {
    const ideas = SS.TYPES[S.story.blanks[filling].type].ideas;
    const current = $("ss-input").value;
    const options = ideas.filter(w => w !== current);
    $("ss-input").value = pick(options.length ? options : ideas);
    $("ss-err").textContent = "";
  });
  $("ss-back").addEventListener("click", async () => {
    S.words[filling] = cleanWord($("ss-input").value) || S.words[filling];
    if (filling === 0) { if (await leaveGuard()) showMenu(); return; }
    showFill(filling - 1);
  });
  $("ss-next").addEventListener("click", () => {
    const word = cleanWord($("ss-input").value);
    if (!word) { $("ss-err").textContent = "Type a word, or tap \"Give me an idea\"."; $("ss-input").focus(); return; }
    S.words[filling] = word;
    $("ss-input").blur();
    if (filling + 1 < S.words.length) goTo(filling + 1);
    else showReveal();
  });

  // Trim to 20 characters and quietly swap anything on the blocked list for a silly word.
  function cleanWord(raw) {
    let w = String(raw).replace(/\s+/g, " ").trim().slice(0, SS.MAX_WORD).trim();
    if (w && SS.isBlocked(w)) w = pick(SS.TYPES["silly word"].ideas);
    return w;
  }

  /* ---------- The reveal ---------- */
  function storyObject() {
    const by = S.mode === "pass" ? S.by.map(p => ({ name: p.name, avatar: p.avatar || null })) : null;
    return {
      title: assemble(S.story.title, S.words, by),
      text: assemble(S.story.text, S.words, by),
      templateId: S.story.id
    };
  }

  function renderStory(story) {
    const html = segs => segs.map(s => (s.t !== undefined
      ? esc(s.t).replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")
      : `<mark class="ss-word">${esc(s.w)}${s.by ? `<span class="ss-by" title="${esc(s.by.name)}">${A.avatarSvg(s.by)}</span>` : ""}</mark>`)).join("");
    $("ss-story").innerHTML = `<h3 class="story-title">${html(story.title)}</h3><p>${html(story.text)}</p>`;
  }

  function showReveal() {
    const story = storyObject();
    renderStory(story);
    if (!S.counted) {
      S.counted = true;
      for (const p of new Set(S.players.filter(p => p && p.id).map(p => p.id))) {
        stats[p] = stats[p] || { stories: 0 };
        stats[p].stories++;
      }
      saveStats();
    }
    revealActions(story, [
      { label: "New story", cls: "big", run: () => startStory({ mode: S.mode, players: S.players }) },
      { label: "Same story, new words", cls: "", run: () => startStory({ mode: S.mode, players: S.players, templateId: S.story.id, offset: S.offset + 1 }) },
      { label: S.saved ? "Saved to favorites ✓" : "Save to favorites", cls: "ghost", disabled: S.saved, run: btn => saveFavorite(story, btn) }
    ]);
    $("ss-reveal-back").textContent = "‹ Silly Stories";
    revealBack = showMenu;
    A.show("ss-reveal");
    A.sfx.win();
  }

  let revealBack = null;
  $("ss-reveal-back").addEventListener("click", () => { stopSpeaking(); revealBack && revealBack(); });

  function revealActions(story, actions) {
    const box = $("ss-reveal-actions");
    box.innerHTML = "";
    if (canSpeak()) {
      const read = document.createElement("button");
      read.className = "btn read";
      read.textContent = "Read it to me";
      read.addEventListener("click", () => toggleSpeak(read, plain(story.title) + ". " + plain(story.text).replace(/\n+/g, " ")));
      box.appendChild(read);
    }
    for (const a of actions) {
      const b = document.createElement("button");
      b.className = "btn " + a.cls;
      b.textContent = a.label;
      b.disabled = !!a.disabled;
      b.addEventListener("click", () => { if (a.keepSpeaking !== true) stopSpeaking(); a.run(b); });
      box.appendChild(b);
    }
  }

  function saveFavorite(story, btn) {
    const list = favorites();
    if (list.length >= MAX_FAVORITES) {
      A.toast(`Favorites are full (${MAX_FAVORITES}). Delete one to save more.`);
      return;
    }
    list.unshift({ id: A.newId(), savedAt: Date.now(), title: story.title, text: story.text });
    saveFavorites(list);
    S.saved = true;
    btn.textContent = "Saved to favorites ✓";
    btn.disabled = true;
    A.toast("Saved!");
  }

  /* ---------- Favorites ---------- */
  function showFavorites() {
    stopSpeaking();
    A.setAccent(ACCENT);
    const list = favorites();
    $("ss-favs-note").textContent = list.length
      ? `${list.length} saved ${list.length === 1 ? "story" : "stories"} (up to ${MAX_FAVORITES}).`
      : "No favorites yet. Tap \"Save to favorites\" after a story to keep it here.";
    const box = $("ss-fav-list");
    box.innerHTML = "";
    for (const f of list) {
      const authors = [];
      for (const s of f.text.concat(f.title)) if (s.by && !authors.some(a => a.name === s.by.name)) authors.push(s.by);
      const b = document.createElement("button");
      b.className = "fav-item";
      b.innerHTML = `<span class="fav-title">${esc(plain(f.title))}</span>
        <span class="fav-meta">${new Date(f.savedAt).toLocaleDateString()}${authors.length ? " · " : ""}${authors.map(a => A.avatarSvg(a)).join("")}</span>`;
      b.addEventListener("click", () => showFavorite(f));
      box.appendChild(b);
    }
    A.show("ss-favs");
  }

  function showFavorite(f) {
    renderStory(f);
    revealActions(f, [{
      label: "Delete from favorites", cls: "ghost", run: async () => {
        if (!(await A.confirm("Delete this story from favorites?", "Delete"))) return;
        saveFavorites(favorites().filter(x => x.id !== f.id));
        showFavorites();
      }
    }]);
    $("ss-reveal-back").textContent = "‹ Favorites";
    revealBack = showFavorites;
    A.show("ss-reveal");
  }

  /* ---------- Register with the arcade ---------- */
  A.registerGame({
    id: "silly-stories",
    name: "Silly Stories",
    accent: ACCENT,
    icon: `<path d="M10 8 h20 l8 8 v26 H10 Z M30 8 v8 h8"/>
      <path d="M15 22 h18 M15 28 h8 M15 34 h16"/>
      <path class="acc" d="M26 28 h7 M32 34 h1"/>`,
    open: showMenu,
    tileStat(playerId) {
      const n = stats[playerId] && stats[playerId].stories;
      return n ? `Stories made: ${n}` : null;
    },
    resetStats() { stats = {}; saveStats(); },
    forgetPlayer(id) {
      delete stats[id];
      saveStats();
      A.store.set("silly-stories:lastSetup", A.store.get("silly-stories:lastSetup", []).filter(e => e.id !== id));
    }
  });
})();

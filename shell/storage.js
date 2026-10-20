/* Saved data. Everything lives in localStorage under one "jimmys-arcade:" prefix, and every
   access is wrapped so the arcade still works when storage is unavailable (private mode etc.). */
(function () {
  const A = self.Arcade = self.Arcade || {};
  const PREFIX = "jimmys-arcade:";

  A.store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(PREFIX + key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
    },
    set(key, value) { try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ } },
    remove(key) { try { localStorage.removeItem(PREFIX + key); } catch (e) { /* storage unavailable */ } }
  };

  A.newId = () => "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* One-time move of the stand-alone Hangman app's data ("hm.*" keys) into the arcade.
     Its stats weren't per player, so they go to a new player profile that the shell asks
     the family to name on first launch. */
  A.migrateFromHangman = function () {
    if (A.store.get("migrated", false)) return;
    let oldKeys = [];
    try { oldKeys = Object.keys(localStorage).filter(k => k.startsWith("hm.")); } catch (e) { return; }
    const readOld = key => {
      try { const v = localStorage.getItem(key); return v == null ? undefined : JSON.parse(v); } catch (e) { return undefined; }
    };

    if (oldKeys.length) {
      const s = readOld("hm.settings");
      if (s) A.store.set("settings", { sound: !!s.sound, vibrate: s.vibrate !== false, readAloud: true, theme: s.theme || "classic" });

      const stats = readOld("hm.stats");
      if (stats && typeof stats === "object" && Object.keys(stats).length) {
        const player = { id: A.newId(), name: "Player 1", avatar: "star", needsName: true };
        A.store.set("players", [player].concat(A.store.get("players", [])));
        A.store.set("lastPlayer", player.id);
        A.store.set("hangman:stats", { [player.id]: stats });
      }

      const lastWords = readOld("hm.lastWords");
      if (lastWords) A.store.set("hangman:lastWords", lastWords);
      const lastTheme = readOld("hm.lastTheme");
      if (lastTheme) A.store.set("lastTheme", lastTheme);
      const mp = readOld("hm.mp");
      if (mp && mp.phase && mp.phase !== "final") A.store.set("hangman:mp", mp);

      // Only remove the old keys once everything above was really written.
      if (stats && !A.store.get("hangman:stats", null)) return;
      for (const k of oldKeys) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
    }
    A.store.set("migrated", true);
  };

  // Run before anything else reads saved data.
  A.migrateFromHangman();
})();

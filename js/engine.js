/* Game rules, no DOM. A game is a plain object so it can be saved to localStorage as JSON.
   Two modes:
     fixed: the word (or phrase) is known from the start.
     evil:  Impossible mode. The computer keeps a list of candidate words and, after each guess,
            keeps the largest group that fits the revealed pattern. Every candidate always matches
            everything revealed so far, so whichever word is shown at the end is a fair answer. */
window.HM = window.HM || {};

HM.Engine = (function () {
  const isLetter = ch => ch >= "a" && ch <= "z";

  function newFixed(word, maxMisses) {
    return {
      mode: "fixed",
      word,
      revealed: [...word].map(ch => (isLetter(ch) ? "" : ch)),
      guessed: [],
      wrong: [],
      maxMisses,
      over: false,
      won: false
    };
  }

  function newEvil(candidates, maxMisses) {
    const length = candidates[0].length;
    return {
      mode: "evil",
      candidates: candidates.slice(),
      word: null, // chosen when the game ends
      revealed: new Array(length).fill(""),
      guessed: [],
      wrong: [],
      maxMisses,
      over: false,
      won: false
    };
  }

  // Positions of `letter` in `word`, as a key like "0,3" ("" when absent).
  const patternKey = (word, letter) => {
    const at = [];
    for (let i = 0; i < word.length; i++) if (word[i] === letter) at.push(i);
    return at.join(",");
  };

  function evilChoose(game, letter) {
    const groups = new Map();
    for (const w of game.candidates) {
      const key = patternKey(w, letter);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(w);
    }
    let bestKey = null, best = null;
    for (const [key, words] of groups) {
      if (!best) { bestKey = key; best = words; continue; }
      const better =
        words.length > best.length ||
        (words.length === best.length && (key === "" ||
          (bestKey !== "" && key.split(",").length < bestKey.split(",").length)));
      if (better) { bestKey = key; best = words; }
    }
    game.candidates = best;
    return bestKey === "" ? [] : bestKey.split(",").map(Number);
  }

  /* Guess one letter. Returns null if the guess isn't allowed, otherwise
     { letter, correct, positions, won, lost }. */
  function guess(game, letter) {
    letter = letter.toLowerCase();
    if (game.over || !isLetter(letter) || letter.length !== 1 || game.guessed.includes(letter)) return null;
    game.guessed.push(letter);

    let positions;
    if (game.mode === "evil") {
      positions = evilChoose(game, letter);
    } else {
      positions = [];
      for (let i = 0; i < game.word.length; i++) if (game.word[i] === letter) positions.push(i);
    }
    for (const i of positions) game.revealed[i] = letter;
    const correct = positions.length > 0;
    if (!correct) game.wrong.push(letter);

    const won = game.revealed.every(ch => ch !== "");
    const lost = !won && game.wrong.length >= game.maxMisses;
    if (won || lost) {
      game.over = true;
      game.won = won;
      if (game.mode === "evil") {
        game.word = won ? game.revealed.join("")
          : game.candidates[Math.floor(Math.random() * game.candidates.length)];
      }
    }
    return { letter, correct, positions, won, lost };
  }

  // Picture stage 0..6. Games with fewer than 6 allowed misses start further along.
  const stage = game => game.wrong.length + (6 - game.maxMisses);

  return { newFixed, newEvil, guess, stage, isLetter };
})();

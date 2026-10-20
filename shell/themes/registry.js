/* Theme registry.
   A theme is one object passed to Arcade.registerTheme():
     id        unique string
     name      shown in the picker
     accent    CSS color; tints the board, keyboard and buttons
     optional  the two stage numbers (1..8) that are small optional details.
               Games with 6 allowed misses skip them; games with 8 use every stage.
     render(view, outcome) -> SVG markup for a 240x220 viewBox.
               view.has(n)  true once stage n (1..8) has happened
               view.last    the stage the latest miss added (0 before any miss)
               view.core    how many non-optional stages have happened (0..6)
               outcome is null, "win" or "lose". The last allowed miss always reaches stage 8
               in 8-miss games and the last non-optional stage in 6-miss games, and is also the loss.
     css       optional CSS (keyframes etc.), injected once. Prefix class names with the theme id.
   Every miss must change the picture, and no miss means a picture with nothing added yet.
   Animation convention: an element's resting style is its FINAL pose and keyframes run
   "from" the starting pose. With reduced motion (animations off) the end picture still shows.
   Shared chalk classes (see style.css): .c chalk line, .d dim line, .a accent line, .thin,
   .fc chalk fill, .fa accent fill, .fb board fill, .fa-soft faint accent fill, .t chalk text,
   .draw-in fade-in for a newly added part.
   To add a theme: drop a file in shell/themes/, add its <script> tag to index.html and its path to SHELL_FILES in sw.js. */
window.Arcade = window.Arcade || {};
Arcade.themes = [];
Arcade.THEME_STAGES = 8;

Arcade.registerTheme = function (theme) {
  if (Arcade.themes.some(t => t.id === theme.id)) return;
  Arcade.themes.push(theme);
  if (theme.css) {
    const style = document.createElement("style");
    style.dataset.theme = theme.id;
    style.textContent = theme.css;
    document.head.appendChild(style);
  }
};

Arcade.getTheme = id => Arcade.themes.find(t => t.id === id) || Arcade.themes[0];

/* Which stages have happened after `misses` wrong guesses in a game that allows `maxMisses`.
   Each miss adds exactly one stage. Stages the theme marks optional are skipped (in order)
   until there are exactly `maxMisses` stages. */
Arcade.themeView = function (theme, misses, maxMisses) {
  const optional = theme.optional || [];
  const skip = optional.slice(0, Math.max(0, Arcade.THEME_STAGES - maxMisses));
  const active = [];
  for (let s = 1; s <= Arcade.THEME_STAGES; s++) if (!skip.includes(s)) active.push(s);
  const done = active.slice(0, Math.max(0, Math.min(misses, active.length)));
  return {
    done,
    has: s => done.includes(s),
    last: done.length ? done[done.length - 1] : 0,
    core: done.filter(s => !optional.includes(s)).length
  };
};

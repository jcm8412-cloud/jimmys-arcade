/* Theme registry.
   A theme is one object passed to HM.registerTheme():
     id       unique string
     name     shown in the picker
     accent   CSS color; tints the board, keyboard and buttons
     render(stage, outcome)  -> SVG markup for a 240x220 viewBox.
              stage 0..6 (6 = out of guesses); outcome is null, "win" or "lose".
     css      optional CSS (keyframes etc.), injected once. Prefix class names with the theme id.
   Animation convention: an element's resting style is its FINAL pose and keyframes run
   "from" the starting pose. With reduced motion (animations off) the end picture still shows.
   Shared chalk classes (see style.css): .c chalk line, .d dim line, .a accent line,
   .fc chalk fill, .fa accent fill, .fb board fill, .t chalk text.
   To add a theme: drop a file in js/themes/, add its <script> tag to index.html and its path to sw.js. */
window.HM = window.HM || {};
HM.themes = [];

HM.registerTheme = function (theme) {
  if (HM.themes.some(t => t.id === theme.id)) return;
  HM.themes.push(theme);
  if (theme.css) {
    const style = document.createElement("style");
    style.dataset.theme = theme.id;
    style.textContent = theme.css;
    document.head.appendChild(style);
  }
};

HM.getTheme = id => HM.themes.find(t => t.id === id) || HM.themes[0];

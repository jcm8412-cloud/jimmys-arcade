# Chalkboard Hangman

A Hangman game for kids that plays like an app on phones and tablets. It installs to the home screen, works offline, and needs no account or server. Plain HTML, CSS and JavaScript with no build step.

- **Single Player:** Easy, Medium, Hard and Impossible. Impossible is "evil hangman": the computer keeps switching words to dodge your guesses, but always fairly.
- **Multiplayer:** pass-and-play on one device for 2–6 players. Players take turns as Word Master.
- **Six picture themes** plus Random: Classic, Snowman, Balloons, Monster, Pumpkin and Rocket.

## Hosting it on GitHub Pages

1. Create a new GitHub repository (for example `hangman`) and push this folder's contents to it, so `index.html` sits at the repository root.
2. On GitHub, open the repository's **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to *Deploy from a branch*, pick `main` and the `/ (root)` folder, then **Save**.
4. After a minute the game is live at `https://<your-username>.github.io/hangman/`.

Any static host works the same way (Netlify, Cloudflare Pages, your own server). It needs HTTPS for the offline mode and install to work. All paths are relative, so it also runs from a sub-folder.

> Don't put these files in a repository that sends `*.woff2` or `*.png` through Git LFS: GitHub Pages serves LFS pointer files instead of the real fonts and icons.

## Adding it to a home screen

Open the game's web address once while online so it can save itself for offline play.

**iPhone / iPad (Safari)**
1. Open the address in **Safari**.
2. Tap the **Share** button (the square with an arrow).
3. Scroll down and tap **Add to Home Screen**, then **Add**.

**Android (Chrome)**
1. Open the address in **Chrome**.
2. Tap the **⋮** menu.
3. Tap **Install app** (on some phones it says **Add to Home screen**), then confirm.

It now opens full-screen from its icon, and it keeps working with airplane mode on.

## Running it locally

Service workers need `http://`, so opening `index.html` straight from disk works for play but not for offline/install. Serve the folder with any static server, for example:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.

## Updating the game

The service worker serves everything from its cache. After changing **any** file, bump the version in `sw.js`:

```js
const CACHE = "hangman-v2"; // was hangman-v1
```

Installed copies pick up the new version the next time they're opened online (close and reopen once more to see it).

If you add a new file, also add its path to the `FILES` list in `sw.js`.

## Files

| Path | What it is |
|---|---|
| `index.html` | All screens (menu, levels, game, multiplayer, settings) |
| `css/style.css` | Chalkboard look, layout, shared chalk classes for theme drawings |
| `js/engine.js` | Game rules with no DOM: normal words and Impossible's evil hangman |
| `js/app.js` | Screens, settings, stats, single player, multiplayer, save/resume |
| `js/words.js` | Single-player word lists by level and category |
| `js/impossible-words.js` | Impossible mode word pool, grouped by length (8, 9 and 10 letters) |
| `js/themes/*.js` | One file per picture theme, plus `registry.js` |
| `sw.js`, `manifest.json`, `icons/` | Offline support and home-screen install |
| `fonts/` | Gochi Hand and Patrick Hand (SIL Open Font License, see the `OFL-*.txt` files) |

Settings, stats and a multiplayer game in progress are saved in the browser's `localStorage`.

## Adding a picture theme

Copy one of the files in `js/themes/` and change it. A theme is one object:

```js
HM.registerTheme({
  id: "dragon",            // unique id
  name: "Dragon",          // shown in the picker
  accent: "#c9a0ff",       // tints the board, keys and buttons
  optional: [2, 5],        // the 2 of its 8 stages that are small optional details
  render(view, outcome) {  // SVG markup for a 240×220 picture
    // view.has(n): stage n (1..8) has happened; view.last: the stage this miss added;
    // view.core: non-optional stages so far (0..6). outcome is null, "win" or "lose".
    return `<circle class="c" cx="120" cy="110" r="${20 + view.core * 10}"/>`;
  },
  css: `/* optional keyframes; prefix class names with the theme id */`
});
```

Every theme has 8 stages, and each wrong guess adds exactly one:

- **Easy** allows 8 wrong guesses and uses all 8 stages.
- **Medium, Hard, Impossible and multiplayer** allow 6 wrong guesses and skip the theme's 2 `optional` stages. Those skipped details are never drawn in those games.

Either way, the last allowed miss lands on the final stage, and the picture starts with nothing added.

Then add a `<script src="js/themes/dragon.js">` tag in `index.html` (before `js/app.js`) and the path to `FILES` in `sw.js`. The game logic doesn't need to change.

Drawing tips: use the shared chalk classes `c` (chalk line), `d` (dim line), `a` (accent line), `thin`, `fc`/`fa`/`fb` (chalk/accent/board fill) and `t` (text). For animations, make an element's normal style its **final** pose and animate *from* the start. That way people with reduced motion turned on still see the finished picture. Keep win and loss animations under 1.5 seconds.

## Multiplayer scoring

- A guesser gets **+1** for each correct letter they guess, however many times it appears.
- The guesser who reveals the last letter gets **+3** more.
- The Word Master gets **+2** if the guessers run out of wrong guesses.

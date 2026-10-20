# Jimmy's Arcade

A collection of chalkboard games for kids that plays like an app on phones and tablets. It installs to the home screen, works offline, and needs no account or server. Plain HTML, CSS and JavaScript with no build step.

- **Hangman:**
  - Single player has four levels: Easy, Medium, Hard and Impossible ("evil hangman").
  - Multiplayer is pass-and-play: a Word Master picks the word and everyone else guesses.
- **Silly Stories, Connect Four, Tic-Tac-Toe:** coming soon.
- **Shared by every game:**
  - player profiles with chalk avatars
  - settings (sound, vibration, read-aloud, reset stats)
  - picture themes (Classic, Snowman, Balloons, Monster, Pumpkin, Rocket, Random)
  - a "Pass the phone to…" screen

## Hosting it on GitHub Pages

1. Push this folder to a GitHub repository (for example `jimmys-arcade`), so `index.html` sits at the repository root.
2. On GitHub, open the repository's **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to *Deploy from a branch*, pick `main` and the `/ (root)` folder, then **Save**.
4. After a minute the arcade is live at `https://<your-username>.github.io/jimmys-arcade/`.

Any static host works the same way. It needs HTTPS for the offline mode and install to work. All paths are relative, so it also runs from a sub-folder. Free GitHub accounts can only use Pages on public repositories.

> Don't put these files in a repository that sends `*.woff2` or `*.png` through Git LFS: GitHub Pages serves LFS pointer files instead of the real fonts and icons.

## Adding it to a home screen

Open the arcade's web address once while online so it can save itself for offline play.

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

Service workers need `http://`, so serve the folder with any static server, for example:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.

## Updating the arcade

The service worker serves everything from its cache. After changing **any** file, bump the version in `sw.js`:

```js
const CACHE = "jimmys-arcade-v4"; // was jimmys-arcade-v3
```

Installed copies pick up the new version the next time they're opened online (close and reopen once more to see it).

Game files are cached automatically from `games/index.js`. If you add a file to the **shell** (`shell/` or `icons/`), also add it to `SHELL_FILES` in `sw.js`.

## Files

| Path | What it is |
|---|---|
| `index.html` | The shell's screens: home, players, settings, who's playing, pass the phone |
| `shell/shell.js` | Home screen, players, settings, sound, dialogs, pass screen, player picker, game loading |
| `shell/storage.js` | Saved data under the `jimmys-arcade:` prefix, plus the one-time move of old Hangman data |
| `shell/avatars.js` | The 12 chalk player avatars |
| `shell/themes/*.js` | Picture themes, one file each, plus `registry.js` |
| `shell/style.css` | Chalkboard look and shared components |
| `games/index.js` | The list of games, one line each |
| `games/hangman/` | Hangman: rules (`engine.js`), word lists, screens (`game.js`) and styles |
| `games/*/game.js` | Coming-soon placeholders for the other games |
| `sw.js`, `manifest.json`, `icons/` | Offline support and home-screen install |
| `fonts/` | Gochi Hand and Patrick Hand (SIL Open Font License, see the `OFL-*.txt` files) |

## Saved data

Everything is saved in the browser's `localStorage` under keys starting with `jimmys-arcade:`:

- `settings`, `players`, `lastPlayer`, `lastTheme`
- `hangman:stats`: per-player wins and streaks
- `hangman:mp`: a multiplayer game in progress
- `hangman:lastWords` and `hangman:lastSetup`

The first time the arcade opens on a device that had the old stand-alone Hangman, it moves that app's `hm.*` data over:

- settings and the game in progress carry over
- the old stats go to a new player, whom the arcade asks you to name

## Adding a game

1. Create `games/<name>/` with a `game.js` that calls `Arcade.registerGame({...})`:

   ```js
   Arcade.registerGame({
     id: "my-game", name: "My Game", accent: "#9fd3e8",
     icon: `<circle cx="24" cy="24" r="14"/>`,      // chalk drawing in a 48×48 box; class="acc" uses the accent
     open() { /* show the game's menu (build screens into #game-root with class "screen") */ },
     tileStat(playerId) { return "Wins: 3"; },        // optional: text on the home tile
     resetStats() {}, forgetPlayer(id) {}, autoResume() { return false; }  // optional
   });
   ```

2. Add one line for it to `games/index.js`, listing its files in load order.

Games use the shell through `Arcade.*`:

| Helper | What it does |
|---|---|
| `store` | Saved data |
| `settings` | Sound, vibration, read-aloud and theme settings |
| `whoIsPlaying()` | Asks who's playing a single-player game |
| `playerPicker()` | The multiplayer setup's player list |
| `pass()` | The "Pass the phone to…" screen |
| `confirm()`, `toast()` | In-app "Are you sure?" dialog and short messages |
| `sfx`, `buzz()` | Sound effects and vibration |
| `themeView()`, `themeSvg()`, `buildThemePicker()` | Picture themes |

Give every game screen a Home button in the top-left corner (`<button class="icon-btn" data-home aria-label="Home"></button>`). Scope the game's CSS under its own class, the way `.hm` does for Hangman.

## Adding a picture theme

Copy one of the files in `shell/themes/` and change it. A theme is one object:

```js
Arcade.registerTheme({
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

- Easy Hangman allows 8 wrong guesses and uses all 8 stages.
- Games that allow 6 wrong guesses skip the theme's 2 `optional` stages.

Either way, the last allowed miss lands on the final stage, and the picture starts with nothing added.

Then add a `<script src="shell/themes/dragon.js">` tag in `index.html` (before `shell/shell.js`) and the path to `SHELL_FILES` in `sw.js`.

Drawing tips:
- **Chalk classes:**
  - `c` is a chalk line, `d` a dim line and `a` an accent line; `thin` makes any of them thinner.
  - `fc`, `fa` and `fb` fill with chalk, accent or board color.
  - `t` is chalk text.
- **Animations:** make an element's normal style its **final** pose and animate *from* the start. That way people with reduced motion turned on still see the finished picture. Keep win and loss animations under 1.5 seconds.

## Hangman multiplayer scoring

- A guesser gets **+1** for each correct letter they guess, however many times it appears.
- The guesser who reveals the last letter gets **+3** more.
- The Word Master gets **+2** if the guessers run out of wrong guesses.

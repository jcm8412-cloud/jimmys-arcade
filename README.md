# Jimmy's Arcade

A collection of chalkboard games for kids that plays like an app on phones and tablets. It installs to the home screen, works offline, and needs no account or server. Plain HTML, CSS and JavaScript with no build step.

- **Hangman:**
  - Single player has four levels: Easy, Medium, Hard and Impossible ("evil hangman").
  - Multiplayer is pass-and-play: a Word Master picks the word and everyone else guesses.
- **Silly Stories:** fill in words without seeing the story, then reveal it and have it read aloud.
  - Play solo, or pass-and-play for 2–6 players.
  - Save favorites to reread later.
- **Connect Four:** play the computer at four levels, or two players on one phone.
  - Undo is unlimited on Easy, 3 per game on Medium, and off on Hard and Impossible.
- **Tic-Tac-Toe:** play the computer at four levels, or two players on one phone.
  - Choose X or O, and play one game, best of 3 or best of 5.
  - Impossible never loses, so tying it is the bragging right.
- **Dots and Boxes:** play the computer at four levels, or pass-and-play for 2–4 players.
  - Four board sizes, from Small 3×3 to Huge 6×6.
  - A game in progress is saved and resumed.
- **Chalk Snake:** classic Snake with power-up foods, a 2-player battle on one phone, and the daily twist.
- **Pong Party:** Pong with weird balls and power-ups.
  - Play the computer at four levels, or 2 players with the device flat between you.
  - 4 players on a tablet.
- **Brick Bash:** Breakout with 30 levels, boss monsters every 5th level, power-ups, and a level editor for the family's own levels.
- **Critter Crossing, Galaxy Defenders:** coming soon.
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
| `games/silly-stories/` | Silly Stories: screens (`game.js`), story templates (`stories.json`), word types and ideas (`words.js`) |
| `games/connect-four/` | Connect Four: rules and computer players (`ai.js`), screens (`game.js`) |
| `games/tic-tac-toe/` | Tic-Tac-Toe: rules and computer players (`ai.js`), screens (`game.js`) |
| `games/dots-and-boxes/` | Dots and Boxes: rules, chain analysis and computer players (`engine.js`), screens (`game.js`) |
| `shell/action.js`, `shell/action.css` | Shared kit for the action games: canvas loop, pause, countdown, swipes, high scores, daily twist |
| `games/chalk-snake/` | Chalk Snake |
| `games/pong-party/` | Pong Party |
| `games/brick-bash/` | Brick Bash (`levels.js` holds the 30 campaign levels) |
| `games/critter-crossing/`, `galaxy-defenders/` | Coming-soon placeholders |
| `sw.js`, `manifest.json`, `icons/` | Offline support and home-screen install |
| `fonts/` | Gochi Hand and Patrick Hand (SIL Open Font License, see the `OFL-*.txt` files) |

## Saved data

Everything is saved in the browser's `localStorage` under keys starting with `jimmys-arcade:`:

- `settings`, `players`, `lastPlayer`, `lastTheme`
- `hangman:stats`: per-player wins and streaks
- `hangman:mp`: a multiplayer game in progress
- `hangman:lastWords` and `hangman:lastSetup`
- `silly-stories:favorites`: up to 50 saved stories
- `silly-stories:stats`: stories made per player
- `silly-stories:recent` and `silly-stories:lastSetup`
- `connect-four:stats`: for each player, wins, losses and ties against each computer level and against each other player
- `connect-four:lastSetup`
- `tic-tac-toe:stats`: same shape as Connect Four's
- `tic-tac-toe:prefs`: X or O and match length
- `tic-tac-toe:lastSetup`
- `dots-and-boxes:game`: the game in progress, saved after every line
- `dots-and-boxes:stats`: for each player, wins, losses and ties against each level on each board size, pass-and-play wins, and most boxes in one game per board size
- `dots-and-boxes:prefs`, `dots-and-boxes:rotation` (who starts next) and `dots-and-boxes:lastSetup`
- `action:best`: action-game personal bests (game → level → player)
- `action:top`: each action game's household top 5 for each level
- `action:daily`: today's daily-twist top 5 (older days are dropped)
- `chalk-snake:battle`: battle wins per player
- `chalk-snake:prefs`: arrow pad on or off for each level, plus the last battle settings
- `chalk-snake:lastSetup`
- `pong-party:record`: wins and losses against each computer level, per player
- `pong-party:wins`: 2- and 4-player match wins per player
- `pong-party:lastSetup2` and `pong-party:lastSetup4`
- `brick-bash:progress`: the furthest campaign level each player has unlocked
- `brick-bash:prefs`: each player's last difficulty
- `brick-bash:levels`: up to 50 household levels from the editor, each with its maker and best score

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

## Adding a Silly Stories template

Add an object to `games/silly-stories/stories.json`:

```json
{
  "id": "museum",
  "title": "A Night at the Museum",
  "text": "Our class visited a museum full of {plural noun}. A {adjective} statue of {name of a person in the room|guide} waved at us..."
}
```

- `{type}` is a blank. The type must be one of the types in `words.js`, which hold each type's explanation and "Give me an idea" suggestions.
- `{type|key}` reuses one answer everywhere the same key appears, like a hero's name used three times.
- Aim for 6–10 words to fill in.
- "a" becomes "an" before a vowel automatically, and words at the start of a sentence are capitalized.
- Bump `CACHE` in `sw.js` so installed copies get the new story.

## Connect Four computer levels

| Level | How it plays |
|---|---|
| Easy | Random moves, but blocks an immediate win about half the time |
| Medium | Takes a win, blocks your win, otherwise plays near the center without handing you a win |
| Hard | Searches 5 moves ahead |
| Impossible | Searches as deep as it can in 0.5 seconds (usually 12–17 moves) |

How Impossible gets its strength:
- **Center-first move order:** it looks at center moves first, so it finds good moves sooner.
- **Position memory:** it remembers positions it has already analysed instead of working them out again.
- **Endgame threat rule:** it favours positions where its "almost four" threats sit on the right rows. The player who moved first wants them on odd rows, the second player on even rows.

With the short pause before it moves, the computer always answers in under a second.

## Tic-Tac-Toe rules

- You pick X or O for the first game. After that, players swap letters every game, so X always goes first and the first move alternates.
- Matches are one game, best of 3 or best of 5:
  - Ties count as games played.
  - A match ends early once the leader can't be caught.
  - If wins are level after the last game, the match is a tie.
- The computer levels:

| Level | How it plays |
|---|---|
| Easy | Random moves |
| Medium | Wins or blocks when it can, otherwise random |
| Hard | Perfect play 70% of the time, random otherwise |
| Impossible | Perfect play (full minimax), so it never loses. Tested against every possible game. |

## Dots and Boxes rules

- Players take turns drawing a line between two neighbouring dots.
- Drawing the fourth side of a box claims it and gives you another turn. Two boxes with one line still gives one extra turn.
- When every box is claimed, the most boxes wins. Equal top scores is a tie.
- Who goes first rotates each new game.

Undo against the computer is unlimited on Easy, 3 per game on Medium, and off on Hard and Impossible. It goes back to before your last line.

| Level | How it plays |
|---|---|
| Easy | Random lines, and takes a free box only about half the time. "Show safe moves" can mark the lines that don't give a box away. |
| Medium | Always takes free boxes; otherwise avoids drawing a box's third side when it can |
| Hard | Medium, plus when no safe lines are left it opens the smallest chain or loop |
| Impossible | Hard, plus chain control (details below). Stays within 350 ms per line. |

Impossible's chain control:
- **Endgame solver:** once no safe lines are left, it works out the exact best play for any shape of chains, loops and junctions.
- **Double-cross:** it declines the last 2 boxes of a chain, or the last 4 of a loop, when that keeps control.
- **Late safe moves:** it searches the last safe lines so that you're the one who has to open the first chain.

## Action games (6–10): the shared kit

`shell/action.js` gives every action game the same building blocks through `Arcade.Action`:

- **`createScreen({ id, cls, onRestart, onQuit, onResize })`:** the play screen.
  - Home sits top-left, the HUD in the middle and Pause top-right, with the canvas below.
  - The canvas is sized to the screen and kept sharp on high-resolution displays.
  - `start(update, render)` shows a 3-2-1 countdown, then runs `update(dt)` exactly 60 times per second of game time (the same speed on every device) and `render(alpha)` every frame.
  - The game pauses itself when the app goes to the background, with a Paused screen offering Resume, Restart and Home. Escape or P also pauses.
  - Page scrolling and zooming are blocked during play.
  - It also provides `message()`, `burst("New best!")` and `showPanel()`. A panel's `split` option rotates the top half to face a player across the table.
- **`swipes(element, { onSwipe, onTap })`:** swipe directions, re-armed during a long drag.
- **`scores`:** personal bests per player, game and level, plus a household top 5 per game and level and a separate top 5 for today's daily twist. Guests aren't saved.
- **`daily()`:** today's daily twist, worked out from the date so every device agrees. Only built action games take part: a game joins by listing `twists` when it registers. Its home tile shows a "Daily twist" badge through the optional `badge()` hook.
- **`chalkLine()`, `dust()`:** light chalk drawing and dust particles.

## Chalk Snake

| Level | Speed | Walls | Lives | Round |
|---|---|---|---|---|
| Easy | Slow | Wrap around | 3 | 2 minutes |
| Medium | Normal | Solid | 2 | 2 minutes |
| Hard | Fast | Solid | 1 | Until you crash |
| Impossible | Faster, speeding up as you grow | Solid | 1 | Until you crash |

- **Controls:** swipe anywhere, or use the arrow keys. A swipe straight back into yourself is ignored.
- **Arrow pad:** can be switched on for each level on the level screen. It starts on for Easy.
- **Foods:** apples appear all the time. Every so often a special food appears for 6 seconds:

| Food | Effect |
|---|---|
| Golden apple | +5 points and a 5-second slowdown |
| Chili pepper | 5-second speed burst with double points |
| Ghost pepper | Pass through your own tail for 5 seconds |
| Scissors | Tail 3 shorter |

- **Battle:**
  - Two players, with the phone flat between them.
  - Each player swipes on their own half, with directions from their side of the table. On a keyboard, the arrows steer one snake and WASD the other.
  - Pick a level (for speed and walls) and best of 3 or 5.
  - A head-on crash replays the round.
- **Daily twists:** runaway apples, a shrinking board, speedy apples, or portals. The twist plays at Medium settings with its own top 5 for the day.
- **Look:** the snake follows the picture theme: a pumpkin-headed snake, a snowball snake, balloon segments, and so on.

## Pong Party

- **Modes:**
  - Vs computer: you at the bottom.
  - 2 players: the device lies flat, and each player drags anywhere on their own half.
  - 4 players: tablets only, and the button is hidden on phones. Players sit bottom, top, left and right, and each has 3 lives. A player who's out becomes a wall, and the last one in wins.
- **Matches:** first to 7 points.
- **Controls:** multi-touch, so everyone plays at once. On a keyboard, the arrows move the bottom paddle and A/D the top one.
- **Computer levels:** the ball speeds up level by level, and the computer gets quicker and aims better:

| Level | How it plays |
|---|---|
| Easy | Slow ball, slow computer that misses about half its shots, and your paddle is longer |
| Medium | A fair match: the computer misses about 1 in 5 |
| Hard | Quick ball, sharper computer |
| Impossible | Very fast and very good, but it still misses now and then |

- **Weird balls:** about one point in three:
  - Splitter: splits into three on its first paddle hit.
  - Curveball: bends in an arc.
  - Speedster: 12% faster with every hit.
  - Ghost: invisible in the middle of the court.
- **Power-ups:** they float in the middle, and the last player to hit the ball collects them:
  - Big paddle (your own) or tiny paddles (everyone else's).
  - Shield: blocks one goal.
  - Freeze: everyone else's paddles slow down for 3 seconds.
  - Each lasts about 8 seconds, with a timer next to the paddle.
- **High score:** the longest rally (paddle hits in one point) against the computer, per player and level, with a household top 5. Wins and losses are kept too.
- **Daily twists:** two balls at once, shrinking paddles, or bumpers in the middle. The twist plays against the computer at Medium.
- **Look:** paddles follow the picture theme: a snowman paddle, a balloon paddle, a pumpkin paddle and so on, each outlined in its player's color.

## Brick Bash

- **Controls:** drag anywhere to move the paddle and tap to launch the ball. The aim arrow swings from side to side, and the ball goes where it points. On a keyboard, the arrows move and space launches (and fires lasers).
- **Campaign:** 30 hand-made chalk pictures, from a smiley and a rocket to a castle and a dino. Each player picks any level up to the furthest one they've reached. A run carries on level after level until the balls run out, and after each level you can keep going or stop and bank your score.
- **Levels of difficulty:** these change the ball speed, paddle size and lives, never the bricks:

| Level | Ball | Paddle | Lives |
|---|---|---|---|
| Easy | Slow | Big, with extra reach at the ends | 5 |
| Medium | Normal | Medium | 3 |
| Hard | Fast | Small | 3 |
| Impossible | Very fast | Tiny | 2 |

- **Bricks:** normal (one hit), tough (2 or 3 hits, cracking as they go), explosive (clears the bricks around it and sets off other explosive bricks), steel (can't be broken and is never needed to finish a level), and power-up bricks (marked with a star).
- **Power-ups**, caught with the paddle:
  - multi-ball
  - wide paddle
  - lasers for 8 seconds (tap to shoot)
  - sticky paddle (catches the ball so you can aim again)
  - slow ball
  - extra life
- **Bosses:** levels 5, 10, 15, 20, 25 and 30 are chalk monsters built from bricks. They slide side to side and drop slow blobs to dodge. Hitting the glowing weak spot takes a chunk off the health bar, and the weak spot jumps to one of the monster's eyes (the dark dots). On Easy and Medium a blob makes the paddle slow for a moment; on Hard and Impossible it costs a life.
- **Level editor:** pick a brick kind and tap or drag on the grid, then name and save the level. Saved levels show under **Our levels** with who made it and the best score on it, for everyone in the house. Up to 50 levels can be kept. **Try it** plays a level before saving it.
- **High score:** points in one campaign run, per player and difficulty, with a household top 5.
- **Daily twists:** the ball grows with every hit, every brick explodes, or the whole game is upside down with the paddle at the top. The twist runs the campaign from level 1 at Medium.
## Hangman multiplayer scoring

- A guesser gets **+1** for each correct letter they guess, however many times it appears.
- The guesser who reveals the last letter gets **+3** more.
- The Word Master gets **+2** if the guessers run out of wrong guesses.

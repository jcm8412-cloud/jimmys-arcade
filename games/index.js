/* The arcade's games, one line each, in home-screen order.
   folder: the game's folder under games/. files: what to load from it, in order. .js and .css files
   are loaded into the page; anything else (like .json data) is only cached for offline use and the
   game fetches it itself. The last .js file registers the game with Arcade.registerGame(). The service worker reads this
   list too, so a new game is cached for offline play without touching sw.js.
   To add a game: create games/<folder>/ and add one line here. */
(self.Arcade = self.Arcade || {}).GAME_LIST = [
  { folder: "hangman", files: ["hangman.css", "words.js", "impossible-words.js", "engine.js", "game.js"] },
  { folder: "silly-stories", files: ["silly-stories.css", "words.js", "stories.json", "game.js"] },
  { folder: "connect-four", files: ["connect-four.css", "ai.js", "game.js"] },
  { folder: "tic-tac-toe", files: ["tic-tac-toe.css", "ai.js", "game.js"] },
  { folder: "dots-and-boxes", files: ["dots-and-boxes.css", "engine.js", "game.js"] },
  { folder: "chalk-snake", files: ["chalk-snake.css", "game.js"] },
  { folder: "pong-party", files: ["pong-party.css", "game.js"] },
  { folder: "brick-bash", files: ["brick-bash.css", "levels.js", "game.js"] },
  { folder: "critter-crossing", files: ["critter-crossing.css", "missions.js", "game.js"] },
  { folder: "galaxy-defenders", files: ["galaxy-defenders.css", "game.js"] },
  { folder: "toy-tower", files: ["toy-tower.css", "config.js", "test-level.json", "garage.json", "store.json", "backyard.json", "game.js"] }
];

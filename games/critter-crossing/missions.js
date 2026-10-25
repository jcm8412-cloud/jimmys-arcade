/* Critter Crossing rescue missions, easiest first. lanes: one letter per row from the start upwards
   (g grass, r road, w river, t train track); the finish line comes after the last row.
   goal: "home" (pick up the baby critter on the way and bring it to the finish), "stars" (collect
   every star, then reach the finish) or "letter" (hop onto the mailbox on the finish line).
   weather: "sunny" (default), "rain", "fog" or "night". */
window.CC = window.CC || {};

CC.MISSIONS = [
  { name: "Baby Steps", goal: "home", lanes: "gggrrggggrrgg", story: "A baby critter hopped too far. Carry it home!" },
  { name: "Star Meadow", goal: "stars", stars: 3, lanes: "ggrgggrrggrgg", story: "Collect all 3 stars, then reach the flag." },
  { name: "Special Delivery", goal: "letter", lanes: "gggrrrggwwgggrrg", story: "Take the letter to the mailbox across town." },
  { name: "Duckling Dash", goal: "home", lanes: "ggwwggrrggwwwgg", story: "A little one is stuck across the river." },
  { name: "Shiny Stars", goal: "stars", stars: 4, lanes: "ggrrgwwgrrgwwgg", story: "Four stars are hiding by the river." },
  { name: "Train Time", goal: "letter", lanes: "ggtggrrgtgrrrgg", story: "Watch for the red light: trains are coming!" },
  { name: "Rainy Rescue", goal: "home", weather: "rain", lanes: "ggwwwgrrgwwwggrrgg", story: "It's pouring. Logs are slippery!" },
  { name: "Foggy Stars", goal: "stars", stars: 4, weather: "fog", lanes: "ggrrrggttgrrrggwwgg", story: "Cars hide in the fog until they're close." },
  { name: "Night Mail", goal: "letter", weather: "night", lanes: "ggrrgwwwgrrrgtgg", story: "Follow the headlights in the dark." },
  { name: "Big River", goal: "home", lanes: "ggwwwwgwwwwgrrgg", story: "The widest river in town." },
  { name: "Rush Hour", goal: "stars", stars: 5, lanes: "ggrrrrgrrrrgrrrrgg", story: "Everyone is driving home at once!" },
  { name: "Railway Run", goal: "letter", lanes: "ggttgttgrrtgttgg", story: "So many train tracks!" },
  { name: "Stormy Crossing", goal: "home", weather: "rain", lanes: "ggrrwwwgttrrwwwgg", story: "Rain, rivers and trains." },
  { name: "Midnight Stars", goal: "stars", stars: 5, weather: "night", lanes: "ggrrwwgttgrrrwwwgg", story: "Find five stars in the dark." },
  { name: "Across Town", goal: "letter", weather: "fog", lanes: "ggrrrgwwwgttgrrrrgwwwwgg", story: "The longest trip of all." }
];

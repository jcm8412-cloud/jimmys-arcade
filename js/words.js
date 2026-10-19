/* Single-player word lists: difficulty -> category -> words.
   Easy 3–4 letters, Medium 5–7, Hard 8+. All kid-appropriate. */
window.HM = window.HM || {};

HM.WORDS = {
  easy: {
    Animals: ["cat", "dog", "cow", "pig", "fox", "owl", "frog", "duck", "bear", "fish", "lion", "goat",
      "hen", "bee", "ant", "bat", "crab", "deer", "seal", "worm", "yak", "emu", "mole", "toad", "wolf", "lamb", "calf"],
    Food: ["cake", "pie", "egg", "milk", "corn", "rice", "soup", "taco", "plum", "pear", "bun", "jam",
      "nut", "bean", "lime", "kiwi", "fig", "tea", "yam", "pea", "ham"],
    Places: ["zoo", "farm", "park", "pond", "lake", "shop", "city", "town", "home", "yard", "barn",
      "hill", "cave", "sea", "bay", "gym", "camp", "road", "pool"],
    Things: ["bed", "cup", "door", "lamp", "sock", "hat", "bag", "box", "key", "mop", "rug", "sink",
      "tub", "fork", "ball", "kite", "drum", "bell", "boat", "car", "bus", "pen", "toy", "map"]
  },
  medium: {
    Animals: ["tiger", "zebra", "horse", "shark", "snake", "rabbit", "turtle", "monkey", "panda", "whale",
      "eagle", "spider", "parrot", "kitten", "puppy", "camel", "koala", "otter", "donkey", "lizard",
      "beaver", "badger", "goose", "moose", "sheep", "llama", "walrus", "jaguar"],
    Food: ["pizza", "apple", "banana", "cookie", "muffin", "pancake", "cheese", "carrot", "grapes",
      "burger", "noodle", "waffle", "popcorn", "pretzel", "cherry", "lemon", "mango", "peach",
      "potato", "tomato", "yogurt", "butter", "cereal", "salad"],
    Places: ["garden", "bridge", "castle", "forest", "beach", "river", "school", "market", "island",
      "desert", "jungle", "library", "museum", "harbor", "village", "meadow", "canyon", "airport", "bakery"],
    Things: ["rocket", "planet", "rainbow", "snowman", "pumpkin", "tractor", "bicycle", "pencil", "guitar",
      "crayon", "blanket", "pillow", "ladder", "bucket", "robot", "hammer", "candle", "mitten", "scarf"]
  },
  hard: {
    Animals: ["elephant", "kangaroo", "flamingo", "squirrel", "alligator", "butterfly", "porcupine",
      "chameleon", "hedgehog", "crocodile", "tortoise", "reindeer", "antelope", "armadillo", "platypus",
      "woodpecker", "jellyfish", "caterpillar", "grasshopper", "salamander"],
    Food: ["spaghetti", "pineapple", "sandwich", "broccoli", "blueberry", "watermelon", "strawberry",
      "marshmallow", "cucumber", "zucchini", "meatball", "lollipop", "raspberry", "chocolate",
      "cheesecake", "applesauce", "cauliflower"],
    Places: ["playground", "classroom", "aquarium", "hospital", "mountain", "waterfall", "lighthouse",
      "farmhouse", "restaurant", "supermarket", "backyard", "treehouse", "rainforest", "bookstore", "campground"],
    Things: ["dinosaur", "astronaut", "treasure", "telescope", "submarine", "skateboard", "trampoline",
      "calendar", "umbrella", "notebook", "backpack", "sunflower", "snowflake", "helicopter", "keyboard",
      "toothbrush", "envelope"]
  }
};

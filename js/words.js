/* Single-player word lists: difficulty -> category -> words.
   Easy: very common 5–6 letter words a young kid can spell. Medium 5–7, Hard 8+. All kid-appropriate. */
window.HM = window.HM || {};

HM.WORDS = {
  easy: {
    Animals: ["puppy", "kitten", "tiger", "horse", "mouse", "sheep", "zebra", "panda", "rabbit", "monkey",
      "snake", "whale", "shark", "bunny", "goose", "turtle", "spider", "donkey", "parrot", "camel"],
    Food: ["apple", "pizza", "bread", "candy", "grape", "lemon", "melon", "peach", "salad", "pasta",
      "juice", "honey", "toast", "cookie", "banana", "carrot", "cheese", "butter", "cherry", "muffin"],
    Places: ["house", "beach", "river", "school", "store", "field", "ocean", "garden", "forest", "island",
      "castle", "jungle", "street", "bridge", "market", "planet"],
    Things: ["chair", "table", "clock", "train", "truck", "plane", "robot", "paper", "pencil", "crayon",
      "piano", "water", "rocket", "button", "jacket", "bucket", "ladder", "pillow", "window", "flower"]
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

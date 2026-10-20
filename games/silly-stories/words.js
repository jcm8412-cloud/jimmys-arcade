/* Silly Stories word types: the kid-friendly explanation, three examples, and the clean
   "Give me an idea" suggestions for each blank type used in stories.json. */
window.SS = window.SS || {};

SS.TYPES = {
  "noun": {
    label: "Noun", explain: "a person, place, or thing", examples: ["sock", "pickle", "trampoline"],
    ideas: ["sock", "pickle", "trampoline", "toaster", "banana", "rubber duck", "pillow", "spoon", "kazoo", "backpack",
      "umbrella", "bathtub", "unicycle", "cupcake", "flip-flop", "tuba", "lunchbox", "snow globe", "toothbrush", "bucket"]
  },
  "plural noun": {
    label: "Plural noun", explain: "more than one thing", examples: ["socks", "pickles", "bananas"],
    ideas: ["socks", "pickles", "bananas", "marshmallows", "rubber ducks", "pillows", "spoons", "jelly beans", "noodles",
      "balloons", "crayons", "meatballs", "toothbrushes", "googly eyes", "pancakes", "buttons", "teddy bears", "paper clips", "bubbles", "tacos"]
  },
  "verb": {
    label: "Verb", explain: "an action word", examples: ["jump", "wiggle", "sneeze"],
    ideas: ["jump", "wiggle", "sneeze", "hop", "dance", "giggle", "skip", "burp", "tiptoe", "cartwheel", "waddle", "spin",
      "yodel", "juggle", "moonwalk", "gallop", "somersault", "whistle", "flap", "bounce"]
  },
  "verb ending in -ing": {
    label: "Verb ending in -ing", explain: "an action word that ends in -ing", examples: ["dancing", "burping", "hopping"],
    ideas: ["dancing", "burping", "hopping", "giggling", "wiggling", "sneezing", "skipping", "yodeling", "juggling", "waddling",
      "tiptoeing", "spinning", "bouncing", "moonwalking", "galloping", "snoring", "whistling", "cartwheeling", "flapping", "hiccuping"]
  },
  "adjective": {
    label: "Adjective", explain: "a describing word", examples: ["stinky", "huge", "sparkly"],
    ideas: ["stinky", "huge", "sparkly", "tiny", "fuzzy", "slimy", "grumpy", "wobbly", "squishy", "enormous", "sleepy",
      "bouncy", "sticky", "fluffy", "goofy", "shiny", "crunchy", "jiggly", "itchy", "magnificent"]
  },
  "animal": {
    label: "Animal", explain: "any kind of animal", examples: ["llama", "octopus", "hamster"],
    ideas: ["llama", "octopus", "hamster", "giraffe", "penguin", "sloth", "kangaroo", "flamingo", "hippo", "platypus",
      "walrus", "chicken", "goat", "narwhal", "hedgehog", "moose", "koala", "raccoon", "jellyfish", "armadillo"]
  },
  "food": {
    label: "Food", explain: "something you can eat", examples: ["spaghetti", "pickles", "cupcakes"],
    ideas: ["spaghetti", "pickles", "cupcakes", "broccoli", "pizza", "tacos", "pancakes", "meatballs", "jelly", "popcorn",
      "mac and cheese", "waffles", "cheese", "applesauce", "nachos", "pudding", "ketchup", "marshmallows", "peanut butter", "grapes"]
  },
  "body part": {
    label: "Body part", explain: "a part of your body", examples: ["elbow", "nose", "big toe"],
    ideas: ["elbow", "nose", "big toe", "knee", "belly button", "ear", "eyebrow", "chin", "pinky finger", "heel",
      "forehead", "ankle", "shoulder", "thumb", "cheek", "tongue", "knuckle", "wrist", "tummy", "hair"]
  },
  "place": {
    label: "Place", explain: "somewhere you can go", examples: ["the moon", "a bakery", "the bathtub"],
    ideas: ["the moon", "a bakery", "the bathtub", "the zoo", "Antarctica", "the library", "a volcano", "the beach",
      "the playground", "a castle", "the North Pole", "the jungle", "the grocery store", "outer space", "a treehouse",
      "under the sea", "a haunted house", "grandma's kitchen", "the dentist", "a pumpkin patch"]
  },
  "number": {
    label: "Number", explain: "any number at all", examples: ["7", "100", "a million"],
    ideas: ["7", "100", "a million", "3", "42", "12", "99", "a zillion", "1,000", "5", "eleventy", "8", "64", "two hundred",
      "1", "a gazillion", "17", "30", "a bajillion", "500"]
  },
  "silly word": {
    label: "Silly word", explain: "a made-up or funny word", examples: ["gobbledygook", "snorkelwump", "bloop"],
    ideas: ["gobbledygook", "snorkelwump", "bloop", "flibbertigibbet", "kerfuffle", "wigglebottom", "zoinks", "bamboozle",
      "snickerdoodle", "fuzzbucket", "noodlehead", "razzmatazz", "boogaloo", "jibberjabber", "doodlebug", "wobblegong",
      "fiddlesticks", "shnoz", "bippity", "hullabaloo"]
  },
  "color": {
    label: "Color", explain: "any color", examples: ["purple", "sparkly gold", "lime green"],
    ideas: ["purple", "sparkly gold", "lime green", "hot pink", "orange", "polka-dot", "rainbow", "silver", "turquoise",
      "neon yellow", "red", "sky blue", "glow-in-the-dark", "brown", "lavender", "striped", "maroon", "teal", "mint green", "black"]
  },
  "name of a person in the room": {
    label: "Name of a person in the room", explain: "someone who's here right now", examples: ["Mom", "Grandpa", "your best friend"],
    ideas: ["Mom", "Dad", "Grandma", "Grandpa", "Auntie", "Uncle Bob", "the baby", "the dog", "my sister", "my brother"]
  },
  "sound": {
    label: "Sound", explain: "a noise something makes", examples: ["boing", "kaboom", "squeak"],
    ideas: ["boing", "kaboom", "squeak", "splat", "honk", "zoom", "moo", "ka-pow", "fizz", "thud", "ding-dong", "whoosh",
      "oink", "beep beep", "pop", "sploosh", "brrrring", "quack", "clang", "ribbit"]
  },
  "exclamation": {
    label: "Exclamation", explain: "something you shout", examples: ["Yikes", "Hooray", "Holy guacamole"],
    ideas: ["Yikes", "Hooray", "Holy guacamole", "Whoa", "Oh my goodness", "Wowzers", "Jeepers", "Yippee", "Uh-oh",
      "Galloping gophers", "Hot diggity dog", "Oh no", "Woo-hoo", "Shazam", "Cowabunga", "Golly", "Oopsie daisy",
      "Bingo", "Ta-da", "Good grief"]
  }
};

SS.MAX_WORD = 20;

/* A basic kid-safety net for typed words: if a word contains anything on this list it is quietly
   swapped for a silly word. It can't catch everything; it's here to stop the obvious ones. */
// Roots that are only ever rude: blocked anywhere inside a word.
SS.BLOCKED_ROOTS = ["fuck", "shit", "bitch", "cunt", "nigg", "porn", "asshole", "whore", "slut"];
// Words blocked only on their own (so "peacock", "skillet" or "scrap" are fine).
SS.BLOCKED_WORDS = ["dick", "cock", "pussy", "piss", "crap", "crappy", "damn", "fag", "retard", "boob", "penis",
  "vagina", "sex", "sexy", "nazi", "kill", "killed", "suicide", "bastard", "ass", "butthole"];
SS.isBlocked = function (word) {
  const text = String(word).toLowerCase();
  const squashed = text.replace(/[^a-z]/g, "");
  if (SS.BLOCKED_ROOTS.some(b => squashed.includes(b))) return true;
  return text.split(/[^a-z]+/).some(t => t && SS.BLOCKED_WORDS.some(b => t === b || t === b + "s" || t === b + "es"));
};

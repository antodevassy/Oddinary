/**
 * ODDINARY - Categorized Word Pairs Dataset & Selection Engine
 * Duplicate-word protection across rounds with session persistence
 */

const CATEGORY_ICONS = {
  all: '<path fill="#6BCF2D" d="M4 11h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1zm10 0h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1zM4 21h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1zm10 0h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1z"/>',
  food: '<path fill="#6BCF2D" d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.55 3.89 3.56 4.25V22h2.88v-8.75C11.45 12.89 13 11.12 13 9V2h-2v7zm8-7h-2c-1.1 0-2 .9-2 2v6h2v12h2V2z"/>',
  animals: '<path fill="#6BCF2D" d="M4.5 10.5L7 3.5c.3-.8 1.4-.8 1.7 0l1.8 5c.4-.2.9-.3 1.5-.3s1.1.1 1.5.3l1.8-5c.3-.8 1.4-.8 1.7 0l2.5 7c.4 1.1.2 2.3-.4 3.2C18 15.3 15.2 17 12 17s-6-1.7-7.1-3.3c-.6-.9-.8-2.1-.4-3.2zm7.5 4.5c1.4 0 2.5-.7 2.5-1.5S13.4 12 12 12s-2.5.7-2.5 1.5.7 1.5 2.5 1.5z"/>',
  objects: '<path fill="#6BCF2D" d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/>',
  nature: '<path fill="#6BCF2D" d="M12 2L4 14h3v7h10v-7h3L12 2zm-1 17H9v-3h2v3zm4 0h-2v-3h2v3z"/>',
  places: '<path fill="#6BCF2D" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>',
  vehicles: '<path fill="#6BCF2D" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>'
};

const WORD_CATEGORIES = {
  food: {
    name: "Food & Drinks",
    icon: "🍕",
    pairs: [
      ["Pizza", "Burger"], ["Coffee", "Tea"], ["Donut", "Cupcake"], ["Cookie", "Brownie"],
      ["Ice cream", "Cake"], ["Chocolate", "Candy"], ["Pepsi", "Fanta"], ["Milk", "Juice"],
      ["Pasta", "Noodles"], ["Butter", "Cheese"], ["Apple", "Orange"], ["Banana", "Mango"],
      ["Cherry", "Strawberry"], ["Watermelon", "Pumpkin"], ["Carrot", "Potato"], ["Garlic", "Onion"],
      ["Honey", "Jam"], ["Salt", "Sugar"], ["Salt", "Pepper"], ["Bread", "Toast"],
      ["Rice", "Wheat"], ["Sandwich", "Burger"], ["Soda", "Lemonade"], ["Almond", "Cashew"],
      ["Yogurt", "Ice cream"], ["Idli", "Dosa"], ["Butter", "Ghee"], ["Milk", "Curd"],
      ["Omelette", "Boiled Egg"], ["Puri", "Paratha"], ["Pineapple", "Papaya"], ["Cheese", "Paneer"],
      ["French Fries", "Potato Chips"], ["Cotton Candy", "Lollipop"], ["Ketchup", "Mayonnaise"]
    ]
  },
  nature: {
    name: "Nature & Weather",
    icon: "🌲",
    pairs: [
      ["Sun", "Moon"], ["Moon", "Star"], ["Lightning", "Thunder"], ["Cloud", "Fog"],
      ["Rain", "Snow"], ["River", "Lake"], ["Ocean", "Sea"], ["Desert", "Beach"],
      ["Fire", "Smoke"], ["Mountain", "Hill"], ["Tree", "Plant"], ["Flower", "Leaf"],
      ["Earthquake", "Tsunami"], ["Wind", "Storm"], ["Sunrise", "Sunset"], ["Waterfall", "Fountain"],
      ["Shadow", "Reflection"]
    ]
  },
  animals: {
    name: "Animals & Creatures",
    icon: "🦁",
    pairs: [
      ["Dog", "Cat"], ["Kitten", "Puppy"], ["Lion", "Tiger"], ["Dolphin", "Whale"],
      ["Owl", "Eagle"], ["Goat", "Sheep"], ["Cow", "Goat"], ["Horse", "Donkey"],
      ["Giraffe", "Zebra"], ["Spider", "Ant"], ["Spider", "Scorpion"], ["Snake", "Lizard"],
      ["Fish", "Crab"], ["Jellyfish", "Starfish"], ["Ghost", "Zombie"], ["Dragon", "Dinosaur"],
      ["Mosquito", "Housefly"], ["Frog", "Toad"], ["Duck", "Goose"], ["Bee", "Wasp"],
      ["Fox", "Wolf"], ["Butterfly", "Moth"], ["Turtle", "Tortoise"], ["Octopus", "Squid"],
      ["Swan", "Flamingo"], ["Goldfish", "Shark"], ["Crab", "Prawn"]
    ]
  },
  objects: {
    name: "Everyday Objects",
    icon: "🎒",
    pairs: [
      ["Pen", "Pencil"], ["Marker", "Crayon"], ["Marker", "Chalk"], ["Toothbrush", "Toothpaste"],
      ["Nail", "Hammer"], ["Spoon", "Fork"], ["Knife", "Scissors"], ["Matchstick", "Lighter"],
      ["Clock", "Watch"], ["Smartphone", "Smartwatch"], ["Radio", "TV"], ["Speaker", "Headphones"],
      ["Book", "Notebook"], ["Glasses", "Sunglasses"], ["Shirt", "T-Shirt"], ["Shirt", "Jacket"],
      ["Jacket", "Sweater"], ["Raincoat", "Umbrella"], ["Shoes", "Sneakers"], ["Shoes", "Slippers"],
      ["Socks", "Shoes"], ["Gloves", "Mittens"], ["Hat", "Cap"], ["Hat", "Helmet"],
      ["Scarf", "Muffler"], ["Ring", "Bracelet"], ["Necklace", "Earrings"], ["Wallet", "Purse"],
      ["Pillow", "Blanket"], ["Chair", "Sofa"], ["Chair", "Stool"], ["Desk", "Table"],
      ["Door", "Gate"], ["Window", "Balcony"], ["Fridge", "Freezer"], ["Cupboard", "Drawer"],
      ["Shower", "Tap"], ["Broom", "Mop"], ["Candle", "Lamp"], ["Key", "Lock"],
      ["Cellotape", "Glue"], ["Rope", "String"], ["Zip", "Button"], ["Mug", "Glass"],
      ["Cup", "Bowl"], ["Plate", "Dish"], ["Ladder", "Stairs"], ["Elevator", "Escalator"],
      ["Keyboard", "Mouse"], ["Fan", "Air Conditioner"], ["Soap", "Bodywash"],
      ["Crayon", "Color Pencil"], ["Bubble", "Balloon"], ["Mustache", "Beard"]
    ]
  },
  vehicles: {
    name: "Vehicles & Travel",
    icon: "🚗",
    pairs: [
      ["Car", "Bus"], ["Bus", "Train"], ["Cycle", "Bike"], ["Boat", "Ship"],
      ["Airplane", "Helicopter"], ["Taxi", "Auto"], ["Ambulance", "Firetruck"],
      ["Rocket", "Satellite"], ["Rocket", "Missile"], ["Submarine", "Ship"],
      ["Bicycle", "Tricycle"]
    ]
  },
  places: {
    name: "Places & Concepts",
    icon: "🏙️",
    pairs: [
      ["House", "Apartment"], ["Tent", "Hut"], ["City", "Village"], ["Zoo", "Farm"],
      ["Aquarium", "Zoo"], ["Classroom", "Library"], ["Temple", "Church"], ["Cinema", "Theater"],
      ["Netflix", "YouTube"], ["Movie", "Series"], ["Ludo", "Carrom"], ["Cricket", "Football"],
      ["Captain America", "Iron Man"], ["Hulk", "Thor"], ["Teacher", "Student"], ["Doctor", "Nurse"],
      ["Actor", "Director"], ["King", "Queen"], ["Compass", "Map"], ["Map", "Globe"],
      ["Birthday", "Anniversary"], ["Love", "Happiness"], ["Airport", "Railway Station"], ["Tennis", "Badminton"],
      ["Singing", "Dancing"], ["Policeman", "Security Guard"], ["Park", "Garden"],
      ["Mall", "Supermarket"], ["Spiderman", "Deadpool"]
    ]
  }
};

// Flatten all pairs for backward compatibility and "All Categories" mode
const WORD_PAIRS = Object.values(WORD_CATEGORIES).flatMap(c => c.pairs);

/**
 * Word Selection Manager with Session History Tracking and Category Filtering
 */
class WordSelector {
  constructor() {
    this.storageKey = 'oddinary_recent_words_v2';
    this.recentWords = this.loadRecentWords();
  }

  loadRecentWords() {
    try {
      const raw = sessionStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch(e) {
      return [];
    }
  }

  saveRecentWords() {
    try {
      sessionStorage.setItem(this.storageKey, JSON.stringify(this.recentWords));
    } catch(e) {}
  }

  /**
   * Get pool of word pairs for a specific category key (or 'all')
   */
  getPool(categoryKey = 'all') {
    if (categoryKey && categoryKey !== 'all' && WORD_CATEGORIES[categoryKey]) {
      return WORD_CATEGORIES[categoryKey].pairs;
    }
    return WORD_PAIRS;
  }

  /**
   * Get a random word pair from pool that has not appeared in recent rounds
   */
  getRandomPair(categoryKey = 'all') {
    const pool = this.getPool(categoryKey);
    const maxRecent = Math.min(50, Math.floor(pool.length * 0.35));
    let attempts = 0;
    let pair;
    
    do {
      const randomIndex = Math.floor(Math.random() * pool.length);
      pair = pool[randomIndex];
      attempts++;
      
      if (attempts > 60) {
        // Reset half of history if pool list exhausted
        this.recentWords = this.recentWords.slice(Math.floor(this.recentWords.length / 2));
        break;
      }
    } while (this.isRecentlyUsed(pair));
    
    // Add to recent words
    this.recentWords.push(pair);
    if (this.recentWords.length > maxRecent) {
      this.recentWords.shift();
    }
    this.saveRecentWords();
    
    return pair;
  }

  /**
   * Check if a pair was recently used
   */
  isRecentlyUsed(pair) {
    return this.recentWords.some(recent => 
      (recent[0] === pair[0] && recent[1] === pair[1]) ||
      (recent[0] === pair[1] && recent[1] === pair[0])
    );
  }

  /**
   * Reset recent words
   */
  reset() {
    this.recentWords = [];
    try {
      sessionStorage.removeItem(this.storageKey);
    } catch(e) {}
  }
}

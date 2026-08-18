/**
 * ODDINARY - Word Pairs Dataset & Selection Engine
 * Duplicate-word protection across rounds with session persistence
 */

const WORD_PAIRS = [
  // Food & Drinks
  ["Pizza", "Burger"], ["Coffee", "Tea"], ["Donut", "Cupcake"], ["Cookie", "Brownie"],
  ["Ice cream", "Cake"], ["Chocolate", "Candy"], ["Pepsi", "Fanta"], ["Milk", "Juice"],
  ["Pasta", "Noodles"], ["Butter", "Cheese"], ["Apple", "Orange"], ["Banana", "Mango"],
  ["Cherry", "Strawberry"], ["Watermelon", "Pumpkin"], ["Carrot", "Potato"], ["Garlic", "Onion"],
  ["Honey", "Jam"], ["Salt", "Sugar"], ["Salt", "Pepper"], ["Bread", "Toast"],
  ["Rice", "Wheat"], ["Sandwich", "Burger"], ["Soda", "Lemonade"], ["Almond", "Cashew"],
  ["Yogurt", "Ice cream"], ["Idli", "Dosa"], ["Butter", "Ghee"], ["Milk", "Curd"],

  // Nature & Weather
  ["Sun", "Moon"], ["Moon", "Star"], ["Lightning", "Thunder"], ["Cloud", "Fog"],
  ["Rain", "Snow"], ["River", "Lake"], ["Ocean", "Sea"], ["Desert", "Beach"],
  ["Fire", "Smoke"], ["Mountain", "Hill"], ["Tree", "Plant"], ["Flower", "Leaf"],
  ["Earthquake", "Tsunami"], ["Wind", "Storm"], ["Sunrise", "Sunset"],

  // Animals & Creatures
  ["Dog", "Cat"], ["Kitten", "Puppy"], ["Lion", "Tiger"], ["Dolphin", "Whale"],
  ["Owl", "Eagle"], ["Goat", "Sheep"], ["Cow", "Goat"], ["Horse", "Donkey"],
  ["Giraffe", "Zebra"], ["Spider", "Ant"], ["Spider", "Scorpion"], ["Snake", "Lizard"],
  ["Fish", "Crab"], ["Jellyfish", "Starfish"], ["Ghost", "Zombie"], ["Dragon", "Dinosaur"],
  ["Mosquito", "Housefly"], ["Frog", "Toad"], ["Duck", "Goose"], ["Bee", "Wasp"],

  // Everyday Objects & Tools
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

  // Vehicles & Travel
  ["Car", "Bus"], ["Bus", "Train"], ["Cycle", "Bike"], ["Boat", "Ship"],
  ["Airplane", "Helicopter"], ["Taxi", "Auto"], ["Ambulance", "Firetruck"],
  ["Rocket", "Satellite"], ["Rocket", "Missile"], ["Submarine", "Ship"],

  // Places & Concepts
  ["House", "Apartment"], ["Tent", "Hut"], ["City", "Village"], ["Zoo", "Farm"],
  ["Aquarium", "Zoo"], ["Classroom", "Library"], ["Temple", "Church"], ["Cinema", "Theater"],
  ["Netflix", "YouTube"], ["Movie", "Series"], ["Ludo", "Carrom"], ["Cricket", "Football"],
  ["Captain America", "Iron Man"], ["Hulk", "Thor"], ["Teacher", "Student"], ["Doctor", "Nurse"],
  ["Actor", "Director"], ["King", "Queen"], ["Compass", "Map"], ["Map", "Globe"],
  ["Birthday", "Anniversary"], ["Love", "Happiness"]
];

/**
 * Word Selection Manager with Session History Tracking
 */
class WordSelector {
  constructor() {
    this.storageKey = 'oddinary_recent_words_v2';
    this.recentWords = this.loadRecentWords();
    this.maxRecent = Math.min(50, Math.floor(WORD_PAIRS.length * 0.35));
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
   * Get a random word pair that has not appeared in recent rounds
   */
  getRandomPair() {
    let attempts = 0;
    let pair;
    
    do {
      const randomIndex = Math.floor(Math.random() * WORD_PAIRS.length);
      pair = WORD_PAIRS[randomIndex];
      attempts++;
      
      if (attempts > 60) {
        // Reset half of history if list exhausted
        this.recentWords = this.recentWords.slice(Math.floor(this.recentWords.length / 2));
        break;
      }
    } while (this.isRecentlyUsed(pair));
    
    // Add to recent words
    this.recentWords.push(pair);
    if (this.recentWords.length > this.maxRecent) {
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

/**
 * ODDINARY - Word Pairs Dataset
 * Separated from main game logic for better maintainability
 */

const WORD_PAIRS = [
  ["Sun", "Moon"], ["Pizza", "Burger"], ["Nail", "Hammer"], ["Cherry", "Strawberry"],
  ["Pen", "Pencil"], ["Love", "Happiness"], ["Chair", "Sofa"], ["Dolphin", "Whale"],
  ["Lightning", "Thunder"], ["Boat", "Ship"], ["Ice cream", "Cake"], ["Crayon", "Marker"],
  ["Banana", "Mango"], ["Violin", "Guitar"], ["Clock", "Watch"], ["Matchstick", "Lighter"],
  ["Pepsi", "Fanta"], ["Milk", "Juice"], ["Spoon", "Fork"], ["Carrot", "Potato"],
  ["Pillow", "Blanket"], ["Moon", "Star"], ["Donut", "Cupcake"], ["Orange", "Grapes"],
  ["Sunglasses", "Spectacles"], ["Cookie", "Brownie"], ["Snowman", "Santa"],
  ["Dragon", "Dinosaur"], ["Socks", "Shoes"], ["Spider", "Ant"], ["Kite", "Balloon"],
  ["Shirt", "Jacket"], ["House", "Apartment"], ["Zoo", "Farm"],
  ["Pumpkin", "Watermelon"], ["Fish", "Whale"], ["Marker", "Chalk"],
  ["Slide", "Swing"], ["Sunglasses", "Hat"], ["Shell", "Rock"],
  ["Ladder", "Stairs"], ["Elevator", "Escalator"], ["Bubble", "Balloon"],
  ["Candy", "Lollipop"], ["Bell", "Whistle"], ["Cloud", "Fog"],
  ["Garlic", "Onion"], ["Carrot", "Radish"], ["Zip", "Button"],
  ["Yogurt", "Ice cream"], ["Cup", "Bowl"], ["Star", "Sun"],
  ["Tent", "Hut"], ["Goat", "Sheep"], ["Ball", "Bat"], ["Noodles", "Pasta"],
  ["Map", "Globe"], ["Kitten", "Puppy"], ["Dog", "Cat"], ["Fire", "Smoke"],
  ["Radio", "TV"], ["Mug", "Glass"], ["Gloves", "Socks"], ["Scarf", "Cap"],
  ["Broom", "Mop"], ["Bench", "Stool"], ["Train", "Bus"],
  ["Colour Pencil", "Sketch Pen"], ["Rope", "String"], ["Jacket", "Sweater"],
  ["Chair", "Stool"], ["Toothbrush", "Toothpaste"], ["Owl", "Eagle"],
  ["Desk", "Table"], ["Hat", "Helmet"], ["Butter", "Cheese"],
  ["Candle", "Lamp"], ["Soda", "Lemonade"], ["Lion", "Tiger"],
  ["Netflix", "YouTube"], ["Giraffe", "Zebra"], ["Bubblegum", "Lollipop"],
  ["Dolphin", "Whale"], ["Virus", "Bacteria"], ["Horse", "Donkey"],
  ["Cow", "Goat"], ["Cycle", "Bike"], ["Airplane", "Helicopter"],
  ["Aquarium", "Zoo"], ["Taxi", "Auto"], ["Ambulance", "Firetruck"],
  ["Bulldozer", "Crane"], ["Door", "Gate"], ["Fridge", "Freezer"],
  ["Shower", "Tap"], ["Cupboard", "Drawer"], ["Classroom", "Library"],
  ["Bell", "Alarm"], ["Shirt", "T-Shirt"], ["Raincoat", "Umbrella"],
  ["Necklace", "Earrings"], ["Birthday", "Anniversary"],
  ["Captain America", "Iron Man"], ["Hulk", "Thor"], ["Rice", "Wheat"],
  ["Fish", "Crab"], ["Leg", "Arm"], ["Water", "Juice"],
  ["Soap", "Shampoo"], ["Salt", "Sugar"], ["Sugar", "Honey"],
  ["Butter", "Ghee"], ["Salt", "Pepper"], ["Tea", "Coffee"],
  ["Shoes", "Slippers"], ["Mobile", "Telephone"], ["Temple", "Church"],
  ["King", "Queen"], ["Milk", "Curd"], ["Wallet", "Purse"],
  ["Gas Stove", "Induction Stove"], ["City", "Village"], ["Idli", "Dosa"],
  ["Burger", "Sandwich"], ["Cricket", "Football"], ["Honey", "Jam"],
  ["Almond", "Cashew"], ["Blackboard", "Whiteboard"], ["Speaker", "Headphones"],
  ["Teacher", "Student"], ["Farmer", "Gardener"], ["Actor", "Director"],
  ["Snake", "Lizard"], ["Gold", "Silver"], ["Ludo", "Carrom"],
  ["Projector", "Television"], ["Cellotape", "Glue"], ["Mosquito", "Housefly"],
  ["Movie", "Series"], ["Compass", "Map"], ["Rocket", "Missile"], ["Helmet", "Cap"],
  ["Ring", "Bracelet"], ["Earthquake", "Tsunami"]
];

/**
 * Word Selection Manager
 * Tracks recently used words to avoid repetition
 */
class WordSelector {
    constructor() {
        this.recentWords = [];
        this.maxRecent = Math.min(10, Math.floor(WORD_PAIRS.length * 0.2)); // Track 20% of dataset
    }

    /**
     * Get a random word pair that hasn't been used recently
     */
    getRandomPair() {
        let attempts = 0;
        let pair;
        
        do {
            const randomIndex = Math.floor(Math.random() * WORD_PAIRS.length);
            pair = WORD_PAIRS[randomIndex];
            attempts++;
            
            // If we've tried too many times, just use any pair (prevents infinite loop)
            if (attempts > 50) {
                this.recentWords = []; // Reset recent words
                break;
            }
        } while (this.isRecentlyUsed(pair));
        
        // Add to recent words
        this.recentWords.push(pair);
        if (this.recentWords.length > this.maxRecent) {
            this.recentWords.shift(); // Remove oldest
        }
        
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
     * Reset the recent words tracker (e.g., for new game session)
     */
    reset() {
        this.recentWords = [];
    }
}

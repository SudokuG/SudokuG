// Puzzle names, for fun: "Smoky Mango Dumplings", "Flaming-Hot Potato Crisps".
//
// Each type of puzzle gets its own naming theme; sudoku is food. A name has two or three
// parts, like the drop-downs in a character creator:
//   1. a word that matches the difficulty (mild for Easy … charred for Extreme, fusion for
//      a custom mix of techniques),
//   2. an ingredient (left out in about one name in four),
//   3. a dish.
// The parts are picked from the puzzle itself, so the same puzzle always has the same name,
// on every device, in a shared link and on paper.

export interface NameTheme {
  /** First words per difficulty ("Easy" … "Extreme", "Custom", and "Other" for anything else). */
  first: Record<string, string[]>;
  middle: string[];
  last: string[];
}

const FOOD: NameTheme = {
  first: {
    Easy: [
      "Mild", "Sweet", "Creamy", "Fresh", "Buttery", "Fluffy", "Velvety", "Mellow",
      "Honeyed", "Gentle", "Chilled", "Poached", "Steamed", "Whipped", "Soft-Boiled", "Dainty",
    ],
    Medium: [
      "Balanced", "Savoury", "Grilled", "Toasted", "Roasted", "Glazed", "Braised", "Golden",
      "Herby", "Baked", "Hearty", "Buttered", "Garlic-Butter", "Honey-Mustard", "Slow-Cooked", "Rustic",
    ],
    Hard: [
      "Smoky", "Peppery", "Seared", "Crispy", "Zesty", "Pan-Fried", "Barbecued", "Wood-Fired",
      "Tangy", "Pickled", "Sticky", "Sweet & Sour", "Hot-Smoked", "Mustard-Rubbed", "Sharp", "Chilli-Flecked",
    ],
    Expert: [
      "Fiery", "Sizzling", "Spicy", "Blistered", "Flame-Grilled", "Devilled", "Red-Hot", "Blazing",
      "Cajun", "Chipotle", "Peri-Peri", "Wasabi", "Jalapeno", "Habanero", "Firecracker", "Hot & Numbing",
    ],
    Extreme: [
      "Flaming-Hot", "Burning", "Charred", "Scorched", "Volcanic", "Molten", "Inferno", "Ghost-Pepper",
      "Atomic", "Blackened", "Smouldering", "Five-Alarm", "Lava-Glazed", "Dragon-Breath", "Nuclear", "Steaming",
    ],
    Custom: [
      "Fusion", "Mixed", "Deconstructed", "Sprinkled", "Tossed", "Assorted", "Layered", "Swirled",
      "Marbled", "Stuffed", "Twisted", "Remixed", "Experimental", "Loaded", "Pick & Mix", "Chef's Choice",
    ],
    Other: ["Mystery", "Secret-Recipe", "Off-Menu", "Midnight", "Leftover", "Forbidden", "Unlabelled", "Wild"],
  },
  middle: [
    "Cheese", "Potato", "Garlic", "Mango", "Mushroom", "Pumpkin", "Honey", "Coconut",
    "Lemon", "Pepper", "Ginger", "Chickpea", "Basil", "Truffle", "Sesame", "Paprika",
    "Cinnamon", "Maple", "Halloumi", "Aubergine", "Lime", "Onion", "Sweetcorn", "Pineapple",
    "Peanut", "Tomato", "Spinach", "Plum", "Chocolate", "Caramel", "Pistachio", "Avocado",
    "Fennel", "Leek", "Saffron", "Pretzel", "Bacon", "Chicken", "Beef", "Salmon",
    "Prawn", "Tofu", "Lentil", "Walnut", "Apple", "Cherry", "Rhubarb", "Chorizo",
  ],
  last: [
    "Picanha", "Crisps", "Dumplings", "Noodles", "Tacos", "Risotto", "Pancakes", "Pie",
    "Stew", "Curry", "Burger", "Skewers", "Soup", "Bake", "Toastie", "Fritters",
    "Ramen", "Pizza", "Wraps", "Waffles", "Bao Buns", "Croquettes", "Lasagne", "Gnocchi",
    "Empanadas", "Paella", "Goulash", "Quesadilla", "Samosas", "Crumble", "Tart", "Muffins",
    "Kebab", "Flatbread", "Omelette", "Casserole", "Sliders", "Nachos", "Biryani", "Pierogi",
    "Bruschetta", "Frittata", "Galette", "Sundae", "Doughnuts", "Crepes", "Stroganoff", "Hotpot",
  ],
};

/** Treasure Map: pirates, the romantic kind (sails, islands, bounty, X marks the spot). */
const PIRATES: NameTheme = {
  first: {
    Easy: [
      "Breezy", "Sunny", "Lazy", "Merry", "Jolly", "Calm-Water", "Golden", "Sandy",
      "Bright", "Easygoing", "Sun-Kissed", "Gentle", "Lucky", "Turquoise", "Friendly", "Sleepy",
    ],
    Medium: [
      "Salty", "Daring", "Swashbuckling", "Rollicking", "Bold", "Roguish", "Plundering", "Dashing",
      "Rum-Soaked", "Wind-Swept", "Free-Spirited", "Spyglass", "Seafaring", "Swaggering", "Clever", "Silver-Tongued",
    ],
    Hard: [
      "Stormy", "Cursed", "Dread", "Thundering", "Black-Sailed", "Fearless", "Notorious", "Haunted",
      "Wild", "Mutinous", "Moonless", "Ghostly", "Reckless", "Infamous", "Kraken-Bitten", "Storm-Tossed",
    ],
    Expert: [
      "Hurricane", "Maelstrom", "Thunderstruck", "Skull-and-Crossbones", "Fog-Bound", "Shipwrecked", "Whirlpool", "Blood-Moon",
      "Cannon-Roaring", "Lightning-Struck", "Ghost-Ship", "Fearsome", "Davy-Jones", "Typhoon", "Sea-Serpent", "Midnight-Black",
    ],
    Other: ["Lost", "Uncharted", "Secret", "Forgotten", "Hidden", "Mysterious", "Legendary", "Sunken"],
  },
  middle: [
    "Parrot", "Cutlass", "Compass", "Doubloon", "Lagoon", "Kraken", "Rum", "Barnacle",
    "Corsair", "Galleon", "Lantern", "Cannon", "Anchor", "Coral", "Seagull", "Spyglass",
    "Treasure", "Buccaneer", "Mermaid", "Coconut", "Hook", "Plank", "Crow's-Nest", "Gold",
    "Skull", "Pearl", "Driftwood", "Shipwreck", "Monkey", "Starboard", "Tide", "Sea Shanty",
  ],
  last: [
    "Cove", "Bounty", "Voyage", "Isle", "Treasure", "Mutiny", "Shanty", "Escapade",
    "Hideout", "Map", "Plunder", "Reef", "Harbour", "Raid", "Expedition", "Fortune",
    "Adventure", "Getaway", "Caper", "Lagoon", "Chest", "Crossing", "Horizon", "Legend",
    "Tavern", "Armada", "Quest", "Jamboree", "Skirmish", "Landing", "Promise", "Freedom",
  ],
};

/** Futoshiki: Arthurian legend (gallantry, knights, princesses and dragons). */
const ARTHURIAN: NameTheme = {
  first: {
    Easy: [
      "Gentle", "Courteous", "Fair", "Young", "Merry", "Graceful", "Humble", "Kindly",
      "Noble", "Hopeful", "Cheerful", "Faithful", "Bright-Eyed", "Sunlit", "Modest", "Daydreaming",
    ],
    Medium: [
      "Gallant", "Valiant", "Chivalrous", "Errant", "Questing", "Bold", "Loyal", "Steadfast",
      "Honourable", "Wandering", "Bannered", "Jousting", "Silver-Clad", "Oath-Bound", "Lionhearted", "Spirited",
    ],
    Hard: [
      "Dragon-Slaying", "Grail-Seeking", "Fearsome", "Legendary", "Enchanted", "Dauntless", "Mighty", "Storm-Riding",
      "Spellbound", "Fabled", "Unyielding", "Fire-Forged", "Shadow-Hunting", "Thunderous", "Invincible", "Doom-Defying",
    ],
    Expert: [
      "Dragonfire", "Sword-in-the-Stone", "Wyrm-Slaying", "Prophesied", "Moon-Cursed", "Sorcery-Bound", "Giant-Felling", "Thrice-Blessed",
      "Battle-Scarred", "Starfall", "Ever-Burning", "Shadow-Crowned", "Storm-Summoning", "Lightning-Forged", "Last-Stand", "Fate-Defying",
    ],
    Other: ["Mysterious", "Wandering", "Forgotten", "Hidden", "Ancient", "Secret", "Lost", "Dreaming"],
  },
  middle: [
    "Round-Table", "Camelot", "Avalon", "Silver", "Crimson", "Golden", "Dragon", "Grail",
    "Unicorn", "Falcon", "Lion", "Oak", "Moonlit", "Misty", "Rose", "Emerald",
    "Stag", "Griffin", "Lakeside", "Tower", "Thistle", "Ivory", "Starlit", "Highland",
    "Mistletoe", "Sapphire", "Willow", "Raven", "Bluebell", "Castle", "Forest", "Crystal",
  ],
  last: [
    "Knight", "Princess", "Squire", "Dragon", "Wizard", "Herald", "Archer", "Jouster",
    "Bard", "Champion", "Sorceress", "Paladin", "King", "Queen", "Steed", "Lance",
    "Banner", "Tournament", "Quest", "Castle", "Enchantress", "Falconer", "Shieldbearer", "Minstrel",
    "Prince", "Duchess", "Swordsmith", "Ranger", "Guardian", "Oath", "Crown", "Feast",
  ],
};

/** Calcudoku: overcomplicated engineering terms. */
const ENGINEERING: NameTheme = {
  first: {
    Easy: [
      "Basic", "Standard", "Manual", "Simplified", "Entry-Level", "Low-Voltage", "Hand-Cranked", "Analogue",
      "Single-Phase", "Unpowered", "Prototype", "Pocket-Sized", "Starter", "Passive", "Desktop", "Training",
    ],
    Medium: [
      "Modular", "Calibrated", "Synchronised", "Pneumatic", "Hydraulic", "Bi-Directional", "Auto-Adjusting", "Dual-Stage",
      "Torque-Assisted", "Variable-Pitch", "Thermostatic", "Gyro-Stabilised", "Counter-Balanced", "Load-Bearing", "Pressure-Sealed", "Servo-Driven",
    ],
    Hard: [
      "Turbocharged", "Quantum-Coupled", "Hyperbolic", "Multi-Axial", "Cryogenic", "Plasma-Cooled", "Magnetically Levitated", "Triple-Redundant",
      "Harmonically Damped", "Supercritical", "Phase-Shifted", "Fly-by-Wire", "Inverse-Kinematic", "Electro-Hydraulic", "High-Torque", "Self-Lubricating",
    ],
    Expert: [
      "Recursive Self-Calibrating", "Non-Euclidean", "Fully Asynchronous", "Over-Engineered", "Trans-Dimensional", "Hyper-Redundant", "Ludicrously Overclocked", "Fractally Nested",
      "Thermonuclear", "Retro-Encabulated", "Infinitely Adjustable", "Exponentially Geared", "Anti-Entropic", "Chrono-Synchronised", "Omni-Directional", "Tachyon-Primed",
    ],
    Other: ["Experimental", "Unlabelled", "Classified", "Reverse-Engineered", "Patent-Pending", "Salvaged", "Bespoke", "Unfinished"],
  },
  middle: [
    "Flux", "Torque", "Thermo-Kinetic", "Gyroscopic", "Differential", "Harmonic", "Sprocket", "Turbine",
    "Piston", "Capacitive", "Inductive", "Centrifugal", "Ferro-Magnetic", "Photonic", "Ratchet", "Ballistic",
    "Carburettor", "Hydro-Static", "Feedback", "Vortex", "Crankshaft", "Gimbal", "Valve", "Oscillation",
    "Laser", "Resonance", "Spindle", "Pulse", "Thermal", "Cam", "Dynamo", "Plasma",
  ],
  last: [
    "Regulator", "Manifold", "Actuator", "Dampener", "Inverter", "Modulator", "Oscillator", "Gearbox",
    "Capacitor", "Compensator", "Encabulator", "Transducer", "Governor", "Coupling", "Flywheel", "Rectifier",
    "Accumulator", "Servomechanism", "Calibrator", "Converter", "Stabiliser", "Thruster", "Assembly", "Mechanism",
    "Apparatus", "Resonator", "Contraption", "Turbocharger", "Gasket", "Dynamo", "Integrator", "Amplifier",
  ],
};

/** One theme per puzzle type. New puzzle types get a theme of their own. */
export const NAME_THEMES: Record<string, NameTheme> = { sudoku: FOOD, sums: PIRATES, futoshiki: ARTHURIAN, calcudoku: ENGINEERING };

/** Capitalise every word, also after a hyphen ("flaming-hot" → "Flaming-Hot"). */
export const titleCase = (s: string) => s.replace(/(^|[\s-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());

/** FNV-1a hash of a string, 32 bits. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/**
 * The name of a puzzle. `puzzle` is anything that identifies it (for sudoku the 81
 * characters), `difficulty` "Easy" … "Extreme", "Custom", or anything else for a puzzle of
 * unknown difficulty.
 */
export function puzzleName(puzzle: string, difficulty: string, type = "sudoku"): string {
  const theme = NAME_THEMES[type] ?? FOOD;
  const firsts = theme.first[difficulty] ?? theme.first.Other;
  let h = hash(puzzle);
  const take = <T>(a: T[]): T => {
    const x = a[h % a.length];
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; // mix before the next pick
    return x;
  };
  const first = take(firsts);
  let middle = take(theme.middle);
  // No echo: "Honey-Mustard Honey Waffles" becomes "Honey-Mustard Lemon Waffles".
  for (let k = 0; first.toLowerCase().includes(middle.toLowerCase()) && k < 5; k++) middle = take(theme.middle);
  let last = take(theme.last);
  for (let k = 0; last === middle && k < 5; k++) last = take(theme.last);
  const short = h % 4 === 0; // about one name in four has two parts
  return titleCase(short ? `${first} ${last}` : `${first} ${middle} ${last}`);
}

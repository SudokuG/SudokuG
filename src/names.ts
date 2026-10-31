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

/** One theme per puzzle type. New puzzle types get a theme of their own. */
export const NAME_THEMES: Record<string, NameTheme> = { sudoku: FOOD };

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
  const last = take(theme.last);
  const short = h % 4 === 0; // about one name in four has two parts
  return titleCase(short ? `${first} ${last}` : `${first} ${middle} ${last}`);
}

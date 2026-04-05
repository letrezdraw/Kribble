export interface WordCategory {
  name: string;
  words: string[];
}

export const WORD_CATEGORIES: WordCategory[] = [
  {
    name: 'Animals',
    words: [
      'dog', 'cat', 'bird', 'fish', 'lion', 'tiger', 'bear', 'horse',
      'elephant', 'giraffe', 'monkey', 'zebra', 'penguin', 'dolphin',
      'butterfly', 'rabbit', 'duck', 'frog', 'snake', 'lizard', 'whale',
      'shark', 'octopus', 'crab', 'turtle', 'cow', 'pig', 'sheep', 'chicken'
    ]
  },
  {
    name: 'Food',
    words: [
      'apple', 'banana', 'orange', 'grape', 'strawberry', 'pizza', 'burger',
      'sandwich', 'pasta', 'rice', 'bread', 'cake', 'cookie', 'ice cream',
      'chocolate', 'coffee', 'tea', 'milk', 'juice', 'salad', 'soup', 'egg',
      'bacon', 'cheese', 'pancake', 'waffle', 'donut', 'pie', 'sushi', 'taco'
    ]
  },
  {
    name: 'Objects',
    words: [
      'chair', 'table', 'bed', 'lamp', 'phone', 'computer', 'book', 'pen',
      'clock', 'watch', 'glasses', 'key', 'door', 'window', 'house', 'car',
      'bicycle', 'train', 'plane', 'boat', 'ball', 'bat', 'racket', 'guitar',
      'piano', 'drum', 'camera', 'television', 'refrigerator', 'microwave'
    ]
  },
  {
    name: 'Nature',
    words: [
      'tree', 'flower', 'grass', 'leaf', 'sun', 'moon', 'star', 'cloud',
      'rain', 'snow', 'wind', 'ocean', 'river', 'lake', 'mountain', 'forest',
      'beach', 'island', 'desert', 'volcano', 'rainbow', 'sky', 'ground',
      'rock', 'sand', 'water', 'fire', 'mountain', 'valley', 'canyon', 'waterfall'
    ]
  },
  {
    name: 'Actions',
    words: [
      'run', 'walk', 'jump', 'swim', 'fly', 'dance', 'sing', 'eat', 'sleep',
      'think', 'read', 'write', 'draw', 'paint', 'cook', 'drive', 'ride',
      'climb', 'throw', 'catch', 'kick', 'hit', 'cut', 'build', 'make',
      'play', 'work', 'study', 'talk', 'listen', 'watch', 'laugh', 'cry'
    ]
  },
  {
    name: 'People',
    words: [
      'boy', 'girl', 'man', 'woman', 'baby', 'child', 'teacher', 'doctor',
      'nurse', 'police', 'firefighter', 'chef', 'artist', 'musician', 'actor',
      'athlete', 'friend', 'family', 'mother', 'father', 'sister', 'brother',
      'grandmother', 'grandfather', 'queen', 'king', 'prince', 'princess'
    ]
  }
];

// Flatten all words into one array
export const ALL_WORDS: string[] = WORD_CATEGORIES.flatMap(cat => cat.words);

// Get random words from a category or all
export function getRandomWords(count: number, category?: string): string[] {
  let pool: string[];
  
  if (category) {
    const cat = WORD_CATEGORIES.find(c => c.name.toLowerCase() === category.toLowerCase());
    pool = cat?.words || ALL_WORDS;
  } else {
    pool = ALL_WORDS;
  }

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Get a random category
export function getRandomCategory(): string {
  const categories = WORD_CATEGORIES.map(c => c.name);
  return categories[Math.floor(Math.random() * categories.length)];
}

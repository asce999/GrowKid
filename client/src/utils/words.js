// "Make one for me" on the child form (sitemap rule 27, L4): three of these, joined by "-".
// 150 short, kind, everyday words a child can read, say and type.
const WORDS = [
  'apple', 'bake', 'ball', 'beach', 'bean', 'bear', 'bell', 'berry', 'bird', 'blue',
  'boat', 'book', 'bread', 'bright', 'brook', 'bubble', 'bunny', 'cake', 'calm', 'camp',
  'candle', 'carrot', 'castle', 'chalk', 'cherry', 'clay', 'clever', 'cloud', 'clover', 'cocoa',
  'comet', 'cookie', 'coral', 'cosy', 'crayon', 'daisy', 'dance', 'dawn', 'deer', 'dolphin',
  'dream', 'drum', 'duck', 'eagle', 'earth', 'fair', 'farm', 'feather', 'fern', 'field',
  'fish', 'flute', 'forest', 'fox', 'fresh', 'frog', 'garden', 'gentle', 'giggle', 'ginger',
  'glad', 'gold', 'grape', 'green', 'happy', 'harbor', 'hill', 'honey', 'hope', 'jelly',
  'jolly', 'jump', 'kind', 'kite', 'koala', 'lake', 'lamp', 'leaf', 'lemon', 'light',
  'lily', 'lucky', 'mango', 'maple', 'marble', 'meadow', 'melon', 'merry', 'mint', 'moon',
  'morning', 'music', 'nest', 'ocean', 'olive', 'orange', 'otter', 'paint', 'panda', 'paper',
  'peach', 'pear', 'pebble', 'pencil', 'picnic', 'pillow', 'planet', 'plum', 'pond', 'puzzle',
  'quiet', 'rabbit', 'rain', 'river', 'robin', 'rocket', 'rose', 'sail', 'sand', 'seed',
  'shell', 'silver', 'sky', 'smile', 'snow', 'song', 'spark', 'spring', 'star', 'stone',
  'story', 'summer', 'sunny', 'swing', 'tiger', 'toast', 'train', 'tree', 'tulip', 'turtle',
  'violet', 'warm', 'water', 'whale', 'wind', 'window', 'winter', 'wish', 'wood', 'zebra',
]

/**
 * A password such as "kite-melon-river". The words are picked with the browser's secure random numbers, never Math.random.
 * `mine` is the child's name and username: the server refuses a password that holds a word of either (rule 27, L4), so a draw
 * that does is made again. No three letters are in every word, so this ends.
 */
export function makePassword(...mine) {
  const avoid = mine.join(' ').normalize('NFKC').toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u).filter((part) => part.length >= 3)
  for (;;) {
    const made = Array.from(crypto.getRandomValues(new Uint32Array(3)), (n) => WORDS[n % WORDS.length]).join('-')
    if (!avoid.some((part) => made.includes(part))) return made
  }
}

export { WORDS }

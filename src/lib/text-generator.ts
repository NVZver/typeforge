// Normalize curly quotes to straight quotes
function normalizeQuotes(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")  // Single curly quotes to straight
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')  // Double curly quotes to straight
    .replace(/[\u2013\u2014]/g, '-');              // En/em dashes to hyphen
}

// Word bank: Top 200+ common English words
const commonWords: string[] = [
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'I',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
  'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
  'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
  'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
  'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
  'great', 'world', 'need', 'feel', 'high', 'right', 'still', 'own', 'here', 'last',
  'long', 'same', 'should', 'ask', 'while', 'try', 'never', 'start', 'city', 'run',
  'home', 'school', 'every', 'plant', 'food', 'keep', 'body', 'story', 'watch', 'often',
  'paper', 'together', 'group', 'always', 'music', 'those', 'both', 'mark', 'book', 'letter',
  'until', 'mile', 'river', 'car', 'feet', 'care', 'second', 'enough', 'plain', 'girl',
  'usual', 'young', 'ready', 'above', 'leave', 'sound', 'night', 'table', 'travel', 'less',
  'morning', 'simple', 'several', 'vowel', 'toward', 'war', 'ground', 'heart', 'sit', 'once',
  'base', 'hear', 'horse', 'cut', 'sure', 'face', 'wood', 'main', 'open', 'seem',
  'next', 'walk', 'white', 'children', 'began', 'got', 'example', 'ease', 'idea',
  'fish', 'mountain', 'stop', 'cross', 'farm', 'hard', 'rock', 'ride', 'turn',
  'quick', 'compare', 'square', 'better', 'brought', 'able', 'bird', 'soon', 'complete', 'contains',
  'done', 'dry', 'though', 'language', 'shape', 'deep', 'clear', 'tail', 'produce', 'fact',
  'street', 'inch', 'multiply', 'nothing', 'course', 'stay', 'wheel', 'full', 'force', 'blue',
  'object', 'decide', 'surface', 'whether', 'moon', 'island', 'foot', 'system', 'busy', 'test',
  'record', 'boat', 'common', 'gold', 'possible', 'plane', 'instead', 'rather', 'among', 'move'
];

const quotes: string[] = [
  "The only way to do great work is to love what you do.",
  "Innovation distinguishes between a leader and a follower.",
  "Stay hungry, stay foolish.",
  "The future belongs to those who believe in the beauty of their dreams.",
  "It does not matter how slowly you go as long as you do not stop.",
  "Success is not final, failure is not fatal: it is the courage to continue that counts.",
  "The best time to plant a tree was twenty years ago. The second best time is now.",
  "Your time is limited, do not waste it living someone else's life.",
  "The only impossible journey is the one you never begin.",
  "Believe you can and you are halfway there.",
  "In the middle of difficulty lies opportunity.",
  "The greatest glory in living lies not in never falling, but in rising every time we fall.",
  "Life is what happens when you are busy making other plans.",
  "The way to get started is to quit talking and begin doing.",
  "If life were predictable it would cease to be life and be without flavor.",
  "Spread love everywhere you go. Let no one ever come to you without leaving happier.",
  "When you reach the end of your rope, tie a knot in it and hang on.",
  "Always remember that you are absolutely unique. Just like everyone else.",
  "The best and most beautiful things in the world cannot be seen or even touched.",
  "It is during our darkest moments that we must focus to see the light."
];

const codeSnippets: string[] = [
  "function getData() { return fetch(url).then(res => res.json()); }",
  "const result = array.filter(item => item.active).map(item => item.name);",
  "if (user && user.isAdmin) { grantAccess(); } else { denyAccess(); }",
  "async function loadData() { const data = await fetchAPI(); return data; }",
  "const [state, setState] = useState(initialValue);",
  "export default function Component({ props }) { return <div>{props.text}</div>; }",
  "const sum = numbers.reduce((acc, num) => acc + num, 0);",
  "try { await saveData(data); } catch (error) { console.error(error); }",
  "const uniqueItems = [...new Set(items)];",
  "Object.keys(obj).forEach(key => console.log(obj[key]));",
  "const debounce = (fn, delay) => { let timer; return (...args) => timer = setTimeout(() => fn(...args), delay); };",
  "const pipe = (...fns) => x => fns.reduce((v, f) => f(v), x);",
  "class User { constructor(name) { this.name = name; } greet() { return `Hello ${this.name}`; } }",
  "const sorted = [...array].sort((a, b) => a.value - b.value);",
  "const merged = { ...defaults, ...options, timestamp: Date.now() };",
  "const match = text.match(/\\b\\w+@\\w+\\.\\w+\\b/g);",
  "const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);",
  "const promise = new Promise((resolve, reject) => setTimeout(resolve, 1000));",
  "const memoize = fn => { const cache = {}; return x => cache[x] ?? (cache[x] = fn(x)); };",
  "document.querySelector('.btn').addEventListener('click', handleClick);"
];

export const textGenerator = {
  getWords(count: number): string {
    const words: string[] = [];
    for (let i = 0; i < count; i++) {
      words.push(commonWords[Math.floor(Math.random() * commonWords.length)]);
    }
    return normalizeQuotes(words.join(' '));
  },

  getQuote(): string {
    return normalizeQuotes(quotes[Math.floor(Math.random() * quotes.length)]);
  },

  getCode(): string {
    return normalizeQuotes(codeSnippets[Math.floor(Math.random() * codeSnippets.length)]);
  },

  getMixed(targetLength: number = 100): string {
    let text = '';
    const types = ['words', 'quote', 'code'] as const;
    while (text.length < targetLength) {
      const type = types[Math.floor(Math.random() * types.length)];
      if (type === 'words') {
        text += this.getWords(8) + ' ';
      } else if (type === 'quote') {
        text += this.getQuote() + ' ';
      } else {
        text += this.getCode() + ' ';
      }
    }
    return normalizeQuotes(text.trim());
  },

  // Generate text focused on weak keys/bigrams
  getWeaknessText(weakKeys: string[], weakBigrams: string[], count: number = 20): string {
    const targetChars = new Set([...weakKeys, ...weakBigrams.flatMap(b => b.split(''))]);
    const relevantWords = commonWords.filter(word =>
      [...word].some(char => targetChars.has(char.toLowerCase()))
    );

    if (relevantWords.length < 10) return this.getWords(count);

    const words: string[] = [];
    for (let i = 0; i < count; i++) {
      words.push(relevantWords[Math.floor(Math.random() * relevantWords.length)]);
    }
    return normalizeQuotes(words.join(' '));
  },

  // Normalize external text (from AI)
  normalize(text: string): string {
    return normalizeQuotes(text);
  }
};

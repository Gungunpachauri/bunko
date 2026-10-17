// Placeholder books for the Phase 1 demos. Every theme shows the same books in
// the same slots — only the skin changes.

export type RoomId = "fiction" | "selfhelp";

export interface Book {
  id: string;
  title: string;
  /** Short title used on narrow spines. */
  spineTitle: string;
  author: string;
  /** Genre id. The first two are the original rooms; more can be added. */
  room: RoomId | (string & {});
  /** Shelf row (0 = top, 1 = bottom). Five books per row. */
  row: 0 | 1;
  color: string;
  /** Spine size in design units (the shelf is 520 wide). */
  w: number;
  h: number;
  /** 0..1 reading progress. */
  progress: number;
  pages: number;
  description: string;
  highlights: string[];
  /** Month the book joined the library (see timeline.ts). */
  addedMonth?: number;
  finishedMonth?: number;
}

export const BOOKS: Book[] = [
  // ── Fiction ─────────────────────────────────────────────────────────────
  {
    id: "pride", title: "Pride and Prejudice", spineTitle: "Pride & Prejudice", author: "Jane Austen",
    room: "fiction", row: 0, color: "#7a3b3b", w: 66, h: 176, progress: 0.62, pages: 432,
    description: "Elizabeth Bennet trades sharp words with the proud Mr. Darcy while her family hunts for good marriages. A comedy of first impressions and second thoughts.",
    highlights: ["First impressions are rarely the whole story.", "Wit is Elizabeth's armour — and her blind spot."],
  },
  {
    id: "moby", title: "Moby-Dick", spineTitle: "Moby-Dick", author: "Herman Melville",
    room: "fiction", row: 0, color: "#28465e", w: 74, h: 186, progress: 0.18, pages: 720,
    description: "Ishmael ships out on the Pequod, whose captain is bent on revenge against the white whale that took his leg. Half adventure, half meditation on obsession.",
    highlights: ["Ahab's obsession pulls the whole crew under."],
  },
  {
    id: "frank", title: "Frankenstein", spineTitle: "Frankenstein", author: "Mary Shelley",
    room: "fiction", row: 0, color: "#3f4a35", w: 56, h: 164, progress: 1, pages: 280,
    description: "A young scientist builds a living creature and then abandons it. The creature's story asks who the real monster is.",
    highlights: ["The creature learns cruelty from people, not from nature.", "Ambition without responsibility."],
  },
  {
    id: "genji", title: "The Tale of Genji", spineTitle: "Tale of Genji", author: "Murasaki Shikibu",
    room: "fiction", row: 0, color: "#6b4f7a", w: 70, h: 182, progress: 0.07, pages: 1216,
    description: "The life and loves of the shining prince Genji at the Heian court, written a thousand years ago and often called the first novel.",
    highlights: [],
  },
  {
    id: "alice", title: "Alice's Adventures in Wonderland", spineTitle: "Alice", author: "Lewis Carroll",
    room: "fiction", row: 0, color: "#3e6f8a", w: 50, h: 150, progress: 0, pages: 192,
    description: "Alice follows a white rabbit down a hole into a world of riddles, tea parties and a queen who wants everyone's head.",
    highlights: [],
  },
  {
    id: "jane", title: "Jane Eyre", spineTitle: "Jane Eyre", author: "Charlotte Brontë",
    room: "fiction", row: 1, color: "#5a3a52", w: 62, h: 172, progress: 0.41, pages: 532,
    description: "An orphaned governess with a fierce sense of self takes a post at Thornfield Hall, where its master keeps a secret in the attic.",
    highlights: ["\"I am no bird; and no net ensnares me.\""],
  },
  {
    id: "monte", title: "The Count of Monte Cristo", spineTitle: "Monte Cristo", author: "Alexandre Dumas",
    room: "fiction", row: 1, color: "#7a5a2e", w: 78, h: 186, progress: 0.33, pages: 1276,
    description: "Wrongly imprisoned for fourteen years, Edmond Dantès escapes, finds a fortune and returns to Paris with a new name and a long plan.",
    highlights: ["Patience as a weapon.", "Wait and hope."],
  },
  {
    id: "redchamber", title: "Dream of the Red Chamber", spineTitle: "Red Chamber", author: "Cao Xueqin",
    room: "fiction", row: 1, color: "#8c2f2f", w: 68, h: 178, progress: 0.12, pages: 900,
    description: "The rise and slow fall of the wealthy Jia family, seen through the young Baoyu and the cousins he grows up with.",
    highlights: ["Truth becomes fiction when fiction is true."],
  },
  {
    id: "shakuntala", title: "Shakuntala", spineTitle: "Shakuntala", author: "Kalidasa",
    room: "fiction", row: 1, color: "#9a6a2a", w: 52, h: 158, progress: 0.8, pages: 160,
    description: "A king meets the hermitage girl Shakuntala in the forest; a curse makes him forget her. The best-known play of classical Sanskrit drama.",
    highlights: ["A ring as the key to memory."],
  },
  {
    id: "siddhartha", title: "Siddhartha", spineTitle: "Siddhartha", author: "Hermann Hesse",
    room: "fiction", row: 1, color: "#3d6b62", w: 54, h: 160, progress: 0, pages: 152,
    description: "A young Brahmin leaves home to find enlightenment, trying asceticism, wealth and love before he learns from a river.",
    highlights: [],
  },

  // ── Self-help & philosophy ──────────────────────────────────────────────
  {
    id: "meditations", title: "Meditations", spineTitle: "Meditations", author: "Marcus Aurelius",
    room: "selfhelp", row: 0, color: "#5b4a3a", w: 60, h: 170, progress: 0.55, pages: 256,
    description: "Private notes a Roman emperor wrote to himself on duty, mortality and staying calm when other people behave badly.",
    highlights: ["You have power over your mind, not outside events.", "The obstacle becomes the way."],
  },
  {
    id: "tao", title: "Tao Te Ching", spineTitle: "Tao Te Ching", author: "Laozi",
    room: "selfhelp", row: 0, color: "#2f5a4a", w: 48, h: 150, progress: 0.9, pages: 96,
    description: "Eighty-one short poems on the Way: softness that wins over hardness, and leading by not forcing.",
    highlights: ["Water is soft, yet it wears down stone.", "A journey of a thousand miles begins beneath one's feet."],
  },
  {
    id: "gita", title: "Bhagavad Gita", spineTitle: "Bhagavad Gita", author: "Vyasa",
    room: "selfhelp", row: 0, color: "#a0522d", w: 64, h: 180, progress: 0.25, pages: 224,
    description: "On the edge of battle, Arjuna loses heart and Krishna answers him: on duty, action without attachment, and the self.",
    highlights: ["Act, but let go of the fruits of action."],
  },
  {
    id: "walden", title: "Walden", spineTitle: "Walden", author: "Henry David Thoreau",
    room: "selfhelp", row: 0, color: "#4a5d32", w: 58, h: 166, progress: 0, pages: 352,
    description: "Two years in a cabin by a pond, and what Thoreau learned about living simply and on purpose.",
    highlights: [],
  },
  {
    id: "artofwar", title: "The Art of War", spineTitle: "Art of War", author: "Sun Tzu",
    room: "selfhelp", row: 0, color: "#6e2a2a", w: 50, h: 156, progress: 1, pages: 128,
    description: "Thirteen chapters on strategy that are really about knowing yourself, knowing the situation and winning without a fight.",
    highlights: ["Know yourself and know the other.", "Supreme skill is winning without fighting."],
  },
  {
    id: "enchiridion", title: "Enchiridion", spineTitle: "Enchiridion", author: "Epictetus",
    room: "selfhelp", row: 1, color: "#40506b", w: 46, h: 148, progress: 0.3, pages: 64,
    description: "A pocket handbook of Stoic practice: separate what is up to you from what is not, and act on the first.",
    highlights: ["Some things are up to us, some are not."],
  },
  {
    id: "analects", title: "The Analects", spineTitle: "Analects", author: "Confucius",
    room: "selfhelp", row: 1, color: "#7a4a2a", w: 62, h: 176, progress: 0.15, pages: 240,
    description: "Sayings of Confucius, collected by his students, on learning, character and how to treat other people.",
    highlights: ["Learning without thought is labour lost."],
  },
  {
    id: "dhammapada", title: "The Dhammapada", spineTitle: "Dhammapada", author: "The Buddha",
    room: "selfhelp", row: 1, color: "#b0742a", w: 54, h: 162, progress: 0.7, pages: 120,
    description: "Verses from the early Buddhist tradition on the mind, craving and the path to peace.",
    highlights: ["We are what we think."],
  },
  {
    id: "selfreliance", title: "Self-Reliance", spineTitle: "Self-Reliance", author: "Ralph Waldo Emerson",
    room: "selfhelp", row: 1, color: "#2e4a5c", w: 50, h: 154, progress: 0, pages: 80,
    description: "Emerson's essay on trusting your own thinking over the crowd's approval.",
    highlights: [],
  },
  {
    id: "thinketh", title: "As a Man Thinketh", spineTitle: "As a Man Thinketh", author: "James Allen",
    room: "selfhelp", row: 1, color: "#5e3d5e", w: 56, h: 158, progress: 0.48, pages: 72,
    description: "A short book arguing that character and circumstance grow out of habitual thought.",
    highlights: ["Thought and character are one."],
  },
];

export const ROOM_ORDER: RoomId[] = ["fiction", "selfhelp"];

/** The book with the most recent partial progress (stand-in for "Continue reading"). */
export const CONTINUE_BOOK = BOOKS.find((b) => b.id === "pride")!;

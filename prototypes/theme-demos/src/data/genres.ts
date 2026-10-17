// Genres the library can grow into. Each new genre becomes a new island room.
import type { Book } from "./books";
import type { ThemeId } from "../themes/types";

export interface Genre {
  id: string;
  title: string;
  /** Month the room rose from the water (month 12 is "today" for the starting library). */
  month: number;
  /** Colour the air takes on in this room. */
  mood: string;
  /** Style this room is built in when the library is in Mixed mode. */
  theme: ThemeId;
}

export const DEFAULT_GENRES: Genre[] = [
  { id: "fiction", title: "Fiction", month: 1, mood: "#ff9a5a", theme: "japanese" },
  { id: "selfhelp", title: "Self-help", month: 3, mood: "#6fc2c8", theme: "vedic" },
];

type Seed = { id: string; title: string; spineTitle?: string; author: string; color: string; description: string };

/** Placeholder genres (public-domain books) used by the "add a genre" demo. */
export const GENRE_POOL: { id: string; title: string; mood: string; theme: ThemeId; books: Seed[] }[] = [
  {
    id: "space", title: "Space & Astronomy", mood: "#8a6aff", theme: "space",
    books: [
      { id: "starry", title: "The Starry Messenger", spineTitle: "Starry Messenger", author: "Galileo Galilei", color: "#2a2a5a", description: "Galileo points a telescope at the sky and reports mountains on the Moon and moons around Jupiter." },
      { id: "revolutions", title: "On the Revolutions of the Heavenly Spheres", spineTitle: "Heavenly Spheres", author: "Nicolaus Copernicus", color: "#5a3a2a", description: "The book that moved the Sun to the centre and the Earth into orbit." },
      { id: "amateurs", title: "Astronomy for Amateurs", author: "Camille Flammarion", color: "#1f3a5a", description: "A warm, curious tour of the night sky for anyone with a pair of eyes." },
      { id: "heavens", title: "The Story of the Heavens", spineTitle: "Story of the Heavens", author: "Robert Stawell Ball", color: "#3a2a5a", description: "Planets, comets, nebulae and the scale of the universe, as understood in the 1880s." },
      { id: "somnium", title: "Somnium", author: "Johannes Kepler", color: "#4a1f3a", description: "Kepler's dream of a journey to the Moon, often called the first science fiction." },
    ],
  },
  {
    id: "philosophy", title: "Philosophy", mood: "#b48aff", theme: "chinese",
    books: [
      { id: "republic", title: "The Republic", author: "Plato", color: "#3d4f6b", description: "Socrates and friends try to define justice by imagining an ideal city, and end up asking what a good life is." },
      { id: "beyond", title: "Beyond Good and Evil", spineTitle: "Beyond Good & Evil", author: "Friedrich Nietzsche", color: "#5a2f3a", description: "An attack on the hidden assumptions of moral philosophy, written in sharp short sections." },
      { id: "discourse", title: "Discourse on the Method", spineTitle: "Discourse on Method", author: "René Descartes", color: "#6b5a3a", description: "How to doubt everything and rebuild knowledge from the one thing you can't doubt." },
      { id: "prince", title: "The Prince", author: "Niccolò Machiavelli", color: "#7a2a2a", description: "Cold, practical advice on gaining and keeping power." },
      { id: "utilitarianism", title: "Utilitarianism", author: "John Stuart Mill", color: "#2f5a4a", description: "The case for judging actions by how much happiness they create." },
    ],
  },
  {
    id: "poetry", title: "Poetry", mood: "#ff8fb8", theme: "fantasy",
    books: [
      { id: "leaves", title: "Leaves of Grass", author: "Walt Whitman", color: "#4a6b32", description: "Whitman's sprawling song of himself, America and everyone in it." },
      { id: "gitanjali", title: "Gitanjali", author: "Rabindranath Tagore", color: "#a0602a", description: "Song offerings: short devotional poems that won Tagore the Nobel Prize." },
      { id: "rubaiyat", title: "The Rubáiyát", spineTitle: "Rubáiyát", author: "Omar Khayyám", color: "#7a3a5a", description: "Quatrains on wine, time and making the most of the moment." },
      { id: "divine", title: "The Divine Comedy", spineTitle: "Divine Comedy", author: "Dante Alighieri", color: "#2f3a6b", description: "A journey through Hell, Purgatory and Paradise." },
    ],
  },
  {
    id: "history", title: "History", mood: "#e0b060", theme: "chinese",
    books: [
      { id: "histories", title: "The Histories", author: "Herodotus", color: "#8a5a2a", description: "The first great history book: the wars between Greece and Persia, and every story along the way." },
      { id: "peloponnesian", title: "History of the Peloponnesian War", spineTitle: "Peloponnesian War", author: "Thucydides", color: "#5a3a2a", description: "A clear-eyed account of Athens and Sparta destroying each other." },
      { id: "plutarch", title: "Parallel Lives", author: "Plutarch", color: "#3a4a5a", description: "Paired biographies of famous Greeks and Romans, and what made them great or small." },
    ],
  },
  {
    id: "science", title: "Science", mood: "#7fd4ff", theme: "space",
    books: [
      { id: "origin", title: "On the Origin of Species", spineTitle: "Origin of Species", author: "Charles Darwin", color: "#2f5a3a", description: "The argument for evolution by natural selection." },
      { id: "beagle", title: "The Voyage of the Beagle", spineTitle: "Voyage of the Beagle", author: "Charles Darwin", color: "#2a4a6b", description: "Darwin's travel journal from five years around the world." },
      { id: "relativity", title: "Relativity", author: "Albert Einstein", color: "#4a3a6b", description: "Einstein explains special and general relativity for curious readers." },
      { id: "opticks", title: "Opticks", author: "Isaac Newton", color: "#6b4a2a", description: "Newton's experiments with light and colour." },
    ],
  },
  {
    id: "mythology", title: "Mythology", mood: "#ffcf6a", theme: "vedic",
    books: [
      { id: "odyssey", title: "The Odyssey", author: "Homer", color: "#2a4a6b", description: "Odysseus spends ten years trying to get home." },
      { id: "ramayana", title: "Ramayana", author: "Valmiki", color: "#a0522d", description: "Rama's exile, the abduction of Sita and the war to bring her back." },
      { id: "gilgamesh", title: "The Epic of Gilgamesh", spineTitle: "Gilgamesh", author: "Anonymous", color: "#6b5a2a", description: "The oldest great story: a king, his friend, and the search for immortality." },
      { id: "kalevala", title: "Kalevala", author: "Elias Lönnrot", color: "#3a5a6b", description: "Finland's national epic of singers, smiths and magic." },
    ],
  },
];

/** Turn a pool entry into shelf-ready books. Sizes vary a little so shelves look natural. */
export function poolBooks(genreId: string, month: number): Book[] {
  const g = GENRE_POOL.find((p) => p.id === genreId);
  if (!g) return [];
  return g.books.map((s, i) => ({
    id: s.id,
    title: s.title,
    spineTitle: s.spineTitle ?? s.title,
    author: s.author,
    room: genreId,
    row: (i < 3 ? 0 : 1) as 0 | 1,
    color: s.color,
    w: [62, 54, 70, 50, 58][i % 5],
    h: [176, 160, 184, 150, 168][i % 5],
    progress: 0,
    pages: 200 + i * 60,
    description: s.description,
    highlights: [],
    addedMonth: month,
  }));
}

# Bunko: UI Concept

Oct 15, 2026 · @Gungun

## Overview

Build a walkable library as the home and explore mode, but always keep a fast way in. A library you walk through turns a book collection into a place, which makes the demo memorable. The trap: if walking is the only way to find a book, it gets tiring by week two.

- **Walkable library = home and explore mode.** Browse, discover and wander for fun.
- **Quick access is always there.** "Continue reading" in one click, plus `Ctrl + K` search to jump straight to any book.

## Core features (what the app does)

The app is a personal library where you read your own books and discuss them with an AI that only knows what you have read so far.

| Feature | What it does |
| --- | --- |
| Library + reader | Upload EPUB/PDF books you own or public-domain books (Project Gutenberg); read inside the app; reading position tracked per book |
| Ask about a book | RAG answers about one book, every answer cites the page; clicking a citation jumps to and highlights that paragraph |
| Ask across the library | Questions over all books or one genre, e.g. "which books talk about habits?" |
| Spoiler-safe answers | Retrieval only uses text up to your current reading position, so nothing past your page is revealed |
| Cross-book connections | Knowledge graph of characters, concepts and ideas; surfaces where books agree, disagree or overlap |
| Discussion partner | After a chapter, asks you questions, pushes back on your opinions with evidence from the text |
| Highlights and notes | Saved and searchable ("what did I find important about leadership?"), with spaced-repetition review |
| Reading map | Visual map of topics read, how they connect and where the gaps are |

## Tech stack (AI core + app)

The AI core is position-aware hybrid RAG plus a knowledge graph, orchestrated by LangGraph and served from FastAPI; the UI layer is listed under Tools below.

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | Next.js (App Router) + TypeScript, Tailwind CSS, shadcn/ui | Modern, typed, fast to style |
| Book rendering | epub.js, pdf.js | Read EPUB and PDF in-app with page/position tracking |
| Backend API | FastAPI (Python, async), streaming answers over SSE | Matches the AI/Python ecosystem |
| Ingestion | ebooklib (EPUB), PyMuPDF (PDF); background jobs with Redis + a task queue | Chunk by chapter and paragraph; every chunk stores book, chapter, page and character offset |
| Embeddings | BGE-M3 (dense + sparse, multilingual) | Hybrid search in one model; handles Hindi/Sanskrit text for the Vedic shelf |
| Vector store | Qdrant (or Postgres + pgvector) | Hybrid search with metadata filters, needed for spoiler-safe retrieval |
| Reranker | bge-reranker-v2-m3 | Sharper top results before the LLM sees them |
| Spoiler-safe retrieval | Metadata filter: chunk position ≤ your reading position, plus a post-answer leak check | The signature AI feature |
| Knowledge graph | LLM entity/relation extraction per chunk, stored in Neo4j (or Postgres tables); GraphRAG-style queries | Cross-book connections and the reading map |
| Agents | LangGraph: tools for search\_book, search\_library, get\_highlights, graph\_query | Discussion partner and librarian character |
| LLM | Claude/OpenAI API, or a local model served with vLLM | Swap per cost and privacy |
| MCP server | Expose the library (search, highlights, graph) to Claude Code, Claude Desktop or Cursor | Ask about your books from any AI tool |
| Memory and review | Highlights and notes in the database; FSRS algorithm for spaced repetition | Turns reading into retained knowledge |
| Observability | Langfuse tracing | See every retrieval and LLM call |
| Evaluation | Hand-written question set per book: spoiler leak rate, citation accuracy, retrieval recall@k, answer faithfulness | Proves the AI works, with numbers |
| Infra | Docker Compose (web, api, worker, Qdrant, Neo4j, Redis) | One command to run everything locally |

## 3D or 2.5D

Start with 2.5D (side-scrolling or isometric); upgrade to 3D later if wanted.

| Option | What it is | Pros | Cons |
| --- | --- | --- | --- |
| 2.5D (recommended) | Illustrated scene scrolled sideways, layers moving at different speeds (parallax) | Much easier to build, smooth on any laptop, easy to make gorgeous (Studio Ghibli background / cozy indie game feel) | Less immersive than true 3D |
| Full 3D first-person | Walk through like a video game | Most impressive | Models, lighting, camera and performance work; key-based walking feels clumsy on the web; risk of never finishing the AI part |

## How it could feel (Japanese theme)

The signature moment is touching a book: it slides out, floats toward you and opens into a card.

- **Entrance:** shoji doors slide open; soft lantern light, a few cherry petals drifting down.
- **Walking between sections:** scroll sideways through rooms, one per genre:
  - Fiction: tatami room with low wooden shelves and lanterns
  - Self-help: quiet garden room with a stone path
  - Tech: a study with a desk, scrolls and an ink brush
- **Touching a book:** hover and it tilts slightly forward on the shelf. Click and it slides out, floats toward you and opens into a card with cover, short description, progress and highlights. Buttons: *Read*, *Ask*, *Connections*.
- **The librarian:** a small animated character (cat, fox spirit or old librarian) in the corner. Click it to ask questions, e.g. "Recommend something like the book I just finished." This is the AI, with personality.
- **Day and night:** lighting follows your real time of day; evening means glowing lanterns and warmer rooms.
- **Growing library:** finishing a book marks its spine or grows a plant in the room, so the library visibly fills up over months.

## Themes and the theme system

Build a theme system from day one: the layout stays fixed and only the skin changes.

| Theme | Key visuals |
| --- | --- |
| Japanese | Shoji doors, tatami rooms, lanterns, cherry petals |
| Chinese | Moon gates between rooms, scroll shelves, ink-wash mountain backgrounds, a tea table for discussion mode |
| Vedic | Gurukul-style ashram under a banyan tree, carved stone pillars, palm-leaf manuscripts tied in bundles, glowing diyas, Devanagari motifs, river ghats at dusk; a sage or hamsa (swan) as librarian; discussion mode as a debate circle around a fire; earthy saffron, sandalwood and brass palette |
| Modern | Glass-and-wood library, big windows, plants, city lights at night |
| Fantasy | Magic tower, one floor per genre, floating books |

- **Fixed for every theme:** rooms, shelves, book slots.
- **Swappable skin:** backgrounds, shelf art, sounds, colours, character.
- Changing themes means swapping assets, not rebuilding the app, which is also a good engineering point for interviews.
- For Japanese, Chinese or Vedic themes, study real references (tea houses, libraries, gardens). Authentic details make it feel respectful rather than like a costume.

## Tools

The hardest part is not the code but keeping all the art in one consistent style; pick an art direction early (e.g. soft watercolor, warm light) and stick to it.

| Part of the app | Tool |
| --- | --- |
| Hero 3D moments (book opening, entrance, particles, star map) | Three.js via React Three Fiber + drei |
| Walking between rooms (2.5D parallax) | Motion or GSAP; PixiJS for heavier 2D effects |
| UI animations (panels, cards, transitions) | Motion |
| Librarian character | Rive or Lottie |
| Reader, chat, search | Plain HTML + Tailwind (no 3D: text must stay sharp and still) |
| Sounds (pages, wind, rain) | Howler.js, with a mute button |
| Free 3D models | Poly Pizza, Kenney, Sketchfab (check licenses) |

### Three.js: where to use it

Use Three.js for the wow moments only, never for the whole app.

- **Touching a book:** a real 3D book slides off the shelf, turns toward you and opens its cover with bending pages. The best use of 3D in the app.
- **Entrance:** the camera glides through the doors (shoji doors, stone gate, temple doorway).
- **Particles and atmosphere:** cherry petals (Japanese), diya flames and floating dust (Vedic), ink mist (Chinese), floating books (Fantasy).
- **Reading map:** the knowledge graph as glowing stars you can rotate.
- **Lighting:** real day/night lighting and soft shadows.
- **Performance rules:** compressed glTF models (Draco), lazy-load 3D parts, target 60fps on a normal laptop, and fall back to the 2D version on slow devices or when reduce-motion is on.
- **Time:** do the AI core first, then add 3D moments one by one.

## Build plan

Phase 1 is UI demos of every theme so one can be chosen; real building starts only after that choice.

### Phase 1: Theme demos (choose one)

- [x] Build one clickable demo per theme: Japanese, Chinese, Vedic, Modern, Fantasy
- [x] Every demo shows the same three moments: the entrance, walking between two rooms, and touch a book → it floats out → description card
- [x] All demos share one layout and swap only the skin (proves the theme system early)
- [x] Use placeholder books and placeholder art; no backend yet. Each demo includes one Three.js moment: the 3D book opening plus that theme's particles
- [ ] **Gate:** pick one theme (or a mix) before Phase 2

### Phase 2: Reader and library

- [ ] Next.js app with the chosen theme: one room (e.g. Fiction) with 10–15 real books
- [x] Upload EPUB/PDF, reader with position tracking, "Continue reading" button, `Ctrl + K` search
- [x] FastAPI backend, ingestion pipeline, Docker Compose

### Phase 3: AI core

- [x] Hybrid RAG with citations that jump to the paragraph
- [x] Spoiler-safe retrieval filtered by reading position
- [ ] Evaluation set and first numbers (spoiler leak rate, citation accuracy)

### Phase 4: Depth

- [x] Highlights, notes and spaced-repetition review
- [x] Knowledge graph and cross-book connections
- [x] Librarian character and discussion partner (LangGraph agent)
- [x] MCP server

### Phase 5: Polish

- [ ] More rooms, day/night lighting, sounds, growing library
- [ ] Reading map, empty states, loading skeletons, reduced-motion support

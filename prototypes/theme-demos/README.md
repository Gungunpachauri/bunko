# Bunko: Phase 1 theme demos

Five themes (Japanese, Chinese, Vedic, Space, Fantasy) plus a **Mixed** mode, for picking a skin before Phase 2. Every theme uses the same world layout and swaps only the skin.

```bash
npm install
npm run dev        # http://localhost:5173
```

Pick a theme with the pills at the top, keys `1`–`6`, or a URL hash like `#/vedic`, `#/space` or `#/mixed`. The earlier 2.5D side-scroller is still available at `?view=classic`.

## The 3D journey (default)

A scroll-driven camera flight through one continuous world on the water, in five chapters:

1. **The gate**: a theme gate stands in the water (torii, moon gate, torana, glass portal, gothic arch).
2. **Fiction**: fly through the gate to a pavilion on an island. Its shelf holds real 3D books, and each spine uses the theme's own spine art.
3. **The crossing**: the genre transition. You walk an arched bridge through a glowing portal while loose pages swirl around you, and the air shifts from Fiction's warm light to Self-help's cool light.
4. **Self-help**: the second pavilion.
5. **The overlook**: the camera rises above the whole library, with reading stats and "Continue reading".

Controls: scroll, swipe, the arrow keys / Space / Enter, or the chapter rail on the right. The camera settles on the nearest chapter.

Touching a book: hover lifts it from the shelf. Click and it flies out and opens into the description card (Read / Ask / Connections are placeholders).

Time of day: the pill under the top bar switches between Morning mist, Golden hour and Night. The default follows your clock.

## Space theme

The Space theme puts the library on a station orbiting a black hole:
- The islands are floating asteroids with no water beneath them, and stars surround you in every direction.
- The gates are glowing rings, and each room is an observatory dome with a star-map wall.
- The black hole has a lensed photon ring and an edge-on accretion disk.
- Time of day doesn't bring daylight here. It only changes the black hole's light and the nebula colours.

## Mixed mode (one theme per genre)

**✦ Mixed** builds every genre's room in its own culture. The mapping lives in `src/data/genres.ts`:

| Genre | Theme |
| --- | --- |
| Fiction | Japanese |
| Self-help | Vedic |
| Space & Astronomy | Space |
| Philosophy | Chinese |
| Poetry | Fantasy |
| History | Chinese |
| Science | Space |
| Mythology | Vedic |

- **The bridges are borders.** The near half is built like the room you're leaving and the far half like the room ahead. The portal in the middle is the destination's gate.
- **The sky follows you.** Approaching a Space room blends the sky into deep space and brings out the stars.
- **The rest follows the room you're in:** the HUD fonts and colours, the librarian, the screen particles and the book card.



The world isn't fixed to two rooms. It is generated from the genre list in `src/data/library.ts`. Every genre becomes an island room, and each new island zig-zags further out across the water, joined to the previous room by a bridge and a portal. The camera path, chapters, page storms, mood colours and the overlook view are all rebuilt to match.

Demo control: **＋ Add Space & Astronomy / Philosophy / Poetry / History / Science / Mythology** in the top bar adds the next placeholder genre one month after "today". The camera flies to the overlook, and then the new room rises from the water. Added genres are saved in this browser, so the library is still bigger next visit. **Reset demo genres** (at the overlook) goes back to the original two rooms.

Your theme choice is also remembered. Opening the app without a `#/theme` in the URL uses the theme you picked last.

In Phase 2, uploading a book in a new genre would call the same "add a room" path.

## Library over time

Click **◷ Library over time** in the top bar, or open `?timeline=1`. The camera rises to the overlook and plays through a year of reading:

- Rooms rise out of the water with a ripple: Fiction in month 1, Self-help and the bridge in month 3, and two empty future rooms (Philosophy in month 8, Poetry in month 11).
- Books slide onto the shelves in the month they were added, and finished books get a glowing gold band.
- Trees grow and the waterway fills with more lanterns.
- A headline and live stats (rooms, books, finished, % read) follow each month.

Drag the scrubber or click a month to jump. You can still walk to a shelf mid-year, and an opened book shows its progress for that month. "Back to today" returns to month 12. The placeholder year lives in `src/data/timeline.ts`.

## Code map

- `src/world/journey.ts`: chapters, world positions and the camera path. These are the same for every theme.
- `src/world/skins.ts`: per-theme 3D palette, architecture style, floating lights and scenery, plus the time-of-day presets.
- `src/world/architecture.tsx`: procedural gates, pavilions, islands, bridge, trees and distant scenery. Everything is built from primitives, so there are no model files.
- `src/world/Environment.tsx`: sky shader, fog, lights and the reflective water.
- `src/world/Effects.tsx`: floating lanterns, diyas, orbs and candles, plus the page storm.
- `src/world/Shelf3D.tsx`: clickable 3D shelf that keeps the slots from `src/layout.ts`.
- `src/WorldApp.tsx`: HUD, input and book opening.
- `src/themes/`: the original 2D skins (colours, fonts, spine art, librarian). The 3D world reuses them.

`prefers-reduced-motion` turns off particles and the page storm.

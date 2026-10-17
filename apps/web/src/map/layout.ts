import type { ApiReadingMap } from "@/lib/api";

export interface MapNode {
  key: string; // "b:<id>" or "i:<id>"
  kind: "book" | "idea";
  id: string | number;
  label: string;
  pos: [number, number, number];
  size: number;
  color: string;
  shared: boolean; // ideas found in two or more books
}

export interface MapEdge {
  a: string;
  b: string;
  kind: "in-book" | "related";
  color: string;
}

/** A repeatable pseudo-random number from a string, so the map looks the same every visit. */
function seeded(s: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/**
 * Books sit evenly on a large sphere; each idea starts between the books that mention it, then a short physics
 * pass spreads ideas apart (they repel) while keeping them near their books and related ideas (springs).
 * Shared ideas end up in the space between books, which is exactly where the connections are.
 */
export function layoutMap(data: ApiReadingMap): { nodes: MapNode[]; edges: MapEdge[] } {
  const R = 11;
  const books = data.books.filter((b) => data.ideas.some((i) => i.books.some((x) => x.book_id === b.id)));
  const lonely = data.books.filter((b) => !books.includes(b));
  const all = [...books, ...lonely];

  const pos = new Map<string, [number, number, number]>();
  const golden = Math.PI * (3 - Math.sqrt(5));
  all.forEach((b, i) => {
    const y = all.length === 1 ? 0 : 1 - (i / (all.length - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const t = golden * i;
    // Books without mapped ideas float a little further out.
    const radius = books.includes(b) ? R : R * 1.35;
    pos.set(`b:${b.id}`, [Math.cos(t) * r * radius, y * radius * 0.7, Math.sin(t) * r * radius]);
  });

  const ideas = data.ideas;
  const p = ideas.map((idea) => {
    const rnd = seeded(`i:${idea.id}`);
    const anchors = idea.books.map((x) => pos.get(`b:${x.book_id}`)!).filter(Boolean);
    const c = anchors.reduce((acc, a) => [acc[0] + a[0], acc[1] + a[1], acc[2] + a[2]], [0, 0, 0]).map((v) => v / Math.max(1, anchors.length));
    // Ideas of a single book start close to it (inside the sphere); shared ones start between their books.
    const pull = anchors.length > 1 ? 0.75 : 0.72;
    return [c[0] * pull + (rnd() - 0.5) * 2, c[1] * pull + (rnd() - 0.5) * 2, c[2] * pull + (rnd() - 0.5) * 2] as [number, number, number];
  });
  const index = new Map(ideas.map((idea, i) => [idea.id, i]));

  for (let step = 0; step < 220; step++) {
    const cool = 1 - step / 220;
    const f = p.map(() => [0, 0, 0]);
    for (let i = 0; i < p.length; i++) {
      for (let j = i + 1; j < p.length; j++) {
        const dx = p[i][0] - p[j][0], dy = p[i][1] - p[j][1], dz = p[i][2] - p[j][2];
        const d2 = dx * dx + dy * dy + dz * dz + 0.01;
        if (d2 > 36) continue;
        const k = 0.9 / d2;
        f[i][0] += dx * k; f[i][1] += dy * k; f[i][2] += dz * k;
        f[j][0] -= dx * k; f[j][1] -= dy * k; f[j][2] -= dz * k;
      }
    }
    ideas.forEach((idea, i) => {
      for (const x of idea.books) {
        const a = pos.get(`b:${x.book_id}`);
        if (!a) continue;
        const dx = a[0] - p[i][0], dy = a[1] - p[i][1], dz = a[2] - p[i][2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-6;
        const k = 0.02 * (d - 4.2) / d;
        f[i][0] += dx * k; f[i][1] += dy * k; f[i][2] += dz * k;
      }
    });
    for (const l of data.links) {
      const i = index.get(l.source), j = index.get(l.target);
      if (i === undefined || j === undefined) continue;
      const dx = p[j][0] - p[i][0], dy = p[j][1] - p[i][1], dz = p[j][2] - p[i][2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-6;
      const k = 0.015 * (d - 2.2) / d;
      f[i][0] += dx * k; f[i][1] += dy * k; f[i][2] += dz * k;
      f[j][0] -= dx * k; f[j][1] -= dy * k; f[j][2] -= dz * k;
    }
    p.forEach((v, i) => {
      for (let a = 0; a < 3; a++) v[a] += Math.max(-0.6, Math.min(0.6, f[i][a])) * cool;
    });
  }

  const moodOf = new Map(data.books.map((b) => [b.id, b.mood]));
  const nodes: MapNode[] = [
    ...all.map((b) => ({
      key: `b:${b.id}`, kind: "book" as const, id: b.id, label: b.title.split(/[;:(]/)[0].trim(), pos: pos.get(`b:${b.id}`)!,
      size: 0.55 + Math.min(0.35, b.progress * 0.5), color: b.mood || "#ffcf6a", shared: false,
    })),
    ...ideas.map((idea, i) => ({
      key: `i:${idea.id}`, kind: "idea" as const, id: idea.id, label: idea.name, pos: p[i],
      size: 0.1 + Math.min(0.22, idea.count * 0.03) + (idea.books.length > 1 ? 0.08 : 0),
      color: idea.books.length > 1 ? "#fff6dc" : moodOf.get(idea.books[0]?.book_id) ?? "#c8c8ff",
      shared: idea.books.length > 1,
    })),
  ];
  const edges: MapEdge[] = [
    ...ideas.flatMap((idea) => idea.books.map((x) => ({ a: `i:${idea.id}`, b: `b:${x.book_id}`, kind: "in-book" as const, color: moodOf.get(x.book_id) ?? "#888" }))),
    ...data.links.filter((l) => index.has(l.source) && index.has(l.target))
      .map((l) => ({ a: `i:${l.source}`, b: `i:${l.target}`, kind: "related" as const, color: "#ffffff" })),
  ];
  return { nodes, edges };
}

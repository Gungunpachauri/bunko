// 3D skins: one per theme. Geometry builders read these; the layout never changes.
import type { ThemeId } from "@/library/themes/types";

export type TimeOfDay = "dusk" | "night" | "dawn";

export interface Atmosphere {
  skyTop: string;
  horizon: string;
  skyBottom: string;
  fog: string;
  fogDensity: number;
  sun: string;
  sunHeight: number;
  ambient: number;
  lanterns: number;
  water: string;
}

const TIME: Record<TimeOfDay, Atmosphere> = {
  dusk: { skyTop: "#3a3157", horizon: "#f1a46f", skyBottom: "#6a4b5c", fog: "#c88a76", fogDensity: 0.016, sun: "#ffb27a", sunHeight: 0.06, ambient: 0.6, lanterns: 1.1, water: "#3a2f3f" },
  night: { skyTop: "#040712", horizon: "#1f2747", skyBottom: "#090c1a", fog: "#151b33", fogDensity: 0.02, sun: "#9fb4ff", sunHeight: 0.35, ambient: 0.28, lanterns: 2.2, water: "#070b18" },
  dawn: { skyTop: "#6d8db6", horizon: "#f5d8bf", skyBottom: "#b4c2cc", fog: "#d9d3cb", fogDensity: 0.014, sun: "#fff1d9", sunHeight: 0.1, ambient: 0.9, lanterns: 0.35, water: "#7f97a2" },
};

export interface WorldSkin {
  /** Mixed into horizon and fog for the theme's character. */
  tint: string;
  tintAmount: number;
  wood: string;
  trim: string;
  roof: string;
  stone: string;
  ground: string;
  glow: string;
  accent: string;
  paper: string;
  /** How lights float on the waterway. */
  floaters: "water-lanterns" | "sky-lanterns" | "diyas" | "motes" | "candles";
  scenery: "fuji" | "karst" | "ghats" | "blackhole" | "floating";
  flora: "sakura" | "bamboo" | "banyan" | "asteroids" | "crystals";
  /** Out in space: no water, stars all around, the black hole lights the scene. */
  space?: boolean;
}

export const SKINS: Record<ThemeId, WorldSkin> = {
  japanese: {
    tint: "#ff9fb4", tintAmount: 0.15, wood: "#4a3022", trim: "#c4402a", roof: "#2f2d35", stone: "#8a857b",
    ground: "#5b6b4a", glow: "#ffbe73", accent: "#c4402a", paper: "#f6ead0",
    floaters: "water-lanterns", scenery: "fuji", flora: "sakura",
  },
  chinese: {
    tint: "#9fc4b2", tintAmount: 0.2, wood: "#4a2a20", trim: "#a3302c", roof: "#3e4247", stone: "#e8e2d4",
    ground: "#4d6a52", glow: "#ff8a5a", accent: "#a3302c", paper: "#efe6d2",
    floaters: "sky-lanterns", scenery: "karst", flora: "bamboo",
  },
  vedic: {
    tint: "#ff8a2a", tintAmount: 0.22, wood: "#6b3f22", trim: "#c99a3b", roof: "#b49068", stone: "#c2a57c",
    ground: "#7a5a32", glow: "#ffb347", accent: "#e07b24", paper: "#ecd9a8",
    floaters: "diyas", scenery: "ghats", flora: "banyan",
  },
  space: {
    tint: "#6a4aff", tintAmount: 0.25, wood: "#262c44", trim: "#c9d0e8", roof: "#2e3550", stone: "#8a93b0",
    ground: "#3a3550", glow: "#5fd0ff", accent: "#ff8a3a", paper: "#e9ecf5",
    floaters: "motes", scenery: "blackhole", flora: "asteroids", space: true,
  },
  fantasy: {
    tint: "#9a6aff", tintAmount: 0.3, wood: "#3a2418", trim: "#e3b75a", roof: "#2a2440", stone: "#4a4366",
    ground: "#2f3a4a", glow: "#7fe3ff", accent: "#e3b75a", paper: "#efe2bf",
    floaters: "candles", scenery: "floating", flora: "crystals",
  },
};

/** Space has no day: the time of day only shifts the black hole's light and the nebula. */
const SPACE_TIME: Record<TimeOfDay, Atmosphere> = {
  dusk: { skyTop: "#05030c", horizon: "#160a24", skyBottom: "#05030c", fog: "#120a20", fogDensity: 0.0035, sun: "#ffb070", sunHeight: 0.18, ambient: 0.5, lanterns: 1.6, water: "#0a0614" },
  night: { skyTop: "#020208", horizon: "#080a20", skyBottom: "#020208", fog: "#070818", fogDensity: 0.003, sun: "#9fc4ff", sunHeight: 0.2, ambient: 0.4, lanterns: 2.0, water: "#04050c" },
  dawn: { skyTop: "#08061a", horizon: "#1e1236", skyBottom: "#08061a", fog: "#181030", fogDensity: 0.004, sun: "#ffc8f0", sunHeight: 0.16, ambient: 0.6, lanterns: 1.3, water: "#100a1c" },
};

export function atmosphere(time: TimeOfDay, space = false) {
  return space ? SPACE_TIME[time] : TIME[time];
}

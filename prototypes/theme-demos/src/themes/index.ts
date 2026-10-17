import type { Theme, ThemeId } from "./types";
import { japanese } from "./japanese";
import { chinese } from "./chinese";
import { vedic } from "./vedic";
import { space } from "./space";
import { fantasy } from "./fantasy";

export const THEMES: Theme[] = [japanese, chinese, vedic, space, fantasy];

export function getTheme(id: string | null | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export type { Theme, ThemeId };

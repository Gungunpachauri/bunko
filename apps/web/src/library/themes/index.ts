import type { Theme, ThemeId } from "@/library/themes/types";
import { japanese } from "@/library/themes/japanese";
import { chinese } from "@/library/themes/chinese";
import { vedic } from "@/library/themes/vedic";
import { space } from "@/library/themes/space";
import { fantasy } from "@/library/themes/fantasy";

export const THEMES: Theme[] = [japanese, chinese, vedic, space, fantasy];

export function getTheme(id: string | null | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export type { Theme, ThemeId };

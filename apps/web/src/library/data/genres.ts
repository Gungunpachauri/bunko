import type { ThemeId } from "@/library/themes/types";

/** A genre is a room in the library. */
export interface Genre {
  id: string;
  title: string;
  /** Month the room rose from the water (see timeline.ts). */
  month: number;
  /** Colour the air takes on in this room. */
  mood: string;
  /** Style this room is built in when the library is in Mixed mode. */
  theme: ThemeId;
}

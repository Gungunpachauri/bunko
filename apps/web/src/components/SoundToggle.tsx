"use client";

import { useSyncExternalStore } from "react";
import { sound } from "@/lib/sound";

/** Turns the library's sounds on or off (remembered). Off until you choose. A speaker icon: waves when on, a cross when off. */
export function SoundToggle({ className = "chip" }: { className?: string; compact?: boolean }) {
  const on = useSyncExternalStore(sound.subscribe, sound.getEnabled, () => false);
  return (
    <button className={`${className} sound-toggle ${on ? "on" : ""}`} onClick={() => sound.setEnabled(!on)}
      title={on ? "Sound is on. Click to turn it off." : "Sound is off. Click to turn on soft background sounds."}
      aria-label={on ? "Turn sound off" : "Turn sound on"} aria-pressed={on}>
      <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" fillOpacity="0.18" />
        {on ? (
          <>
            <path d="M15.5 9a4 4 0 0 1 0 6" />
            <path d="M18 6.5a7.5 7.5 0 0 1 0 11" />
          </>
        ) : (
          <path d="M16 9.5l5 5M21 9.5l-5 5" />
        )}
      </svg>
    </button>
  );
}

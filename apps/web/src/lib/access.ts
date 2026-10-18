"use client";

import { useEffect, useState } from "react";
import { api, type ApiAccess } from "@/lib/api";

const OPEN: ApiAccess = { visitor: false, demo: false, asks_left: null, ask_limit: null };
let shared: Promise<ApiAccess> | null = null;

/** Asked once per page load and shared by every component. If the server can't say, nothing is hidden. */
function load(): Promise<ApiAccess> {
  shared ??= api.access().catch(() => OPEN);
  return shared;
}

/**
 * Whether this browser is a visitor to the public demo (read and ask only) or the owner. Until the answer
 * arrives it's treated as a visitor, so buttons that would be refused never flash on screen.
 */
export function useAccess(): ApiAccess & { known: boolean } {
  const [access, setAccess] = useState<ApiAccess | null>(null);
  useEffect(() => {
    let alive = true;
    load().then((a) => { if (alive) setAccess(a); });
    return () => { alive = false; };
  }, []);
  return access ? { ...access, known: true } : { ...OPEN, visitor: true, known: false };
}

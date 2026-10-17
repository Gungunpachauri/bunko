"use client";

import { useState } from "react";

export interface ThemedOption {
  value: string;
  label: string;
}

/**
 * A dropdown that follows the theme. The browser's own <select> list ignores page styles (it opens in bright
 * system blue), so this draws its own list. Keyboard: Enter/Space opens, arrows move, Enter picks, Esc closes.
 */
export function ThemedSelect({ value, options, onChange, label, variant = "pill" }: {
  value: string;
  options: ThemedOption[];
  onChange: (value: string) => void;
  label: string;
  /** "pill": a compact chip (chat panels). "field": a full-width form field (dialogs). */
  variant?: "pill" | "field";
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const current = options.find((o) => o.value === value) ?? options[0];

  const pick = (o: ThemedOption) => {
    onChange(o.value);
    setOpen(false);
  };
  const toggle = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen((o) => !o);
  };

  return (
    <div className={`tsel ${variant}`} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}
      onKeyDown={(e) => {
        if (!open) return;
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
        } else if (e.key === "Enter") {
          e.preventDefault();
          pick(options[active]);
        } else if (e.key === "Escape") {
          e.stopPropagation();
          setOpen(false);
        }
      }}>
      <button type="button" className="tsel-btn" aria-haspopup="listbox" aria-expanded={open} aria-label={label} onClick={toggle}>
        <span>{current?.label}</span>
        <i aria-hidden>▾</i>
      </button>
      {open && (
        <ul className="tsel-menu" role="listbox" aria-label={label}>
          {options.map((o, i) => (
            <li key={o.value || "_"}>
              <button type="button" role="option" aria-selected={o.value === value}
                className={`${o.value === value ? "on" : ""} ${i === active ? "active" : ""}`}
                onMouseEnter={() => setActive(i)} onClick={() => pick(o)}>
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

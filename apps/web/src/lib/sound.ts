"use client";

/**
 * Sounds for the library, made in the browser with the Web Audio API (no sound files to download).
 *
 *  - Ambience per theme, very quiet: wind and wind chimes (Japanese), a stream and plucked notes (Chinese),
 *    a tanpura-like drone and temple bells (Vedic), a deep hum and far pings (Space), a soft pad and sparkles (Fantasy).
 *  - Small one-shots: a page turn, a book sliding off the shelf, a soft chime.
 *
 * Off until the reader turns it on (browsers also only allow audio after a click). The choice is remembered.
 */

export type AmbienceId = "japanese" | "chinese" | "vedic" | "space" | "fantasy";
export type Effect = "page" | "open" | "close" | "chime";

const KEY = "bunko:sound";
const OLD_KEY = "walkable-library:sound"; // the name before Bunko; still read so the setting carries over
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66]; // C D E G A (C6…)

class SoundEngine {
  enabled = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private ambience: { id: AmbienceId; level: number; stop: () => void } | null = null;
  private wanted: { id: AmbienceId; level: number } | null = null;
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window !== "undefined") {
      try { this.enabled = (localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY)) === "on"; } catch { /* storage unavailable */ }
      // Browsers start audio only after a user gesture: wake up on the first click if sound was left on.
      const wake = () => { if (this.enabled) this.start(); window.removeEventListener("pointerdown", wake); };
      window.addEventListener("pointerdown", wake);
    }
  }

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getEnabled = () => this.enabled;

  setEnabled(on: boolean) {
    this.enabled = on;
    try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* not saved */ }
    if (on) {
      this.start();
      this.play("chime");
    } else {
      this.ambience?.stop();
      this.ambience = null;
      void this.ctx?.suspend();
    }
    this.listeners.forEach((fn) => fn());
  }

  /** The background sound for a theme; level scales it (the reader uses less). */
  setAmbience(id: AmbienceId | null, level = 1) {
    this.wanted = id ? { id, level } : null;
    if (!this.enabled || !this.ctx) return;
    if (this.ambience && id && this.ambience.id === id && this.ambience.level === level) return;
    this.ambience?.stop();
    this.ambience = id ? { id, level, stop: AMBIENCES[id](this.ctx, this.out(level), this.noiseBuffer()) } : null;
  }

  play(effect: Effect) {
    if (!this.enabled || !this.ctx || this.ctx.state !== "running") return;
    EFFECTS[effect](this.ctx, this.master!, this.noiseBuffer());
  }

  private start() {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.6;
      this.master.connect(this.ctx.destination);
    }
    void this.ctx.resume();
    if (this.wanted && !this.ambience) this.setAmbience(this.wanted.id, this.wanted.level);
  }

  /** A gain stage for one ambience that fades in now and fades out when stopped. */
  private out(level: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0, this.ctx!.currentTime);
    g.gain.linearRampToValueAtTime(level, this.ctx!.currentTime + 2.5);
    g.connect(this.master!);
    return g;
  }

  private noiseBuffer(): AudioBuffer {
    if (!this.noise) {
      const ctx = this.ctx!;
      this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return this.noise;
  }
}

// ── building blocks ─────────────────────────────────────────────────────

function noiseSource(ctx: AudioContext, buf: AudioBuffer): AudioBufferSourceNode {
  const s = ctx.createBufferSource();
  s.buffer = buf;
  s.loop = true;
  s.start();
  return s;
}

function lfo(ctx: AudioContext, rate: number, depth: number, target: AudioParam): OscillatorNode {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.value = rate;
  g.gain.value = depth;
  o.connect(g).connect(target);
  o.start();
  return o;
}

/** A single decaying note (chime, bell, pluck). */
function note(ctx: AudioContext, out: AudioNode, freq: number, { type = "sine", gain = 0.12, decay = 2.5, when = 0 }: { type?: OscillatorType; gain?: number; decay?: number; when?: number } = {}) {
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + decay + 0.05);
}

/** Calls `fn` at random intervals until stopped. */
function every(minS: number, maxS: number, fn: () => void): () => void {
  let id = 0;
  const next = () => { id = window.setTimeout(() => { fn(); next(); }, (minS + Math.random() * (maxS - minS)) * 1000); };
  next();
  return () => window.clearTimeout(id);
}

function stopper(out: GainNode, ctx: AudioContext, nodes: (AudioScheduledSourceNode)[], timers: (() => void)[]) {
  return () => {
    timers.forEach((t) => t());
    const t = ctx.currentTime;
    out.gain.cancelScheduledValues(t);
    out.gain.setValueAtTime(out.gain.value, t);
    out.gain.linearRampToValueAtTime(0, t + 1.2);
    window.setTimeout(() => { nodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } }); out.disconnect(); }, 1400);
  };
}

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

// ── ambiences ───────────────────────────────────────────────────────────

const AMBIENCES: Record<AmbienceId, (ctx: AudioContext, out: GainNode, noise: AudioBuffer) => () => void> = {
  japanese(ctx, out, noise) {
    // Wind through the garden: filtered noise whose pitch and volume drift.
    const src = noiseSource(ctx, noise);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 600; bp.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.value = 0.05;
    src.connect(bp).connect(g).connect(out);
    const l1 = lfo(ctx, 0.07, 350, bp.frequency);
    const l2 = lfo(ctx, 0.11, 0.025, g.gain);
    // Now and then a few wind chimes.
    const chimes = every(5, 12, () => {
      for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) note(ctx, out, pick(PENTATONIC) * 2, { gain: 0.035, decay: 3.5, when: i * (0.12 + Math.random() * 0.2) });
    });
    return stopper(out, ctx, [src, l1, l2], [chimes]);
  },
  chinese(ctx, out, noise) {
    // A small stream (bright, bubbly noise) and an occasional plucked string.
    const src = noiseSource(ctx, noise);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = 1.4;
    const g = ctx.createGain(); g.gain.value = 0.025;
    src.connect(bp).connect(g).connect(out);
    const l1 = lfo(ctx, 3.3, 500, bp.frequency);
    const plucks = every(4, 9, () => {
      const base = pick([196, 220, 261.63, 293.66, 329.63]);
      note(ctx, out, base, { type: "triangle", gain: 0.06, decay: 1.8 });
      if (Math.random() < 0.5) note(ctx, out, base * 1.5, { type: "triangle", gain: 0.04, decay: 1.6, when: 0.35 });
    });
    return stopper(out, ctx, [src, l1], [plucks]);
  },
  vedic(ctx, out) {
    // A tanpura-like drone on D with its fifth, and a far temple bell.
    const nodes: AudioScheduledSourceNode[] = [];
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 700;
    lp.connect(out);
    for (const [f, type, gain] of [[73.42, "sawtooth", 0.03], [110, "sawtooth", 0.022], [146.83, "sine", 0.03]] as const) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type; o.frequency.value = f; g.gain.value = gain;
      o.connect(g).connect(lp);
      o.start();
      nodes.push(o, lfo(ctx, 0.05 + Math.random() * 0.05, gain * 0.5, g.gain));
    }
    nodes.push(lfo(ctx, 0.03, 250, lp.frequency));
    const bells = every(9, 18, () => { note(ctx, out, 880, { gain: 0.04, decay: 6 }); note(ctx, out, 880 * 2.76, { gain: 0.012, decay: 4 }); });
    return stopper(out, ctx, nodes, [bells]);
  },
  space(ctx, out, noise) {
    // The station's deep hum, a slow rumble, and far-off pings.
    const nodes: AudioScheduledSourceNode[] = [];
    for (const [f, gain] of [[55, 0.05], [82.4, 0.025]] as const) {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = f; g.gain.value = gain;
      o.connect(g).connect(out); o.start();
      nodes.push(o, lfo(ctx, 0.04, gain * 0.6, g.gain));
    }
    const src = noiseSource(ctx, noise);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 160;
    const g = ctx.createGain(); g.gain.value = 0.06;
    src.connect(lp).connect(g).connect(out);
    nodes.push(src, lfo(ctx, 0.05, 80, lp.frequency));
    const pings = every(8, 16, () => note(ctx, out, pick([1318.5, 1567.98, 1760]), { gain: 0.018, decay: 3 }));
    return stopper(out, ctx, nodes, [pings]);
  },
  fantasy(ctx, out) {
    // A soft, slowly breathing chord and sparkles like floating candles.
    const nodes: AudioScheduledSourceNode[] = [];
    for (const f of [220, 277.18, 329.63, 440]) {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f; g.gain.value = 0.014;
      o.connect(g).connect(out); o.start();
      nodes.push(o, lfo(ctx, 0.06 + Math.random() * 0.06, 0.01, g.gain));
    }
    const sparkles = every(2, 6, () => {
      for (let i = 0; i < 3; i++) note(ctx, out, pick(PENTATONIC) * 2, { gain: 0.016, decay: 1.2, when: i * 0.08 });
    });
    return stopper(out, ctx, nodes, [sparkles]);
  },
};

// ── one-shots ───────────────────────────────────────────────────────────

const EFFECTS: Record<Effect, (ctx: AudioContext, out: AudioNode, noise: AudioBuffer) => void> = {
  page(ctx, out, noise) {
    // A paper swish: a short burst of noise sweeping down in pitch.
    const t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = noise;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(3800, t); bp.frequency.exponentialRampToValueAtTime(700, t + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    s.connect(bp).connect(g).connect(out);
    s.start(t, Math.random()); s.stop(t + 0.32);
  },
  open(ctx, out, noise) {
    // A book sliding off the shelf: a soft swish, then a low wooden knock.
    EFFECTS.page(ctx, out, noise);
    const t = ctx.currentTime + 0.12;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.25);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.32);
  },
  close(ctx, out) {
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.2);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.14, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.27);
  },
  chime(ctx, out) {
    note(ctx, out, 1046.5, { gain: 0.06, decay: 1.6 });
    note(ctx, out, 1567.98, { gain: 0.035, decay: 1.4, when: 0.09 });
  },
};

export const sound = new SoundEngine();

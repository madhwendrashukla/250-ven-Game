/**
 * Tiny Web Audio synthesiser: every sound is generated on the fly, so there are
 * no audio files to download or license. All functions take an optional delay in seconds.
 */
import { useSyncExternalStore } from 'react';

const MUTE_KEY = 'rs250:muted';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let muted = readMuted();
const listeners = new Set<() => void>();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    // Preference just won't persist.
  }
  listeners.forEach((l) => l());
}

export function useMuted(): [boolean, (v: boolean) => void] {
  const value = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    isMuted,
    isMuted,
  );
  return [value, setMuted];
}

function audio(): AudioContext | null {
  if (muted || typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.4;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface ToneOpts {
  freq: number;
  to?: number;
  type?: OscillatorType;
  at?: number;
  dur?: number;
  vol?: number;
  attack?: number;
  vibrato?: number;
}

function tone(c: AudioContext, o: ToneOpts): void {
  const t0 = c.currentTime + (o.at ?? 0);
  const dur = o.dur ?? 0.15;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
  if (o.vibrato) {
    const lfo = c.createOscillator();
    const depth = c.createGain();
    lfo.frequency.value = 6;
    depth.gain.value = o.vibrato;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(t0);
    lfo.stop(t0 + dur + 0.05);
  }
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(o.vol ?? 0.2, t0 + (o.attack ?? 0.005));
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(master!);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

interface NoiseOpts {
  at?: number;
  dur?: number;
  vol?: number;
  filter?: BiquadFilterType;
  freq?: number;
  to?: number;
  q?: number;
}

function noise(c: AudioContext, o: NoiseOpts): void {
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t0 = c.currentTime + (o.at ?? 0);
  const dur = o.dur ?? 0.2;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = c.createBiquadFilter();
  filter.type = o.filter ?? 'lowpass';
  filter.frequency.setValueAtTime(o.freq ?? 1000, t0);
  if (o.to) filter.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
  filter.Q.value = o.q ?? 1;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(o.vol ?? 0.2, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(gain).connect(master!);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

function play(fn: (c: AudioContext) => void): void {
  const c = audio();
  if (c) fn(c);
}

const arp = (c: AudioContext, notes: number[], gap: number, o: Omit<ToneOpts, 'freq'> = {}) =>
  notes.forEach((freq, i) => tone(c, { ...o, freq, at: (o.at ?? 0) + i * gap }));

export const sfx = {
  click: (at = 0) => play((c) => tone(c, { freq: 1100, type: 'triangle', dur: 0.045, vol: 0.06, at })),

  coin: (count = 1, at = 0) =>
    play((c) => {
      const n = Math.max(1, Math.min(8, Math.ceil(count / 2)));
      for (let i = 0; i < n; i++) {
        const t = at + i * 0.07;
        const lift = 1 + i * 0.03;
        tone(c, { freq: 1568 * lift, type: 'square', dur: 0.06, vol: 0.05, at: t });
        tone(c, { freq: 2093 * lift, type: 'square', dur: 0.2, vol: 0.05, at: t + 0.05 });
      }
    }),

  register: (at = 0) =>
    play((c) => {
      noise(c, { at, dur: 0.08, vol: 0.12, filter: 'highpass', freq: 4000 });
      tone(c, { freq: 2637, dur: 0.5, vol: 0.1, at: at + 0.06 });
      tone(c, { freq: 3136, dur: 0.6, vol: 0.08, at: at + 0.12 });
    }),

  thud: (at = 0) =>
    play((c) => {
      tone(c, { freq: 170, to: 55, dur: 0.22, vol: 0.35, at });
      noise(c, { at, dur: 0.1, vol: 0.15, freq: 500 });
      tone(c, { freq: 140, to: 50, dur: 0.18, vol: 0.25, at: at + 0.12 });
    }),

  chatter: (at = 0) =>
    play((c) => {
      [520, 700, 600, 820, 640].forEach((f, i) => tone(c, { freq: f, to: f * 1.15, type: 'triangle', dur: 0.06, vol: 0.07, at: at + i * 0.075 }));
    }),

  bubble: (at = 0) =>
    play((c) => {
      [0, 0.1, 0.2].forEach((d, i) => tone(c, { freq: 300 + i * 120, to: 900 + i * 200, dur: 0.12, vol: 0.1, at: at + d }));
    }),

  whoosh: (at = 0) =>
    play((c) => {
      noise(c, { at, dur: 0.3, vol: 0.1, filter: 'bandpass', freq: 400, to: 3200, q: 1.5 });
      tone(c, { freq: 900, to: 1400, type: 'sine', dur: 0.08, vol: 0.08, at: at + 0.22 });
    }),

  sparkle: (at = 0) => play((c) => arp(c, [1319, 1568, 1976, 2637, 3136], 0.05, { type: 'triangle', dur: 0.3, vol: 0.07, at })),

  rest: (at = 0) =>
    play((c) => {
      tone(c, { freq: 392, to: 196, dur: 0.7, vol: 0.1, attack: 0.08, at });
      tone(c, { freq: 494, to: 247, dur: 0.7, vol: 0.06, attack: 0.08, at: at + 0.05 });
    }),

  error: (at = 0) =>
    play((c) => {
      tone(c, { freq: 220, to: 140, type: 'square', dur: 0.16, vol: 0.06, at });
      tone(c, { freq: 180, to: 110, type: 'square', dur: 0.22, vol: 0.06, at: at + 0.12 });
    }),

  chime: (at = 0) =>
    play((c) => {
      tone(c, { freq: 880, dur: 1.1, vol: 0.12, at });
      tone(c, { freq: 1320, dur: 1.2, vol: 0.08, at: at + 0.12 });
      tone(c, { freq: 1760, dur: 1.3, vol: 0.04, at: at + 0.24 });
    }),

  good: (at = 0) => play((c) => arp(c, [523, 659, 784, 1047], 0.08, { type: 'triangle', dur: 0.25, vol: 0.1, at })),

  bad: (at = 0) => play((c) => arp(c, [440, 370, 311], 0.13, { type: 'triangle', dur: 0.3, vol: 0.1, at })),

  stamp: (at = 0) =>
    play((c) => {
      tone(c, { freq: 120, to: 45, dur: 0.25, vol: 0.4, at });
      noise(c, { at, dur: 0.12, vol: 0.2, freq: 1800 });
    }),

  fanfare: (at = 0) =>
    play((c) => {
      arp(c, [523, 659, 784], 0.11, { type: 'triangle', dur: 0.22, vol: 0.12, at });
      [1047, 1319, 1568].forEach((f) => tone(c, { freq: f, type: 'triangle', dur: 1.1, vol: 0.07, attack: 0.02, at: at + 0.36 }));
    }),

  sadTrombone: (at = 0) =>
    play((c) => {
      [392, 370, 349].forEach((f, i) => tone(c, { freq: f, type: 'sawtooth', dur: 0.32, vol: 0.05, at: at + i * 0.36 }));
      tone(c, { freq: 330, type: 'sawtooth', dur: 1.1, vol: 0.05, at: at + 1.08, vibrato: 6 });
    }),

  rank: (at = 0) => play((c) => arp(c, [784, 988, 1175, 1568], 0.07, { type: 'square', dur: 0.18, vol: 0.05, at })),
};

import { CHANNEL_ORDER } from './content';
import type { ChannelId, GameState, IdeaDef, LogKind, ModifierTarget, SizeHint } from './types';

export const START_CASH = 250;
export const MAX_DAYS = 30;
export const TIRED_THRESHOLD = 25;
export const MAX_QUALITY = 3;
const MAX_LOG = 250;

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function round5(n: number): number {
  return Math.max(5, Math.round(n / 5) * 5);
}

export function inventoryCount(s: GameState): number {
  return s.inventory.reduce((sum, b) => sum + b.qty, 0);
}

/** Removes stock oldest-first and returns how many units were taken. */
export function removeStock(s: GameState, qty: number): number {
  let left = qty;
  for (const batch of s.inventory) {
    const take = Math.min(batch.qty, left);
    batch.qty -= take;
    left -= take;
    if (left === 0) break;
  }
  s.inventory = s.inventory.filter((b) => b.qty > 0);
  return qty - left;
}

export function addLog(s: GameState, kind: LogKind, title: string, detail?: string): void {
  s.log.push({ day: s.day, kind, title, detail });
  if (s.log.length > MAX_LOG) s.log.splice(0, s.log.length - MAX_LOG);
}

export function addModifier(
  s: GameState,
  id: string,
  label: string,
  target: ModifierTarget,
  mult: number,
  days: number,
): void {
  s.modifiers = s.modifiers.filter((m) => m.id !== id);
  s.modifiers.push({ id, label, target, mult, until: s.day + days - 1 });
}

export function modifierMult(s: GameState, segment: number, channel: ChannelId): number {
  let mult = 1;
  for (const m of s.modifiers) {
    if (m.until < s.day) continue;
    const t = m.target;
    if (
      t.kind === 'all' ||
      (t.kind === 'segment' && t.index === segment) ||
      (t.kind === 'channel' && t.id === channel)
    ) {
      mult *= m.mult;
    }
  }
  return mult;
}

export function sizeHint(size: number): SizeHint {
  if (size < 0.75) return 'small';
  if (size < 1.25) return 'medium';
  return 'large';
}

/** Probability that someone who sees the offer is willing to pay `price`. */
export function willingness(price: number, wtp: number): number {
  return 1 / (1 + Math.exp((price - wtp) / (0.18 * wtp)));
}

/** Share of reached people who actually buy at a perfect price — rises with product quality. */
export function conversionBase(s: GameState): number {
  return 0.3 + 0.08 * s.quality;
}

export function bestChannelFor(idea: IdeaDef, segment: number): ChannelId {
  const fit = idea.segments[segment].fit;
  return CHANNEL_ORDER.filter((c) => c !== 'ads').reduce((best, c) => (fit[c] > fit[best] ? c : best));
}

/** Rough profit potential per segment — what a perfect player would chase. */
export function segmentPotential(s: GameState, idea: IdeaDef, segment: number): number {
  const seg = idea.segments[segment];
  const truth = s.truth[segment];
  const maxFit = Math.max(...CHANNEL_ORDER.map((c) => seg.fit[c]));
  return truth.size * maxFit * idea.demandScale * Math.max(0, 0.78 * truth.wtp - s.unitCost);
}

export function bestSegment(s: GameState, idea: IdeaDef): number {
  let best = 0;
  for (let i = 1; i < idea.segments.length; i++) {
    if (segmentPotential(s, idea, i) > segmentPotential(s, idea, best)) best = i;
  }
  return best;
}

export function formatRs(n: number): string {
  const sign = n < 0 ? '−' : '';
  return `${sign}₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`;
}

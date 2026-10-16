/**
 * Mid-run market shifts. Once or twice a run a segment's true value or crowd size moves for good,
 * so a price that was right in week one can be wrong in week three.
 */
import type { EventDef } from './events';
import { addLog, formatRs, round5, sizeHint } from './helpers';
import type { Rng } from './rng';
import type { GameState, IdeaDef, ShiftKind } from './types';

export const SHIFT_KINDS: ShiftKind[] = ['trend', 'priceWar', 'boom', 'fade'];
const PRICE_SHIFTS: ShiftKind[] = ['trend', 'priceWar'];

/** First move lands in week 2, an optional second in week 3 — never on a week-close morning. */
export function drawShiftDays(rng: Rng): number[] {
  const days = [rng.int(9, 13)];
  if (rng.chance(0.6)) days.push(rng.int(16, 20));
  return days;
}

export function shiftDue(s: GameState): boolean {
  return s.shiftDays.length > 0 && s.day >= s.shiftDays[0] && !s.pendingEvent && !s.perkOffer;
}

function placeFor(idea: IdeaDef, segment: number): string {
  const tags = idea.segments[segment].tags;
  if (tags.includes('student')) return 'hostel block';
  if (tags.includes('office')) return 'co-working tower';
  if (tags.includes('family')) return 'housing society';
  return 'metro station';
}

/** Segment name without asides like "(parents pay)", for headlines. */
function plainName(idea: IdeaDef, segment: number): string {
  return idea.segments[segment].name.replace(/\s*\(.*\)/, '');
}

/** The segment you've sold the most to (copycats follow the money), or a random one before any sales. */
function mainSegment(s: GameState, rng: Rng): number {
  const sales = s.stats.salesBySegment;
  if (!sales.some((v) => v > 0)) return rng.int(0, sales.length - 1);
  return sales.reduce((best, v, i) => (v > sales[best] ? i : best), 0);
}

export const SHIFT_EVENT: EventDef = {
  id: 'marketShift',
  make: (s, idea, rng) => {
    // The first move always changes what people will pay; a second can be anything else.
    const done = s.shifts.map((x) => x.kind);
    const kind = rng.pick(done.length === 0 ? PRICE_SHIFTS : SHIFT_KINDS.filter((k) => !done.includes(k)));
    const main = mainSegment(s, rng);
    const others = idea.segments.map((_, i) => i).filter((i) => i !== main);
    let segment = main;
    let wtp = 1;
    let size = 1;
    switch (kind) {
      case 'trend':
        segment = rng.pick(others);
        wtp = rng.range(1.25, 1.4);
        size = 1.15;
        break;
      case 'priceWar':
        wtp = rng.range(0.7, 0.8);
        break;
      case 'boom':
        segment = rng.pick(others);
        size = rng.range(1.5, 1.8);
        break;
      case 'fade':
        size = rng.range(0.55, 0.7);
        break;
    }
    const seg = { name: plainName(idea, segment) };
    const rival = round5(s.truth[segment].wtp * wtp * 0.85);
    const copy: Record<ShiftKind, { icon: string; tone: 'good' | 'bad'; title: string; text: string }> = {
      trend: {
        icon: 'TrendingUp',
        tone: 'good',
        title: `${seg.name} catch the craze`,
        text: `A reel made ${idea.name.toLowerCase()} the thing to have. ${seg.name} will now pay noticeably more than before — and more of them are looking. Your old price notes are out of date.`,
      },
      priceWar: {
        icon: 'Swords',
        tone: 'bad',
        title: `Price war for ${seg.name.toLowerCase()}`,
        text: `A rival has started selling to ${seg.name.toLowerCase()} at ${formatRs(rival)}. They won't pay what they used to. Re-check your price before your next sale.`,
      },
      boom: {
        icon: 'Building2',
        tone: 'good',
        title: `New ${placeFor(idea, segment)} opens`,
        text: `A new ${placeFor(idea, segment)} near ${seg.name.toLowerCase()} just opened. Their crowd is much bigger from today.`,
      },
      fade: {
        icon: 'TrendingDown',
        tone: 'bad',
        title: `${seg.name} move on`,
        text: `The buzz is cooling among ${seg.name.toLowerCase()}. Fewer of them are looking from now on — maybe time to court someone new.`,
      },
    };
    return {
      id: 'marketShift',
      flag: 'Market moves',
      icon: copy[kind].icon,
      tone: copy[kind].tone,
      title: copy[kind].title,
      text: copy[kind].text,
      choices: [{ label: 'Noted' }],
      data: { kind: SHIFT_KINDS.indexOf(kind), segment, wtp, size },
    };
  },
  resolve: (s, idea) => {
    const d = s.pendingEvent!.data;
    const kind = SHIFT_KINDS[d.kind];
    const i = d.segment;
    const t = s.truth[i];
    const k = s.knowledge[i];
    const from = { wtp: t.wtp, size: t.size };
    t.wtp = Math.round(t.wtp * d.wtp);
    t.size *= d.size;
    s.shifts.push({ day: s.day, segment: i, kind, wtpFrom: from.wtp, wtpTo: t.wtp, sizeFrom: from.size, sizeTo: t.size, soldBefore: s.stats.salesBySegment[i] });

    if (d.wtp !== 1) {
      // Your range is a guess again: widen it so it still contains the truth, and flag it.
      k.stale = true;
      k.movedOn = s.day;
      if (d.wtp > 1) k.hi = Math.max(k.hi, Math.round(t.wtp * 1.3));
      else k.lo = Math.min(k.lo, Math.round(t.wtp * 0.7));
    }
    if (k.sizeHint !== 'unknown') k.sizeHint = sizeHint(t.size);

    const name = plainName(idea, i);
    const note = {
      trend: `${name} value it more now. Talk to them or run a price test to find the new level.`,
      priceWar: `${name} value it less now. Your old price will scare them off.`,
      boom: `Demand from ${name.toLowerCase()} is bigger from today.`,
      fade: `Demand from ${name.toLowerCase()} is smaller from today.`,
    }[kind];
    addLog(s, 'event', `Market moved: ${s.pendingEvent!.title}`, note);
  },
};

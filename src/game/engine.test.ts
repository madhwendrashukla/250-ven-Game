import { describe, expect, it } from 'vitest';
import { IDEAS } from './content';
import { act, canAct, channelCost, createGame, pickPerk, resolveEvent, restockPrice } from './engine';
import { inventoryCount } from './helpers';
import { PERKS, SHAGUN } from './perks';
import { buildReport, computeScore } from './score';
import { naiveBot, playRun, randomBot, smartBot } from './sim';
import type { GameState } from './types';

const SEEDS = Array.from({ length: 60 }, (_, i) => 1000 + i * 7919);

function median(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** Rests through the days, declining events and taking the first perk, until `day` (or the end) with nothing pending. */
function restUntil(s: GameState, day: number): GameState {
  for (let guard = 0; guard < 100 && s.status === 'playing' && (s.day < day || s.pendingEvent || s.perkOffer); guard++) {
    if (s.perkOffer) s = pickPerk(s, 0);
    else if (s.pendingEvent) s = resolveEvent(s, s.pendingEvent.choices.map((c, i) => (c.disabled ? -1 : i)).filter((i) => i >= 0).pop()!);
    else s = act(s, { type: 'rest' });
  }
  return s;
}

function replay(s: GameState): GameState {
  let r = createGame(s.ideaId, s.seed, s.dailyLabel);
  for (const step of s.history) r = step.t === 'act' ? act(r, step.a) : step.t === 'choose' ? resolveEvent(r, step.i) : pickPerk(r, step.i);
  return r;
}

describe('engine', () => {
  it('is deterministic for the same seed and actions', () => {
    const a = playRun('cookies', 42, smartBot, createGame);
    const b = playRun('cookies', 42, smartBot, createGame);
    expect(a).toEqual(b);
  });

  it('never lets cash, energy or stock go invalid under random play', () => {
    for (const idea of IDEAS) {
      for (const seed of SEEDS.slice(0, 20)) {
        const s = playRun(idea.id, seed, randomBot, createGame);
        expect(s.status).toBe('ended');
        expect(s.cash).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(s.cash)).toBe(true);
        expect(s.energy).toBeGreaterThanOrEqual(0);
        expect(s.energy).toBeLessThanOrEqual(100);
        expect(inventoryCount(s)).toBeGreaterThanOrEqual(0);
        expect(s.day).toBeLessThanOrEqual(s.maxDays);
        expect(() => buildReport(s)).not.toThrow();
      }
    }
  });

  it('rejects actions the player cannot afford', () => {
    const s = createGame('thrift', 1);
    const next = act(s, { type: 'restock', qty: 10 });
    expect(restockPrice(s, 10)).toBeGreaterThan(s.cash);
    expect(next).toBe(s);
  });

  it('spoils perishable stock after its shelf life', () => {
    let s = createGame('cookies', 3);
    s = act(s, { type: 'restock', qty: 10 });
    for (let i = 0; i < 3; i++) {
      s = act(s, { type: 'rest' });
      if (s.pendingEvent) s = { ...s, pendingEvent: null };
    }
    expect(inventoryCount(s)).toBe(0);
    expect(s.stats.spoiled).toBeGreaterThanOrEqual(10);
  });

  it('rewards customer discovery over blind selling', () => {
    for (const idea of IDEAS) {
      const smart = SEEDS.map((seed) => playRun(idea.id, seed, smartBot, createGame).cash - 250);
      const naive = SEEDS.map((seed) => playRun(idea.id, seed, naiveBot, createGame).cash - 250);
      const smartScores = SEEDS.map((seed) => buildReport(playRun(idea.id, seed, smartBot, createGame)).score);
      console.log(
        `${idea.id.padEnd(9)} smart profit median ₹${median(smart)} (min ${Math.min(...smart)}, max ${Math.max(...smart)}) | ` +
          `naive median ₹${median(naive)} | smart score median ${median(smartScores)}`,
      );
      expect(median(smart)).toBeGreaterThan(median(naive));
      expect(median(smart)).toBeGreaterThan(300);
    }
  }, 30_000);
});

describe('weeks, rent and perks', () => {
  it('closes week 1 on day 7: rent, target check and a three-card draft', () => {
    let s = restUntil(createGame('cookies', 3), 7);
    expect(s.day).toBe(7);
    const cash = s.cash;
    s = act(s, { type: 'rest' });
    expect(s.day).toBe(8);
    expect(s.weeks).toHaveLength(1);
    expect(s.weeks[0]).toMatchObject({ week: 1, rent: 50, rentPaid: 50, hit: false });
    expect(s.cash).toBe(cash - 50);
    expect(s.pendingEvent).toBeNull();
    expect(new Set(s.perkOffer).size).toBe(3);
    expect(canAct(s, { type: 'rest' }).ok).toBe(false);
    expect(act(s, { type: 'rest' })).toBe(s);
  });

  it('pays the reward and score points when the target is hit', () => {
    const base = createGame('cookies', 11);
    let s: GameState = {
      ...base,
      day: 7,
      goals: [{ ...base.goals[0], kind: 'talkAll', target: 3 }, ...base.goals.slice(1)],
      knowledge: base.knowledge.map((k) => ({ ...k, interviews: 1 })),
    };
    const before = computeScore(s);
    s = act(s, { type: 'rest' });
    expect(s.weeks[0].hit).toBe(true);
    expect(s.cash).toBe(base.cash + 75 - 50);
    expect(computeScore(s)).toBe(before + 75 - 50 + 100);
  });

  it('raises a running-total target that is already met when its week opens', () => {
    const base = createGame('cookies', 11);
    const goals = [base.goals[0], { ...base.goals[1], kind: 'fans' as const, target: 60 }, { ...base.goals[2], kind: 'quality' as const, target: 2 }, base.goals[3]];
    let s: GameState = { ...base, day: 7, goals, followers: 91 };
    s = act(s, { type: 'rest' });
    expect(s.goals[1].target).toBe(130);
    s = { ...restUntil(s, 14), quality: 3 };
    s = act(s, { type: 'rest' });
    expect(s.goals[2]).toMatchObject({ kind: 'revenue', target: 1200 });
  });

  it('turns unpaid rent into debt and collects it the next morning', () => {
    let s: GameState = { ...restUntil(createGame('stickers', 5), 7), cash: 20 };
    s = act(s, { type: 'rest' });
    expect(s.weeks[0].rentPaid).toBe(20);
    expect(s.debt).toBe(30);
    expect(s.cash).toBe(0);
    s = pickPerk(s, s.perkOffer!.findIndex((id) => id !== 'shagun'));
    s = act({ ...s, cash: 100 }, { type: 'rest' });
    expect(s.debt).toBe(0);
    expect(s.cash).toBe(70);
  });

  it('applies perks and records the pick as a replayable step', () => {
    const base = createGame('cookies', 21);
    const s: GameState = { ...base, perkOffer: ['wholesale', 'cousin', 'shagun'] };
    const cheap = pickPerk(s, 0);
    expect(cheap.unitCost).toBeCloseTo(base.unitCost * 0.85);
    expect(cheap.history.at(-1)).toEqual({ t: 'perk', i: 0 });
    expect(cheap.perkOffer).toBeNull();
    expect(channelCost(pickPerk(s, 1), 'stall').energy).toBe(0);
    expect(pickPerk(s, 2).cash).toBe(base.cash + SHAGUN);
    expect(pickPerk(s, 3)).toBe(s);
    expect(pickPerk(base, 0)).toBe(base);
  });

  it('offers only eligible, unowned perks', () => {
    for (const idea of IDEAS) {
      const s = playRun(idea.id, 77, smartBot, createGame);
      expect(s.perks).toHaveLength(4);
      expect(new Set(s.perks).size).toBe(4);
      if (!idea.perishDays) expect(s.perks).not.toContain('fridge');
    }
    expect(PERKS.length).toBeGreaterThanOrEqual(12);
  });

  it('deals the same first draft to every player on a seed', () => {
    const firstDraft = (move: (s: GameState) => GameState) => {
      let s = createGame('notes', 4242);
      for (let i = 0; i < 40 && !s.perkOffer; i++) s = s.pendingEvent ? resolveEvent(s, 0) : move(s);
      return s.perkOffer;
    };
    const resting = firstDraft((s) => act(s, { type: 'rest' }));
    const selling = firstDraft((s) => {
      const next = act(s, naiveBot.move(s, null!));
      return next === s ? act(s, { type: 'rest' }) : next;
    });
    expect(resting).toHaveLength(3);
    expect(selling).toEqual(resting);
  });

  it('replays a full run with perk picks to the identical state', () => {
    for (const idea of IDEAS) {
      const s = playRun(idea.id, 314, smartBot, createGame);
      expect(s.history.filter((st) => st.t === 'perk')).toHaveLength(4);
      expect(replay(s)).toEqual(s);
    }
  });
});

describe('market shifts', () => {
  it('moves a market once or twice mid-run and flags old price notes', () => {
    let twice = 0;
    for (const seed of SEEDS.slice(0, 20)) {
      const s = restUntil(createGame('plants', seed), 30);
      expect(s.shifts.length).toBeGreaterThanOrEqual(1);
      expect(s.shifts.length).toBeLessThanOrEqual(2);
      const first = s.shifts[0];
      expect(['trend', 'priceWar']).toContain(first.kind);
      expect(first.day).toBeGreaterThanOrEqual(9);
      expect(first.day).toBeLessThanOrEqual(13);
      expect(first.wtpTo).not.toBe(first.wtpFrom);
      if (s.shifts.length === 2) twice++;
    }
    expect(twice).toBeGreaterThan(0);
  });

  it('widens the estimate around the new value until you re-check', () => {
    let s = restUntil(createGame('cookies', 99), 14);
    const shift = s.shifts[0];
    const k = s.knowledge[shift.segment];
    expect(k.stale).toBe(true);
    expect(k.movedOn).toBe(shift.day);
    expect(k.lo).toBeLessThanOrEqual(s.truth[shift.segment].wtp);
    expect(k.hi).toBeGreaterThanOrEqual(s.truth[shift.segment].wtp);
    s = act(s, { type: 'interview', segment: shift.segment });
    expect(s.knowledge[shift.segment].stale).toBe(false);
  });
});

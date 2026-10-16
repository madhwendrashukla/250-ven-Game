/**
 * Scripted players used by tests to check invariants and game balance.
 */
import { CHANNEL_ORDER, getIdea } from './content';
import { act, maxAffordableQty, pickPerk, resolveEvent } from './engine';
import { inventoryCount } from './helpers';
import type { PerkId } from './perks';
import { Rng } from './rng';
import type { ChannelId, GameAction, GameState } from './types';

export interface Bot {
  /** Today's move. */
  move: (s: GameState, rng: Rng) => GameAction;
  /** Which of the offered perk cards to take at a week close. */
  perk: (s: GameState, rng: Rng) => number;
}

function firstEnabled(s: GameState, preferLast = false): number {
  const choices = s.pendingEvent!.choices.map((c, i) => ({ c, i })).filter(({ c }) => !c.disabled);
  return (preferLast ? choices[choices.length - 1] : choices[0]).i;
}

/** Sells blind to the first segment at a guessed price, restocking with everything it has. Takes the first perk it sees. */
export const naiveBot: Bot = {
  move: (s) => {
    const idea = getIdea(s.ideaId);
    if (s.energy < 20) return { type: 'rest' };
    if (inventoryCount(s) === 0) {
      const qty = maxAffordableQty(s);
      if (qty > 0) return { type: 'restock', qty };
    }
    return { type: 'sell', segment: 0, channel: 'friends', price: Math.round(idea.segments[0].wtp * 1.15) };
  },
  perk: () => 0,
};

/** Perks the smart bot values most, best first. */
const SMART_PERKS: PerkId[] = ['wholesale', 'haat', 'examInsider', 'kirana', 'fridge', 'cousin', 'whatsappAdmin', 'shagun', 'tapri', 'jugaad', 'blogger', 'regulars', 'researcher', 'adIntern'];

/** Interviews everyone, picks the best-looking segment, prices at ~80% of estimated value and re-checks when the market moves. */
export const smartBot: Bot = {
  move: (s, rng) => {
    const idea = getIdea(s.ideaId);
    const k = s.knowledge;
    const unexplored = k.findIndex((seg) => seg.interviews === 0);
    if (unexplored >= 0) return { type: 'interview', segment: unexplored };
    if (s.energy < 30) return { type: 'rest' };

    const sizeFactor = { unknown: 1, small: 0.6, medium: 1, large: 1.5 };
    const scoreOf = (i: number) => {
      const mid = (k[i].lo + k[i].hi) / 2;
      return sizeFactor[k[i].sizeHint] * Math.max(0, 0.8 * mid - s.unitCost);
    };
    // Rotate away from saturated segments.
    const target = [0, 1, 2].reduce((a, b) => (scoreOf(b) * s.saturation[b] > scoreOf(a) * s.saturation[a] ? b : a));
    if (k[target].interviews < 2 || k[target].stale) return { type: 'interview', segment: target };

    const price = Math.round(0.8 * ((k[target].lo + k[target].hi) / 2));
    if (s.quality < 2 && s.cash > 400) return { type: 'improve' };

    const stock = inventoryCount(s);
    const desired = idea.perishDays ? 18 : Math.max(10, Math.floor((s.cash * 0.6) / s.unitCost));
    if (stock < desired * 0.5) {
      const qty = Math.min(desired - stock, maxAffordableQty(s) - (s.cash >= 30 + s.unitCost * 5 ? Math.ceil(30 / s.unitCost) : 0));
      if (qty > 0) return { type: 'restock', qty };
    }
    if (stock === 0) return { type: 'post' };

    let channel: ChannelId = k[target].bestChannel ?? rng.pick(['stall', 'whatsapp', 'instagram'] as const);
    if (channel === 'whatsapp' && s.whatsappFatigue < 0.6) channel = 'instagram';
    if (channel === 'stall' && s.cash < 30) channel = 'friends';
    return { type: 'sell', segment: target, channel, price };
  },
  perk: (s) => {
    const offer = s.perkOffer!;
    const rank = (id: string) => SMART_PERKS.indexOf(id as PerkId);
    return offer.reduce((best, id, i) => (rank(id) < rank(offer[best]) ? i : best), 0);
  },
};

/** Uniformly random legal-ish actions — used to fuzz invariants. */
export const randomBot: Bot = {
  move: (s, rng) => {
    const idea = getIdea(s.ideaId);
    const seg = rng.int(0, idea.segments.length - 1);
    const price = rng.int(1, idea.segments[seg].wtp * 2);
    const options: GameAction[] = [
      { type: 'interview', segment: seg },
      { type: 'priceTest', segment: seg, price },
      { type: 'restock', qty: rng.int(1, 60) },
      { type: 'sell', segment: seg, channel: rng.pick(CHANNEL_ORDER), price },
      { type: 'post' },
      { type: 'improve' },
      { type: 'rest' },
    ];
    return rng.pick(options);
  },
  perk: (s, rng) => rng.int(0, s.perkOffer!.length - 1),
};

export function playRun(ideaId: string, seed: number, bot: Bot, createGame: (id: string, seed: number) => GameState): GameState {
  let s = createGame(ideaId, seed);
  const rng = new Rng(seed ^ 0x9e3779b9);
  for (let guard = 0; guard < 400 && s.status === 'playing'; guard++) {
    if (s.perkOffer) {
      s = pickPerk(s, bot.perk(s, rng));
      continue;
    }
    if (s.pendingEvent) {
      s = resolveEvent(s, firstEnabled(s, bot === naiveBot));
      continue;
    }
    const next = act(s, bot.move(s, rng));
    // An illegal action leaves state untouched; fall back to resting so the run progresses.
    s = next === s ? act(s, { type: 'rest' }) : next;
  }
  return s;
}

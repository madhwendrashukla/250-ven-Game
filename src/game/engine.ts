import { CHANNELS, getIdea } from './content';
import { EVENTS, EVENTS_BY_ID } from './events';
import {
  addLog,
  bestChannelFor,
  clamp,
  conversionBase,
  formatRs,
  inventoryCount,
  MAX_DAYS,
  MAX_QUALITY,
  modifierMult,
  removeStock,
  round5,
  sizeHint,
  START_CASH,
  TIRED_THRESHOLD,
  willingness,
} from './helpers';
import { drawShiftDays, SHIFT_EVENT, shiftDue } from './market';
import { hasPerk, PERK_NUMBERS } from './perks';
import { Rng } from './rng';
import type { ChannelId, GameAction, GameState, IdeaDef } from './types';
import { closeWeek, currentGoal, drawGoals, goalText, takePerk, weekCloseDay } from './weeks';

const EVENT_CHANCE = 0.3;
const TIRED_EFFECT = 0.65;
const PRICE_TEST_SAMPLE = 20;
const MIN_SATURATION = 0.4;
const SATURATION_RECOVERY = 0.08;
const MORNING_ENERGY = 5;

export function createGame(ideaId: string, seed: number, dailyLabel: string | null = null): GameState {
  const idea = getIdea(ideaId);
  const rng = new Rng(seed);
  const truth = idea.segments.map((seg) => ({
    wtp: Math.round(seg.wtp * rng.range(0.7, 1.35)),
    size: seg.size * rng.range(0.55, 1.55),
  }));
  const goals = drawGoals(idea, rng);
  const shiftDays = drawShiftDays(rng);
  const n = idea.segments.length;
  const s: GameState = {
    version: 3,
    seed,
    rng: rng.state,
    dailyLabel,
    ideaId,
    day: 1,
    maxDays: MAX_DAYS,
    cash: START_CASH,
    energy: 100,
    followers: 20,
    quality: 0,
    unitCost: idea.unitCost,
    inventory: [],
    truth,
    knowledge: idea.segments.map((seg) => ({
      lo: Math.round(seg.wtp * 0.45),
      hi: Math.round(seg.wtp * 1.9),
      interviews: 0,
      sizeHint: 'unknown',
      bestChannel: null,
      quotes: [],
      points: [],
      stale: false,
      movedOn: null,
    })),
    whatsappFatigue: 1,
    saturation: Array(n).fill(1),
    modifiers: [],
    stats: {
      sold: 0,
      revenue: 0,
      spent: 0,
      spoiled: 0,
      spoiledValue: 0,
      unmet: 0,
      interviews: 0,
      tests: 0,
      posts: 0,
      tiredActions: 0,
      firstSaleDay: null,
      insightsBeforeFirstSale: 0,
      salesBySegment: Array(n).fill(0),
      revenueBySegment: Array(n).fill(0),
      valueBySegment: Array(n).fill(0),
      sellDaysBySegment: Array(n).fill(0),
      peakCash: START_CASH,
      rentPaid: 0,
    },
    log: [],
    pendingEvent: null,
    firedEvents: [],
    mentorHint: null,
    perks: [],
    perkOffer: null,
    goals,
    weekStart: { sold: 0, revenue: 0, salesBySegment: Array(n).fill(0) },
    weeks: [],
    debt: 0,
    shiftDays,
    shifts: [],
    history: [],
    status: 'playing',
  };
  addLog(s, 'info', `You have ₹250 and ${MAX_DAYS} days.`, `Your idea: ${idea.name}. Who will actually pay for it — and how much?`);
  addLog(s, 'info', `Week 1 target: ${goalText(goals[0])}`, `Rent of ${formatRs(goals[0].rent)} is due when the week closes on day ${weekCloseDay(1)}.`);
  return s;
}

// ─── Costs & validation ──────────────────────────────────────────────────────

export interface ActionCost {
  cash: number;
  energy: number;
  days: number;
}

/** Bulk-discount steps, biggest first. */
export function bulkTiers(s: GameState): { min: number; off: number }[] {
  return hasPerk(s, 'kirana')
    ? [
        { min: 30, off: 0.2 },
        { min: 10, off: 0.1 },
      ]
    : [
        { min: 50, off: 0.2 },
        { min: 20, off: 0.1 },
      ];
}

export function restockPrice(s: GameState, qty: number): number {
  const off = bulkTiers(s).find((t) => qty >= t.min)?.off ?? 0;
  return Math.ceil(qty * s.unitCost * (1 - off));
}

export function maxAffordableQty(s: GameState): number {
  let qty = Math.floor(s.cash / s.unitCost);
  while (qty < 500 && restockPrice(s, qty + 1) <= s.cash) qty++;
  while (qty > 0 && restockPrice(s, qty) > s.cash) qty--;
  return qty;
}

export function improveCost(s: GameState): number {
  return 40 * (s.quality + 1) * (hasPerk(s, 'jugaad') ? 0.5 : 1);
}

/** A channel's cash and energy cost for one selling day, after perks. */
export function channelCost(s: GameState, channel: ChannelId): { cash: number; energy: number } {
  const ch = CHANNELS[channel];
  return {
    cash: channel === 'ads' && hasPerk(s, 'adIntern') ? PERK_NUMBERS.adCost : ch.cost,
    energy: channel === 'stall' && hasPerk(s, 'cousin') ? 0 : ch.energy,
  };
}

export function priceTestSample(s: GameState): number {
  return hasPerk(s, 'researcher') ? PERK_NUMBERS.testSample : PRICE_TEST_SAMPLE;
}

/** Days before stock goes stale (null = never). */
export function shelfLife(s: GameState, idea: IdeaDef): number | null {
  if (!idea.perishDays) return null;
  return idea.perishDays + (hasPerk(s, 'fridge') ? PERK_NUMBERS.fridgeDays : 0);
}

export function actionCost(s: GameState, action: GameAction): ActionCost {
  switch (action.type) {
    case 'interview':
      return { cash: 0, energy: 15, days: 1 };
    case 'priceTest':
      return { cash: 0, energy: 10, days: 1 };
    case 'restock':
      return { cash: restockPrice(s, action.qty), energy: 5, days: 0 };
    case 'sell':
      return { ...channelCost(s, action.channel), days: 1 };
    case 'post':
      return { cash: 0, energy: 15, days: 1 };
    case 'improve':
      return { cash: improveCost(s), energy: 25, days: 1 };
    case 'rest':
      return { cash: 0, energy: -45, days: 1 };
    case 'endEarly':
      return { cash: 0, energy: 0, days: 0 };
  }
}

export function canAct(s: GameState, action: GameAction): { ok: boolean; reason?: string } {
  if (s.status !== 'playing') return { ok: false, reason: 'The venture has ended.' };
  if (s.pendingEvent) return { ok: false, reason: 'Deal with the event first.' };
  if (s.perkOffer) return { ok: false, reason: 'Pick a perk first.' };
  const cost = actionCost(s, action);
  if (cost.cash > s.cash) return { ok: false, reason: `Needs ${formatRs(cost.cash)}` };
  switch (action.type) {
    case 'restock':
      if (!Number.isInteger(action.qty) || action.qty < 1) return { ok: false, reason: 'Pick a quantity' };
      break;
    case 'sell':
    case 'priceTest':
      if (!(action.price >= 1)) return { ok: false, reason: 'Set a price' };
      break;
    case 'improve':
      if (s.quality >= MAX_QUALITY) return { ok: false, reason: 'Already top quality' };
      break;
  }
  return { ok: true };
}

// ─── Actions ────────────────────────────────────────────────────────────────

export function act(state: GameState, action: GameAction): GameState {
  if (!canAct(state, action).ok) return state;
  const s = structuredClone(state);
  const rng = new Rng(s.rng);
  const idea = getIdea(s.ideaId);
  const cost = actionCost(s, action);
  const working = !['rest', 'restock', 'endEarly'].includes(action.type);
  const tired = working && s.energy < TIRED_THRESHOLD;
  const eff = tired ? TIRED_EFFECT : 1;
  if (tired) s.stats.tiredActions++;
  s.history.push({ t: 'act', a: action });

  switch (action.type) {
    case 'interview':
      doInterview(s, idea, rng, action.segment, tired);
      break;
    case 'priceTest':
      doPriceTest(s, idea, rng, action.segment, action.price);
      break;
    case 'restock':
      doRestock(s, idea, action.qty, cost.cash);
      break;
    case 'sell':
      doSell(s, idea, rng, action.segment, action.channel, Math.round(action.price), eff);
      break;
    case 'post':
      doPost(s, rng, eff);
      break;
    case 'improve':
      s.cash -= cost.cash;
      s.stats.spent += cost.cash;
      s.quality += 1;
      s.unitCost *= 1.08;
      addLog(s, 'action', `${idea.improveName} (quality ${s.quality}/${MAX_QUALITY})`, `More people buy, but each ${idea.unitName} now costs ${formatRs(s.unitCost)} to make.`);
      break;
    case 'rest':
      addLog(s, 'action', 'Took a day off', 'Founders need sleep too. Energy restored.');
      break;
    case 'endEarly':
      s.status = 'ended';
      addLog(s, 'info', 'You wrapped up the venture early.');
      break;
  }

  if (tired) addLog(s, 'warn', 'You were running on empty', 'Low energy made today far less effective. Rest is part of the strategy.');
  s.energy = clamp(s.energy - cost.energy, 0, 100);
  s.stats.peakCash = Math.max(s.stats.peakCash, s.cash);
  if (cost.days > 0 && s.status === 'playing') advanceDay(s, idea, rng, true);
  s.rng = rng.state;
  return s;
}

export function resolveEvent(state: GameState, choice: number): GameState {
  const ev = state.pendingEvent;
  if (!ev || state.status !== 'playing') return state;
  if (!ev.choices[choice] || ev.choices[choice].disabled) return state;
  const s = structuredClone(state);
  const rng = new Rng(s.rng);
  const idea = getIdea(s.ideaId);
  const def = EVENTS_BY_ID[ev.id];
  s.history.push({ t: 'choose', i: choice });
  const result = def ? def.resolve(s, idea, choice, rng) : undefined;
  s.pendingEvent = null;
  s.stats.peakCash = Math.max(s.stats.peakCash, s.cash);
  if (result?.skipDay) advanceDay(s, idea, rng, false);
  s.rng = rng.state;
  return s;
}

/** Takes card `choice` from the week-close perk draft. */
export function pickPerk(state: GameState, choice: number): GameState {
  if (!state.perkOffer || state.status !== 'playing' || !Number.isInteger(choice) || !state.perkOffer[choice]) return state;
  const s = structuredClone(state);
  s.history.push({ t: 'perk', i: choice });
  takePerk(s, getIdea(s.ideaId), choice);
  s.stats.peakCash = Math.max(s.stats.peakCash, s.cash);
  return s;
}

function doInterview(s: GameState, idea: IdeaDef, rng: Rng, i: number, tired: boolean): void {
  const seg = idea.segments[i];
  const k = s.knowledge[i];
  const t = s.truth[i];
  const sharp = hasPerk(s, 'researcher') ? 1.4 : 1;
  const f = (tired ? 0.3 : 0.55) * sharp;
  const targetLo = t.wtp * rng.range(0.84, 0.95);
  const targetHi = t.wtp * rng.range(1.05, 1.16);
  if (targetLo > k.lo) k.lo = Math.round(k.lo + (targetLo - k.lo) * f);
  if (targetHi < k.hi) k.hi = Math.round(k.hi - (k.hi - targetHi) * f);
  if (k.hi <= k.lo) k.hi = k.lo + 1;
  k.interviews++;
  k.stale = false;
  s.stats.interviews++;

  const findings: string[] = [];
  if (k.sizeHint === 'unknown') {
    k.sizeHint = sizeHint(t.size);
    findings.push(`Market looks ${k.sizeHint}.`);
  }
  if (!k.bestChannel && rng.chance(tired ? 0.3 : 0.55)) {
    k.bestChannel = bestChannelFor(idea, i);
    findings.push(`They mostly discover things via ${CHANNELS[k.bestChannel].name}.`);
  }
  const unused = seg.quotes.filter((q) => !k.quotes.some((used) => used.startsWith(q.split('{price}')[0])));
  const template = rng.pick(unused.length ? unused : seg.quotes);
  const quote = template.replace('{price}', String(round5(t.wtp * rng.range(0.85, 1.1))));
  k.quotes.push(quote);
  if (k.quotes.length > 4) k.quotes.shift();

  addLog(
    s,
    'action',
    `Talked to ${seg.name}`,
    `"${quote}" ${findings.join(' ')} Value estimate now ₹${k.lo}–₹${k.hi}.`,
  );
}

function doPriceTest(s: GameState, idea: IdeaDef, rng: Rng, i: number, price: number): void {
  const seg = idea.segments[i];
  const k = s.knowledge[i];
  const t = s.truth[i];
  const sample = priceTestSample(s);
  const yes = rng.binomial(sample, 0.85 * willingness(price, t.wtp));
  const rate = yes / sample;
  k.points.push({ day: s.day, price, rate, kind: 'test' });
  if (rate >= 0.55 && price > k.lo) k.lo = Math.max(k.lo, Math.min(price, Math.round(t.wtp * 0.95)));
  if (rate <= 0.2 && price < k.hi) k.hi = Math.min(k.hi, Math.max(price, Math.round(t.wtp * 1.05)));
  if (k.hi <= k.lo) k.hi = k.lo + 1;
  k.stale = false;
  s.stats.tests++;
  const verdict = rate >= 0.6 ? 'Strong yes — maybe you can charge more.' : rate >= 0.35 ? 'Lukewarm. Price is near the edge.' : 'Mostly no. Too pricey for them.';
  addLog(s, 'action', `Price test: ${yes}/${sample} ${seg.name} said yes at ₹${price}`, verdict);
}

function doRestock(s: GameState, idea: IdeaDef, qty: number, total: number): void {
  s.cash -= total;
  s.stats.spent += total;
  s.inventory.push({ qty, day: s.day });
  const life = shelfLife(s, idea);
  const spoilNote = life ? ` Sell within ${life} days or they go stale.` : '';
  addLog(s, 'action', `${idea.restockPast} ${qty} ${idea.unitName}s for ${formatRs(total)}`, `Stock: ${inventoryCount(s)}.${spoilNote}`);
}

function channelReach(s: GameState, channel: ChannelId): number {
  switch (channel) {
    case 'friends':
      return (8 + Math.min(25, s.stats.sold * 0.08)) * (hasPerk(s, 'regulars') ? PERK_NUMBERS.friendsReach : 1);
    case 'whatsapp':
      return 22;
    case 'instagram':
      return 4 + s.followers * 0.22;
    case 'stall':
      return 45;
    case 'ads':
      return 60 + s.followers * 0.22;
  }
}

function doSell(s: GameState, idea: IdeaDef, rng: Rng, i: number, channel: ChannelId, price: number, eff: number): void {
  const seg = idea.segments[i];
  const t = s.truth[i];
  const ch = CHANNELS[channel];
  const fee = channelCost(s, channel).cash;
  s.cash -= fee;
  s.stats.spent += fee;

  let reach = channelReach(s, channel) * seg.fit[channel] * t.size * idea.demandScale;
  reach *= modifierMult(s, i, channel) * s.saturation[i] * eff * rng.range(0.8, 1.2);
  if (hasPerk(s, 'examInsider') && seg.tags.includes('student')) reach *= PERK_NUMBERS.studentBoost;
  if (channel === 'whatsapp') {
    reach *= s.whatsappFatigue;
    s.whatsappFatigue *= hasPerk(s, 'whatsappAdmin') ? 0.775 : 0.55;
  }
  const reached = Math.max(0, Math.round(reach));
  const demand = rng.binomial(reached, conversionBase(s) * willingness(price, t.wtp));
  const stock = inventoryCount(s);
  const sold = Math.min(demand, stock);
  const unmet = demand - sold;
  removeStock(s, sold);
  const revenue = sold * price;
  s.cash += revenue;
  // Buyers don't need another one tomorrow: the segment cools off until it recovers.
  s.saturation[i] = Math.max(MIN_SATURATION, s.saturation[i] - Math.min(0.3, (sold * 0.015) / idea.demandScale));

  const st = s.stats;
  st.sold += sold;
  st.revenue += revenue;
  st.unmet += unmet;
  st.salesBySegment[i] += sold;
  st.revenueBySegment[i] += revenue;
  st.valueBySegment[i] += sold * t.wtp;
  st.sellDaysBySegment[i] += 1;
  if (sold > 0 && st.firstSaleDay === null) {
    st.firstSaleDay = s.day;
    st.insightsBeforeFirstSale = st.interviews + st.tests;
  }
  s.followers += Math.round(sold * ((channel === 'instagram' || channel === 'ads' ? 0.4 : 0.1) + (hasPerk(s, 'blogger') ? 0.5 : 0)));
  if (reached > 0) s.knowledge[i].points.push({ day: s.day, price, rate: demand / reached, kind: 'sale' });

  const parts = [`${reached} people reached`, `${demand} wanted one`];
  if (fee) parts.push(`${formatRs(fee)} channel cost`);
  if (unmet > 0) parts.push(stock === 0 ? 'you had nothing in stock!' : `${unmet} left empty-handed — you ran out`);
  if (channel === 'whatsapp' && s.whatsappFatigue < 0.5) parts.push('groups are getting tired of your messages');
  if (s.saturation[i] < 0.7) parts.push(`${seg.name.toLowerCase()} are seeing a lot of you — give them a breather`);
  addLog(
    s,
    sold > 0 ? 'sale' : 'warn',
    sold > 0
      ? `Sold ${sold} ${idea.unitName}${sold === 1 ? '' : 's'} to ${seg.name} via ${ch.name} — +${formatRs(revenue)}`
      : `No sales to ${seg.name} via ${ch.name}`,
    `At ₹${price}: ${parts.join(' · ')}.`,
  );
}

function doPost(s: GameState, rng: Rng, eff: number): void {
  let gain = rng.range(6, 16) * (1 + 0.15 * s.quality) * eff;
  const hit = rng.chance(0.15);
  if (hit) gain *= 3;
  const g = Math.round(gain);
  s.followers += g;
  s.stats.posts++;
  addLog(s, hit ? 'good' : 'action', hit ? `Your post took off! +${g} followers` : `Posted content: +${g} followers`, `You now have ${s.followers} followers.`);
}

// ─── Time ───────────────────────────────────────────────────────────────────

function advanceDay(s: GameState, idea: IdeaDef, rng: Rng, allowEvent: boolean): void {
  const goal = currentGoal(s);
  if (goal && s.day === weekCloseDay(goal.week)) closeWeek(s, idea);

  s.day += 1;
  s.energy = Math.min(100, s.energy + MORNING_ENERGY + (hasPerk(s, 'tapri') ? PERK_NUMBERS.morningEnergy : 0));
  s.whatsappFatigue = Math.min(1, s.whatsappFatigue + 0.25);
  const recovery = SATURATION_RECOVERY * (hasPerk(s, 'haat') ? 2 : 1);
  s.saturation = s.saturation.map((v) => Math.min(1, v + recovery));
  if (rng.chance(0.4)) s.followers += 1;

  if (s.debt > 0 && s.cash >= 1) {
    const paid = Math.min(s.debt, Math.floor(s.cash));
    s.cash -= paid;
    s.debt -= paid;
    s.stats.spent += paid;
    s.stats.rentPaid += paid;
    addLog(s, 'warn', `Landlord collected ${formatRs(paid)} of owed rent`, s.debt > 0 ? `Still owed: ${formatRs(s.debt)}.` : 'All square now.');
  }

  const life = shelfLife(s, idea);
  if (life) {
    let spoiled = 0;
    s.inventory = s.inventory.filter((b) => {
      if (s.day - b.day >= life) {
        spoiled += b.qty;
        return false;
      }
      return true;
    });
    if (spoiled > 0) {
      const value = spoiled * s.unitCost;
      s.stats.spoiled += spoiled;
      s.stats.spoiledValue += value;
      addLog(s, 'warn', `${spoiled} ${idea.unitName}s went stale`, `About ${formatRs(value)} of stock in the bin.`);
    }
  }

  s.modifiers = s.modifiers.filter((m) => m.until >= s.day);

  if (s.day > s.maxDays) {
    s.day = s.maxDays;
    s.status = 'ended';
    addLog(s, 'info', `Day ${s.maxDays} is over. Time to count the money.`);
    return;
  }
  // A week close (perk draft) is enough news for one morning.
  if (s.perkOffer) return;
  if (shiftDue(s)) {
    s.shiftDays.shift();
    s.pendingEvent = SHIFT_EVENT.make(s, idea, rng);
    return;
  }
  if (allowEvent && s.day >= 3 && rng.chance(EVENT_CHANCE)) rollEvent(s, idea, rng);
}

function rollEvent(s: GameState, idea: IdeaDef, rng: Rng): void {
  const eligible = EVENTS.filter(
    (e) =>
      (e.repeatable || !s.firedEvents.includes(e.id)) &&
      s.day >= (e.minDay ?? 0) &&
      (!e.when || e.when(s, idea)),
  );
  if (!eligible.length) return;
  const def = rng.pick(eligible);
  s.pendingEvent = def.make(s, idea, rng);
  s.firedEvents.push(def.id);
}

export { inventoryCount };

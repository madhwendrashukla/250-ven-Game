import type { Rng } from './rng';
import type { GameState, IdeaDef, PendingEvent } from './types';
import {
  addLog,
  addModifier,
  bestSegment,
  formatRs,
  inventoryCount,
  MAX_QUALITY,
  removeStock,
  round5,
} from './helpers';
import { SHIFT_EVENT } from './market';

export interface EventResult {
  /** The event eats the rest of the day (e.g. a family function). */
  skipDay?: boolean;
}

export interface EventDef {
  id: string;
  repeatable?: boolean;
  minDay?: number;
  when?: (s: GameState, idea: IdeaDef) => boolean;
  make: (s: GameState, idea: IdeaDef, rng: Rng) => PendingEvent;
  resolve: (s: GameState, idea: IdeaDef, choice: number, rng: Rng) => EventResult | void;
}

const OK = [{ label: 'Got it' }];

function segmentWithTag(idea: IdeaDef, tag: string): number {
  return idea.segments.findIndex((seg) => seg.tags.includes(tag));
}

export const EVENTS: EventDef[] = [
  {
    id: 'exams',
    when: (_s, idea) => segmentWithTag(idea, 'student') >= 0,
    make: (_s, idea) => {
      const seg = idea.segments[segmentWithTag(idea, 'student')];
      const boost = idea.id === 'notes';
      return {
        id: 'exams',
        icon: 'NotebookPen',
        tone: boost ? 'good' : 'bad',
        title: 'Mid-sem exams',
        text: boost
          ? `Panic mode! ${seg.name} are desperate for revision material. Their demand jumps for 4 days.`
          : `${seg.name} are buried in textbooks. Their demand drops for 4 days.`,
        choices: OK,
        data: {},
      };
    },
    resolve: (s, idea) => {
      const index = segmentWithTag(idea, 'student');
      const boost = idea.id === 'notes';
      addModifier(s, 'exams', boost ? 'Exam panic' : 'Exam season', { kind: 'segment', index }, boost ? 1.8 : 0.45, 4);
      addLog(s, 'event', boost ? 'Exam panic: student demand ×1.8' : 'Exam season: student demand ×0.45');
    },
  },
  {
    id: 'festival',
    minDay: 6,
    make: () => ({
      id: 'festival',
      icon: 'PartyPopper',
      tone: 'good',
      title: 'Festive week!',
      text: 'Everyone is shopping for gifts and treats. All demand is up for the next 3 days.',
      choices: [{ label: "Let's go!" }],
      data: {},
    }),
    resolve: (s) => {
      addModifier(s, 'festival', 'Festive rush', { kind: 'all' }, 1.6, 3);
      addLog(s, 'good', 'Festive rush: all demand ×1.6 for 3 days');
    },
  },
  {
    id: 'monsoon',
    repeatable: true,
    make: () => ({
      id: 'monsoon',
      icon: 'CloudRain',
      tone: 'bad',
      title: 'Monsoon downpour',
      text: 'Streets are flooded. Pop-up stalls will barely get any walk-ins for 2 days.',
      choices: OK,
      data: {},
    }),
    resolve: (s) => {
      addModifier(s, 'monsoon', 'Monsoon', { kind: 'channel', id: 'stall' }, 0.3, 2);
      addLog(s, 'event', 'Monsoon: stall walk-ins ×0.3 for 2 days');
    },
  },
  {
    id: 'viral',
    minDay: 5,
    make: (_s, _idea, rng) => {
      const gain = rng.int(40, 90);
      return {
        id: 'viral',
        icon: 'Rocket',
        tone: 'good',
        title: 'Your product went semi-viral',
        text: `A friend's reel featuring your product blew up. +${gain} followers!`,
        choices: [{ label: 'Nice!' }],
        data: { gain },
      };
    },
    resolve: (s, _idea, _c, _rng) => {
      const gain = s.pendingEvent?.data.gain ?? 50;
      s.followers += gain;
      addLog(s, 'good', `Reel went viral: +${gain} followers`);
    },
  },
  {
    id: 'supplierHike',
    minDay: 4,
    make: (_s, idea) => ({
      id: 'supplierHike',
      icon: 'TrendingUp',
      tone: 'bad',
      title: 'Supplier price hike',
      text: `Your raw-material costs just went up 20%. Every ${idea.unitName} now costs more to make.`,
      choices: [{ label: 'Ugh. Okay.' }],
      data: {},
    }),
    resolve: (s) => {
      s.unitCost *= 1.2;
      addLog(s, 'warn', `Supplier hike: unit cost now ${formatRs(s.unitCost)}`);
    },
  },
  {
    id: 'bulkOrder',
    minDay: 5,
    make: (s, idea, rng) => {
      const segIndex = rng.int(0, idea.segments.length - 1);
      const qty = rng.int(8, 16);
      const price = round5(s.truth[segIndex].wtp * 0.75);
      const have = inventoryCount(s);
      return {
        id: 'bulkOrder',
        icon: 'PackageCheck',
        tone: 'good',
        title: 'Bulk order request',
        text: `A group of ${idea.segments[segIndex].name.toLowerCase()} wants ${qty} ${idea.unitName}s at ${formatRs(price)} each, right now. You have ${have} in stock.`,
        choices: [
          { label: `Accept (+${formatRs(qty * price)})`, disabled: have < qty, detail: have < qty ? `Needs ${qty} in stock` : undefined },
          { label: 'Decline' },
        ],
        data: { qty, price, segIndex },
      };
    },
    resolve: (s, _idea, choice) => {
      const d = s.pendingEvent?.data;
      if (!d || choice !== 0) {
        addLog(s, 'info', 'Declined a bulk order');
        return;
      }
      const sold = removeStock(s, d.qty);
      const revenue = sold * d.price;
      s.cash += revenue;
      s.stats.sold += sold;
      s.stats.revenue += revenue;
      s.stats.salesBySegment[d.segIndex] += sold;
      s.stats.revenueBySegment[d.segIndex] += revenue;
      s.stats.valueBySegment[d.segIndex] += sold * s.truth[d.segIndex].wtp;
      if (s.stats.firstSaleDay === null) {
        s.stats.firstSaleDay = s.day;
        s.stats.insightsBeforeFirstSale = s.stats.interviews + s.stats.tests;
      }
      s.followers += 5;
      addLog(s, 'sale', `Bulk order: sold ${sold} for ${formatRs(revenue)}`);
    },
  },
  {
    id: 'samples',
    minDay: 3,
    make: (s, idea) => {
      const have = inventoryCount(s);
      return {
        id: 'samples',
        icon: 'Gift',
        tone: 'neutral',
        title: 'Free samples?',
        text: `Your aunt's kitty party wants 5 free ${idea.unitName}s "for promotion". Word of mouth could follow… or not.`,
        choices: [
          { label: 'Give 5 free', disabled: have < 5, detail: have < 5 ? 'Needs 5 in stock' : undefined },
          { label: 'Politely decline' },
        ],
        data: {},
      };
    },
    resolve: (s, _idea, choice) => {
      if (choice !== 0) {
        addLog(s, 'info', 'Declined the free-sample request');
        return;
      }
      removeStock(s, 5);
      s.followers += 15;
      addModifier(s, 'samples', 'Word of mouth', { kind: 'all' }, 1.2, 5);
      addLog(s, 'good', 'Gave samples: +15 followers, demand ×1.2 for 5 days');
    },
  },
  {
    id: 'copycat',
    minDay: 8,
    make: (s, idea) => {
      const cost = 40;
      const canUpgrade = s.cash >= cost && s.quality < MAX_QUALITY;
      return {
        id: 'copycat',
        icon: 'Swords',
        tone: 'bad',
        title: 'A copycat appears',
        text: `Someone nearby launched a cheaper copy of your ${idea.name.toLowerCase()}. Customers are comparing.`,
        choices: [
          { label: `Out-quality them (${formatRs(cost)})`, disabled: !canUpgrade, detail: canUpgrade ? 'Quality +1' : 'Not enough cash or already maxed' },
          { label: 'Ignore it', detail: 'Demand ×0.75 for 4 days' },
        ],
        data: { cost },
      };
    },
    resolve: (s, _idea, choice) => {
      if (choice === 0) {
        s.cash -= 40;
        s.stats.spent += 40;
        s.quality += 1;
        addLog(s, 'good', 'Out-classed the copycat: quality +1');
      } else {
        addModifier(s, 'copycat', 'Copycat', { kind: 'all' }, 0.75, 4);
        addLog(s, 'warn', 'Copycat steals customers: demand ×0.75 for 4 days');
      }
    },
  },
  {
    id: 'mentor',
    minDay: 4,
    make: () => ({
      id: 'mentor',
      icon: 'Lightbulb',
      tone: 'good',
      title: 'Founder office hours',
      text: 'A senior founder gives you 15 minutes. "Show me your numbers — I\'ll tell you where the money is."',
      choices: [{ label: 'Listen carefully' }],
      data: {},
    }),
    resolve: (s, idea) => {
      const best = bestSegment(s, idea);
      s.mentorHint = best;
      addLog(s, 'good', `Mentor: "Your real money is with ${idea.segments[best].name}."`);
    },
  },
  {
    id: 'sick',
    make: () => ({
      id: 'sick',
      icon: 'Thermometer',
      tone: 'bad',
      title: 'You caught a cold',
      text: 'Running a venture on no sleep finally caught up with you. Energy −30.',
      choices: OK,
      data: {},
    }),
    resolve: (s) => {
      s.energy = Math.max(0, s.energy - 30);
      addLog(s, 'warn', 'Caught a cold: energy −30');
    },
  },
  {
    id: 'blogger',
    minDay: 5,
    make: (s) => ({
      id: 'blogger',
      icon: 'Megaphone',
      tone: 'neutral',
      title: 'Influencer shout-out',
      text: 'A local creator offers a story shout-out for ₹50. Could bring a wave of followers.',
      choices: [
        { label: 'Pay ₹50', disabled: s.cash < 50 },
        { label: 'No thanks' },
      ],
      data: {},
    }),
    resolve: (s, _idea, choice, rng) => {
      if (choice !== 0) {
        addLog(s, 'info', 'Skipped the influencer deal');
        return;
      }
      const gain = rng.int(50, 120);
      s.cash -= 50;
      s.stats.spent += 50;
      s.followers += gain;
      addLog(s, 'good', `Influencer shout-out: +${gain} followers for ₹50`);
    },
  },
  {
    id: 'wedding',
    minDay: 3,
    make: () => ({
      id: 'wedding',
      icon: 'Music',
      tone: 'neutral',
      title: "Cousin's wedding",
      text: 'Attendance is non-negotiable. You lose today, but at least you had fun (energy +20).',
      choices: [{ label: 'Dance it out' }],
      data: {},
    }),
    resolve: (s) => {
      s.energy = Math.min(100, s.energy + 20);
      addLog(s, 'event', "Cousin's wedding: lost a day, energy +20");
      return { skipDay: true };
    },
  },
  {
    id: 'collegeFest',
    minDay: 6,
    when: (_s, idea) => segmentWithTag(idea, 'student') >= 0,
    make: (_s, idea) => ({
      id: 'collegeFest',
      icon: 'Tent',
      tone: 'good',
      title: 'College fest weekend',
      text: `${idea.segments[segmentWithTag(idea, 'student')].name} are out and spending. Their demand doubles for 2 days.`,
      choices: [{ label: 'Set up shop!' }],
      data: {},
    }),
    resolve: (s, idea) => {
      addModifier(s, 'collegeFest', 'College fest', { kind: 'segment', index: segmentWithTag(idea, 'student') }, 2, 2);
      addLog(s, 'good', 'College fest: student demand ×2 for 2 days');
    },
  },
  {
    id: 'phone',
    make: (s) => ({
      id: 'phone',
      icon: 'Smartphone',
      tone: 'bad',
      title: 'Cracked phone screen',
      text: 'Your phone slipped. Repair it, or live with a half-working screen for a while?',
      choices: [
        { label: 'Repair (₹60)', disabled: s.cash < 60 },
        { label: 'Live with it', detail: 'WhatsApp & Instagram ×0.6 for 5 days' },
      ],
      data: {},
    }),
    resolve: (s, _idea, choice) => {
      if (choice === 0) {
        s.cash -= 60;
        s.stats.spent += 60;
        addLog(s, 'warn', 'Phone repaired: −₹60');
      } else {
        addModifier(s, 'phoneWa', 'Cracked phone', { kind: 'channel', id: 'whatsapp' }, 0.6, 5);
        addModifier(s, 'phoneIg', 'Cracked phone', { kind: 'channel', id: 'instagram' }, 0.6, 5);
        addLog(s, 'warn', 'Cracked phone: online channels ×0.6 for 5 days');
      }
    },
  },
];

/** Random events plus scheduled ones (market shifts), for resolving whichever is pending. */
export const EVENTS_BY_ID: Record<string, EventDef> = Object.fromEntries([...EVENTS, SHIFT_EVENT].map((e) => [e.id, e]));

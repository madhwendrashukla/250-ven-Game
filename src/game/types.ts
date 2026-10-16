export type ChannelId = 'friends' | 'whatsapp' | 'instagram' | 'stall' | 'ads';

/** Name of an icon in the UI icon registry (lucide icon names). */
export type IconKey = string;

export interface SegmentDef {
  id: string;
  name: string;
  icon: IconKey;
  /** Baseline willingness to pay (₹). Each run randomises the true value around this. */
  wtp: number;
  /** Baseline market size multiplier. */
  size: number;
  tags: string[];
  fit: Record<ChannelId, number>;
  /** Interview quotes. `{price}` is replaced with a hint near the true WTP. */
  quotes: string[];
}

export interface IdeaDef {
  id: string;
  name: string;
  icon: IconKey;
  blurb: string;
  unitCost: number;
  /** Days before stock spoils; null = never spoils. */
  perishDays: number | null;
  /** Scales how many relevant people a channel reaches (big-ticket items have fewer buyers). */
  demandScale: number;
  unitName: string;
  restockVerb: string;
  restockPast: string;
  improveName: string;
  segments: SegmentDef[];
}

export interface ChannelDef {
  id: ChannelId;
  name: string;
  icon: IconKey;
  cost: number;
  energy: number;
  blurb: string;
}

export interface SegmentTruth {
  wtp: number;
  size: number;
}

export type SizeHint = 'unknown' | 'small' | 'medium' | 'large';

export interface DataPoint {
  day: number;
  price: number;
  /** 0..1 — share of people who said yes (test) or bought (sale). */
  rate: number;
  kind: 'test' | 'sale';
}

export interface SegmentKnowledge {
  lo: number;
  hi: number;
  interviews: number;
  sizeHint: SizeHint;
  bestChannel: ChannelId | null;
  quotes: string[];
  points: DataPoint[];
  /** The market moved since you last checked: your price range is a guess again. */
  stale: boolean;
  /** Day the market last moved for this segment (older evidence is out of date). */
  movedOn: number | null;
}

export interface Batch {
  qty: number;
  day: number;
}

export type ModifierTarget =
  | { kind: 'all' }
  | { kind: 'segment'; index: number }
  | { kind: 'channel'; id: ChannelId };

export interface Modifier {
  id: string;
  label: string;
  target: ModifierTarget;
  mult: number;
  /** Last day (inclusive) the modifier is active. */
  until: number;
}

export type LogKind = 'action' | 'sale' | 'event' | 'warn' | 'good' | 'info';

export interface LogEntry {
  day: number;
  kind: LogKind;
  title: string;
  detail?: string;
}

export interface EventChoice {
  label: string;
  detail?: string;
  disabled?: boolean;
}

export interface PendingEvent {
  id: string;
  icon: IconKey;
  tone: 'good' | 'bad' | 'neutral';
  /** Overrides the newspaper's section flag (e.g. "Market moves"). */
  flag?: string;
  title: string;
  text: string;
  choices: EventChoice[];
  data: Record<string, number>;
}

export interface Stats {
  sold: number;
  revenue: number;
  spent: number;
  spoiled: number;
  spoiledValue: number;
  unmet: number;
  interviews: number;
  tests: number;
  posts: number;
  tiredActions: number;
  firstSaleDay: number | null;
  insightsBeforeFirstSale: number;
  salesBySegment: number[];
  revenueBySegment: number[];
  /** Units sold × the segment's true value at the moment of sale — for judging pricing after markets move. */
  valueBySegment: number[];
  sellDaysBySegment: number[];
  peakCash: number;
  rentPaid: number;
}

export type GameAction =
  | { type: 'interview'; segment: number }
  | { type: 'priceTest'; segment: number; price: number }
  | { type: 'restock'; qty: number }
  | { type: 'sell'; segment: number; channel: ChannelId; price: number }
  | { type: 'post' }
  | { type: 'improve' }
  | { type: 'rest' }
  | { type: 'endEarly' };

/** One accepted player move. Replaying these from the seed reproduces the run exactly. */
export type Step = { t: 'act'; a: GameAction } | { t: 'choose'; i: number } | { t: 'perk'; i: number };

export type GoalKind = 'customers' | 'revenue' | 'cash' | 'segments' | 'quality' | 'fans' | 'talkAll';

/** One week's target. Weeks close at the end of days 7, 14, 21 and 28. */
export interface WeekGoal {
  week: number;
  kind: GoalKind;
  target: number;
  reward: { cash: number; fans: number };
  points: number;
  rent: number;
}

/** Totals at the start of the current week, so "this week" goals can measure progress. */
export interface WeekSnapshot {
  sold: number;
  revenue: number;
  salesBySegment: number[];
}

export interface WeekResult {
  week: number;
  kind: GoalKind;
  target: number;
  progress: number;
  hit: boolean;
  points: number;
  rent: number;
  rentPaid: number;
}

export type ShiftKind = 'trend' | 'priceWar' | 'boom' | 'fade';

/** A mid-run market move (kept for the debrief). */
export interface MarketShift {
  day: number;
  segment: number;
  kind: ShiftKind;
  wtpFrom: number;
  wtpTo: number;
  sizeFrom: number;
  sizeTo: number;
  /** Units already sold to the segment when it moved. */
  soldBefore: number;
}

export interface GameState {
  version: 3;
  seed: number;
  rng: number;
  /** Local date (YYYY-MM-DD) when this is a daily-challenge run. */
  dailyLabel: string | null;
  ideaId: string;
  day: number;
  maxDays: number;
  cash: number;
  energy: number;
  followers: number;
  quality: number;
  unitCost: number;
  inventory: Batch[];
  truth: SegmentTruth[];
  knowledge: SegmentKnowledge[];
  whatsappFatigue: number;
  /** Per segment, 1 = fresh market. Drops as you sell to them, recovers daily. */
  saturation: number[];
  modifiers: Modifier[];
  stats: Stats;
  log: LogEntry[];
  pendingEvent: PendingEvent | null;
  firedEvents: string[];
  mentorHint: number | null;
  /** Perk ids drafted so far. */
  perks: string[];
  /** Three perk ids on offer at a week close; the player must pick one before acting. */
  perkOffer: string[] | null;
  goals: WeekGoal[];
  weekStart: WeekSnapshot;
  weeks: WeekResult[];
  /** Rent you could not pay; collected from cash each morning, deducted from the score if still owed. */
  debt: number;
  /** Days on which the market will move (hidden from the player). */
  shiftDays: number[];
  shifts: MarketShift[];
  history: Step[];
  status: 'playing' | 'ended';
}

import { addLog, formatRs, MAX_QUALITY } from './helpers';
import { applyPerk, dealPerks } from './perks';
import type { Rng } from './rng';
import type { GameState, GoalKind, IdeaDef, WeekGoal, WeekSnapshot } from './types';

export const WEEK_LENGTH = 7;
export const WEEKS = 4;
export const RENT = [50, 80, 110, 150];
const REWARDS = [
  { cash: 75, fans: 0 },
  { cash: 0, fans: 50 },
  { cash: 150, fans: 0 },
  { cash: 0, fans: 75 },
];
const POINTS = [100, 150, 200, 250];
/** Sales target that replaces a quality goal when the product is already top quality. */
const REVENUE_FALLBACK = [250, 600, 1200, 1500];

interface GoalTemplate {
  kind: GoalKind;
  target: (idea: IdeaDef) => number;
}

/** Customer counts scale with how many buyers an idea has (cookies sell by the dozen, thrift by the piece). */
const customers = (base: number) => (idea: IdeaDef) => Math.max(2, Math.floor(base * idea.demandScale));

/** One template is drawn per week at the start of a run (never the same kind twice), so runs ask for different things. */
const POOL: GoalTemplate[][] = [
  [
    { kind: 'customers', target: customers(10) },
    { kind: 'talkAll', target: (idea) => idea.segments.length },
    { kind: 'revenue', target: () => 250 },
  ],
  [
    { kind: 'cash', target: () => 700 },
    { kind: 'customers', target: customers(22) },
    { kind: 'fans', target: () => 60 },
  ],
  [
    { kind: 'segments', target: () => 2 },
    { kind: 'revenue', target: () => 1200 },
    { kind: 'quality', target: () => 2 },
  ],
  [
    { kind: 'quality', target: () => MAX_QUALITY },
    { kind: 'cash', target: () => 2000 },
    { kind: 'customers', target: customers(35) },
    { kind: 'segments', target: () => 2 },
  ],
];

export function drawGoals(idea: IdeaDef, rng: Rng): WeekGoal[] {
  const used = new Set<GoalKind>();
  return POOL.map((options, i) => {
    const fresh = options.filter((o) => !used.has(o.kind));
    const t = rng.pick(fresh.length ? fresh : options);
    used.add(t.kind);
    return { week: i + 1, kind: t.kind, target: t.target(idea), reward: REWARDS[i], points: POINTS[i], rent: RENT[i] };
  });
}

export function snapshot(s: GameState): WeekSnapshot {
  return { sold: s.stats.sold, revenue: s.stats.revenue, salesBySegment: [...s.stats.salesBySegment] };
}

/** The goal for the week in progress, or null in the final stretch after week 4. */
export function currentGoal(s: GameState): WeekGoal | null {
  return s.goals[s.weeks.length] ?? null;
}

export function weekCloseDay(week: number): number {
  return week * WEEK_LENGTH;
}

export function goalProgress(s: GameState, goal: WeekGoal): number {
  const b = s.weekStart;
  switch (goal.kind) {
    case 'customers':
      return s.stats.sold - b.sold;
    case 'revenue':
      return Math.round(s.stats.revenue - b.revenue);
    case 'cash':
      return Math.floor(s.cash);
    case 'segments':
      return s.stats.salesBySegment.filter((v, i) => v > b.salesBySegment[i]).length;
    case 'quality':
      return s.quality;
    case 'fans':
      return s.followers;
    case 'talkAll':
      return s.knowledge.filter((k) => k.interviews > 0).length;
  }
}

/** Full sentence, e.g. "Serve 10 customers this week". */
export function goalText(goal: WeekGoal): string {
  switch (goal.kind) {
    case 'customers':
      return `Serve ${goal.target} customers this week`;
    case 'revenue':
      return `Take ${formatRs(goal.target)} in sales this week`;
    case 'cash':
      return `Have ${formatRs(goal.target)} cash on day ${weekCloseDay(goal.week)}`;
    case 'segments':
      return `Sell to ${goal.target} different segments this week`;
    case 'quality':
      return goal.target >= MAX_QUALITY ? 'Reach top quality' : `Reach ${goal.target}-star quality`;
    case 'fans':
      return `Reach ${goal.target} fans`;
    case 'talkAll':
      return 'Talk to every customer segment';
  }
}

/** Short label for the HUD chit. */
export function goalShort(goal: WeekGoal): string {
  switch (goal.kind) {
    case 'customers':
      return `${goal.target} customers`;
    case 'revenue':
      return `${formatRs(goal.target)} sales`;
    case 'cash':
      return `${formatRs(goal.target)} cash`;
    case 'segments':
      return `${goal.target} segments`;
    case 'quality':
      return `${goal.target}-star quality`;
    case 'fans':
      return `${goal.target} fans`;
    case 'talkAll':
      return 'Talk to all';
  }
}

export const GOAL_ICON: Record<GoalKind, string> = {
  customers: 'Users',
  revenue: 'HandCoins',
  cash: 'Wallet',
  segments: 'Compass',
  quality: 'Star',
  fans: 'Smartphone',
  talkAll: 'MessagesSquare',
};

export function rewardText(goal: WeekGoal): string {
  const parts = [];
  if (goal.reward.cash) parts.push(`+${formatRs(goal.reward.cash)}`);
  if (goal.reward.fans) parts.push(`+${goal.reward.fans} fans`);
  parts.push(`+${goal.points} pts`);
  return parts.join(' · ');
}

/** Points earned from weekly targets so far. */
export function goalPoints(s: GameState): number {
  return s.weeks.reduce((sum, w) => sum + (w.hit ? w.points : 0), 0);
}

/**
 * End of days 7, 14, 21 and 28: score the target, pay the reward, collect rent and deal a perk draft.
 * Runs before the day ticks over, so ledger entries land on the closing day.
 */
export function closeWeek(s: GameState, idea: IdeaDef): void {
  const goal = currentGoal(s);
  if (!goal) return;
  const progress = goalProgress(s, goal);
  const hit = progress >= goal.target;
  if (hit) {
    s.cash += goal.reward.cash;
    s.followers += goal.reward.fans;
    addLog(s, 'good', `Week ${goal.week} target hit: ${goalText(goal)}`, `Reward ${rewardText(goal)}.`);
  } else {
    addLog(s, 'warn', `Week ${goal.week} target missed`, `${goalText(goal)} — you got ${progress} of ${goal.target}.`);
  }

  const rentPaid = Math.min(goal.rent, Math.floor(s.cash));
  s.cash -= rentPaid;
  s.stats.spent += rentPaid;
  s.stats.rentPaid += rentPaid;
  const owed = goal.rent - rentPaid;
  s.debt += owed;
  addLog(
    s,
    owed > 0 ? 'warn' : 'action',
    `Paid ${formatRs(rentPaid)} rent for week ${goal.week}`,
    owed > 0 ? `${formatRs(owed)} still owed — the landlord will collect it from tomorrow's cash.` : undefined,
  );

  s.weeks.push({ week: goal.week, kind: goal.kind, target: goal.target, progress, hit, points: goal.points, rent: goal.rent, rentPaid });
  s.weekStart = snapshot(s);
  fitGoal(s);
  const offer = dealPerks(s, idea, goal.week);
  s.perkOffer = offer.length ? offer : null;
}

/**
 * Targets on running totals (fans, quality, cash) could already be met when their week opens.
 * Raise them above where the stall stands so every week asks for something new.
 */
export function fitGoal(s: GameState): void {
  const goal = currentGoal(s);
  if (!goal) return;
  switch (goal.kind) {
    case 'fans':
      if (s.followers >= goal.target) goal.target = Math.ceil((s.followers + 35) / 5) * 5;
      break;
    case 'cash':
      if (s.cash >= goal.target) goal.target = Math.ceil((s.cash + 300) / 100) * 100;
      break;
    case 'quality':
      if (s.quality >= goal.target) {
        if (s.quality < MAX_QUALITY) goal.target = s.quality + 1;
        else Object.assign(goal, { kind: 'revenue', target: REVENUE_FALLBACK[goal.week - 1] });
      }
      break;
  }
}

/** Takes one of the offered perks. Returns false if the pick is not on offer. */
export function takePerk(s: GameState, idea: IdeaDef, choice: number): boolean {
  const id = s.perkOffer?.[choice];
  if (!id) return false;
  s.perkOffer = null;
  applyPerk(s, idea, id);
  return true;
}

import { getIdea } from './content';
import { bestSegment, formatRs, inventoryCount, START_CASH } from './helpers';
import type { GameState } from './types';
import { goalPoints } from './weeks';

export interface Archetype {
  icon: string;
  title: string;
  text: string;
}

export interface Lesson {
  icon: string;
  title: string;
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

export interface SegmentReveal {
  name: string;
  icon: string;
  trueWtp: number;
  /** What they valued it at on day 1 (differs from trueWtp if the market moved). */
  startWtp: number;
  estimate: [number, number];
  interviews: number;
  sold: number;
  revenue: number;
  avgPrice: number | null;
  best: boolean;
}

export interface Report {
  /** Cash minus any rent still owed. */
  finalCash: number;
  profit: number;
  roi: number;
  insights: number;
  /** Points from weekly targets (already inside `score`). */
  goalPoints: number;
  weeksHit: number;
  score: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  archetype: Archetype;
  lessons: Lesson[];
  segments: SegmentReveal[];
  leftoverStock: number;
}

export function computeScore(s: GameState): number {
  const profit = s.cash - s.debt - START_CASH;
  const insights = Math.min(12, s.stats.interviews + s.stats.tests);
  return Math.max(0, Math.round(profit + s.stats.sold * 3 + insights * 15 + s.followers * 0.5 + s.quality * 20 + goalPoints(s)));
}

function gradeFor(score: number): Report['grade'] {
  if (score >= 5000) return 'S';
  if (score >= 3500) return 'A';
  if (score >= 1800) return 'B';
  if (score >= 700) return 'C';
  return 'D';
}

function archetypeFor(s: GameState, profit: number, insights: number): Archetype {
  if (s.stats.tiredActions >= 5)
    return { icon: 'Flame', title: 'The Burnt-out Founder', text: 'You hustled on empty for days. Rest is a strategy, not a weakness.' };
  if (profit >= 3500)
    return { icon: 'Gem', title: 'The Unicorn Hunter', text: 'You found a real market and scaled it relentlessly.' };
  if (profit >= 1500)
    return { icon: 'Rocket', title: 'The Bootstrapper', text: 'You turned pocket money into a profitable little machine.' };
  if (insights >= 8 && profit >= 0)
    return { icon: 'FlaskConical', title: 'The Scientist', text: 'You tested before you bet. That habit compounds.' };
  if (s.followers >= 250)
    return { icon: 'Megaphone', title: 'The Storyteller', text: 'You built an audience. Now give them something to buy.' };
  if (s.stats.sold >= 120)
    return { icon: 'Footprints', title: 'The Hustler', text: 'Volume, volume, volume. Next time, check your margins.' };
  if (profit < 0)
    return { icon: 'TrendingDown', title: 'The Expensive Lesson', text: 'You lost money — cheaply. Every founder pays tuition somewhere.' };
  return { icon: 'Wrench', title: 'The Tinkerer', text: 'A modest profit and plenty learned. Run it again with sharper bets.' };
}

export function buildReport(s: GameState): Report {
  const idea = getIdea(s.ideaId);
  const st = s.stats;
  const finalCash = s.cash - s.debt;
  const profit = finalCash - START_CASH;
  const insights = st.interviews + st.tests;
  const score = computeScore(s);
  const best = bestSegment(s, idea);

  const segments: SegmentReveal[] = idea.segments.map((seg, i) => ({
    name: seg.name,
    icon: seg.icon,
    trueWtp: s.truth[i].wtp,
    startWtp: s.shifts.find((x) => x.segment === i)?.wtpFrom ?? s.truth[i].wtp,
    estimate: [s.knowledge[i].lo, s.knowledge[i].hi],
    interviews: s.knowledge[i].interviews,
    sold: st.salesBySegment[i],
    revenue: st.revenueBySegment[i],
    avgPrice: st.salesBySegment[i] > 0 ? st.revenueBySegment[i] / st.salesBySegment[i] : null,
    best: i === best,
  }));

  const lessons: Lesson[] = [];

  if (st.firstSaleDay === null) {
    lessons.push({ icon: 'Ghost', title: 'No sales at all', text: 'Ideas are cheap; a paying customer is the only real validation. Next run, get to a first sale fast.', tone: 'bad' });
  } else if (st.insightsBeforeFirstSale === 0) {
    lessons.push({ icon: 'Crosshair', title: 'Sold before you listened', text: `Your first sale came on day ${st.firstSaleDay} without a single customer conversation. It's the classic build-first trap — you priced blind.`, tone: 'bad' });
  } else {
    lessons.push({ icon: 'Ear', title: 'Customer discovery first', text: `You ran ${st.insightsBeforeFirstSale} interviews/tests before your first sale on day ${st.firstSaleDay}. Evidence before inventory.`, tone: 'good' });
  }

  const bestSeg = segments[best];
  const bestShare = st.sold > 0 ? bestSeg.sold / st.sold : 0;
  if (st.sold > 0) {
    lessons.push(
      bestShare >= 0.5
        ? { icon: 'Compass', title: 'You found your best segment', text: `${bestSeg.name} were the most profitable market (true value ≈ ₹${bestSeg.trueWtp}), and ${Math.round(bestShare * 100)}% of your sales went to them.`, tone: 'good' }
        : { icon: 'Compass', title: 'The money was elsewhere', text: `${bestSeg.name} were your most profitable market (true value ≈ ₹${bestSeg.trueWtp}), but only ${Math.round(bestShare * 100)}% of your sales went to them.`, tone: 'bad' },
    );
  }

  // Judge each sale against what the segment valued it at that day — markets move mid-run.
  const pricing = segments
    .map((seg, i) => ({ seg, value: st.valueBySegment[i] / Math.max(1, seg.sold), ratio: seg.revenue / Math.max(1, st.valueBySegment[i]) }))
    .filter((p) => p.seg.avgPrice !== null && p.seg.sold >= 5);
  const under = pricing.find((p) => p.ratio < 0.6);
  const over = pricing.find((p) => p.ratio > 1.05);
  if (under) {
    lessons.push({ icon: 'Tag', title: 'Money left on the table', text: `You averaged ${formatRs(under.seg.avgPrice!)} with ${under.seg.name}, who valued it at ≈ ${formatRs(under.value)} when you sold. The sweet spot is usually ~75–85% of what they value it at right now.`, tone: 'bad' });
  } else if (over) {
    lessons.push({ icon: 'Tag', title: 'Priced above the market', text: `You averaged ${formatRs(over.seg.avgPrice!)} with ${over.seg.name}, above their ≈ ${formatRs(over.value)} valuation — most people walked away.`, tone: 'bad' });
  } else if (pricing.length) {
    lessons.push({ icon: 'Tag', title: 'Sharp pricing', text: 'Your prices stayed close to the profit-maximising zone. That is demand-curve thinking paying off.', tone: 'good' });
  }

  const shift = s.shifts.find((x) => x.wtpTo !== x.wtpFrom);
  if (shift) {
    const name = idea.segments[shift.segment].name;
    const moved = `On day ${shift.day} ${name.toLowerCase()} went from valuing it at ≈ ₹${shift.wtpFrom} to ≈ ₹${shift.wtpTo}.`;
    const soldAfter = st.salesBySegment[shift.segment] - shift.soldBefore;
    const rechecked = !s.knowledge[shift.segment].stale;
    if (rechecked) {
      lessons.push({ icon: 'RefreshCw', title: 'You re-checked when the market moved', text: `${moved} You went back for fresh evidence instead of trusting old notes.`, tone: 'good' });
    } else if (soldAfter >= 3) {
      lessons.push({ icon: 'RefreshCw', title: 'Selling on stale numbers', text: `${moved} You kept selling to them without re-checking. A quick talk or price test would have found the new level.`, tone: 'bad' });
    } else {
      lessons.push({ icon: 'RefreshCw', title: 'Markets move', text: `${moved} Evidence has a shelf life — re-check after big news.`, tone: 'neutral' });
    }
  }

  if (s.weeks.length) {
    const hit = s.weeks.filter((w) => w.hit).length;
    lessons.push({
      icon: 'Target',
      title: `${hit} of ${s.weeks.length} weekly targets`,
      text:
        hit === s.weeks.length
          ? `Every target hit, worth ${goalPoints(s)} points. Short goals keep a long plan honest.`
          : hit > 0
            ? `${goalPoints(s)} points from targets. Each week's goal is printed by the calendar — plan the week around it.`
            : 'No weekly targets hit. They are printed by the calendar; a week planned around one is rarely wasted.',
      tone: hit >= 3 ? 'good' : hit >= 2 ? 'neutral' : 'bad',
    });
  }
  if (s.debt > 0) {
    lessons.push({ icon: 'Landmark', title: 'Rent still owed', text: `You ended ${formatRs(s.debt)} behind on rent; it comes off your final cash. Keep a buffer before the week closes.`, tone: 'bad' });
  }

  if (st.unmet >= 15) {
    lessons.push({ icon: 'PackageX', title: 'Empty shelves', text: `${st.unmet} people wanted to buy but you had no stock. Demand you can't serve is revenue you never see.`, tone: 'bad' });
  }
  if (st.spoiled > 0) {
    lessons.push({ icon: 'Trash2', title: 'Spoilage', text: `${st.spoiled} ${idea.unitName}s went stale — about ${formatRs(st.spoiledValue)} binned. Match production to proven demand.`, tone: st.spoiledValue > 100 ? 'bad' : 'neutral' });
  }
  if (st.tiredActions >= 3) {
    lessons.push({ icon: 'BatteryLow', title: 'Running on empty', text: `${st.tiredActions} of your working days were at low energy, and they were 35% less effective. Rest days are cheap; burnout isn't.`, tone: 'bad' });
  }
  const leftoverStock = inventoryCount(s);
  if (leftoverStock > 0 && !idea.perishDays) {
    lessons.push({ icon: 'Archive', title: 'Unsold stock', text: `${leftoverStock} ${idea.unitName}s are still on your shelf (≈ ${formatRs(leftoverStock * s.unitCost)} tied up). Cash in a box isn't cash in hand.`, tone: 'neutral' });
  }

  return {
    finalCash,
    profit,
    roi: profit / START_CASH,
    insights,
    goalPoints: goalPoints(s),
    weeksHit: s.weeks.filter((w) => w.hit).length,
    score,
    grade: gradeFor(score),
    archetype: archetypeFor(s, profit, insights),
    lessons,
    segments,
    leftoverStock,
  };
}

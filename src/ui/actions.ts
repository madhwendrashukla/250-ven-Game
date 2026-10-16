import type { Tone } from './icons';

export type Tab = 'interview' | 'priceTest' | 'restock' | 'sell' | 'post' | 'improve' | 'rest';

export interface ActionInfo {
  id: Tab;
  icon: string;
  label: string;
  title: string;
  help: string;
  cost: string;
  /** Short cost shown on the move card. */
  tag: string;
  /** Colour = move family: discover (teal), make (marigold), sell (rani), recharge (ink). */
  tone: Tone;
  group: string;
}

/** Shared by the move cards and the How to Play guide. */
export const ACTIONS: ActionInfo[] = [
  {
    id: 'interview',
    icon: 'MessagesSquare',
    label: 'Talk',
    title: 'Talk to customers',
    help: 'Spend a day with one segment. Learn what they would pay, how big the market is and where they hang out.',
    cost: '1 day · −15 energy',
    tag: '1 day',
    tone: 'teal',
    group: 'Discover',
  },
  {
    id: 'priceTest',
    icon: 'FlaskConical',
    label: 'Test',
    title: 'Run a price test',
    help: 'Ask 20 people whether they would buy at a price you pick. No stock needed — pure evidence.',
    cost: '1 day · −10 energy',
    tag: '1 day',
    tone: 'teal',
    group: 'Discover',
  },
  {
    id: 'restock',
    icon: 'Package',
    label: 'Stock',
    title: 'Restock',
    help: 'Make or buy units. 10% off at 20+, 20% off at 50+. Perishables go stale, so match stock to demand.',
    cost: 'No day · −5 energy',
    tag: 'no day',
    tone: 'marigold',
    group: 'Make',
  },
  {
    id: 'improve',
    icon: 'Sparkles',
    label: 'Improve',
    title: 'Improve the product',
    help: 'Invest in quality. More of the people you reach will buy, but each unit costs 8% more to make.',
    cost: '1 day · ₹40 / ₹80 / ₹120',
    tag: '1 day',
    tone: 'marigold',
    group: 'Make',
  },
  {
    id: 'sell',
    icon: 'HandCoins',
    label: 'Sell',
    title: 'Sell',
    help: 'Pick one segment, one channel and a price for the day. Everyone who wants one buys — if you have stock.',
    cost: '1 day · channel cost',
    tag: '1 day',
    tone: 'rani',
    group: 'Sell',
  },
  {
    id: 'post',
    icon: 'Smartphone',
    label: 'Post',
    title: 'Post content',
    help: 'Grow your Instagram following. More followers means bigger Instagram and ad reach.',
    cost: '1 day · −15 energy',
    tag: '1 day',
    tone: 'rani',
    group: 'Sell',
  },
  {
    id: 'rest',
    icon: 'Coffee',
    label: 'Rest',
    title: 'Chai break',
    help: 'Take the day off and recover 45 energy. Below 25 energy you are exhausted and every action is 35% weaker.',
    cost: '1 day · +45 energy',
    tag: '+45',
    tone: 'ink',
    group: 'Recharge',
  },
];

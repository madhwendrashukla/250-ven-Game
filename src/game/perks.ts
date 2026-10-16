import { addLog, formatRs, MAX_QUALITY } from './helpers';
import { Rng } from './rng';
import type { GameState, IconKey, IdeaDef } from './types';

/**
 * Weekly perk draft (Balatro-style): at each week close the player takes 1 of 3 cards.
 * Effects are read by the engine through `hasPerk`; one-off perks act in `onPick`.
 */
export type PerkId =
  | 'whatsappAdmin'
  | 'wholesale'
  | 'cousin'
  | 'blogger'
  | 'examInsider'
  | 'regulars'
  | 'adIntern'
  | 'haat'
  | 'kirana'
  | 'fridge'
  | 'shagun'
  | 'researcher'
  | 'tapri'
  | 'jugaad';

/** Card colour = what the perk helps: teal discovers, marigold makes, rani sells, ink recharges, parrot pays. */
export type PerkTone = 'teal' | 'marigold' | 'rani' | 'ink' | 'parrot';

export interface PerkDef {
  id: PerkId;
  name: string;
  icon: IconKey;
  tone: PerkTone;
  /** Rules text, printed on the card. */
  effect: string;
  /** A handwritten line of flavour. */
  flavor: string;
  eligible?: (s: GameState, idea: IdeaDef) => boolean;
  onPick?: (s: GameState, idea: IdeaDef) => void;
}

export const OFFER_SIZE = 3;
export const SHAGUN = 151;
export const PERK_NUMBERS = {
  wholesaleCut: 0.85,
  studentBoost: 1.25,
  friendsReach: 1.6,
  adCost: 35,
  morningEnergy: 10,
  fridgeDays: 2,
  testSample: 40,
} as const;

export const PERKS: PerkDef[] = [
  {
    id: 'whatsappAdmin',
    name: 'Society WhatsApp admin',
    icon: 'MessageCircle',
    tone: 'rani',
    effect: 'WhatsApp groups get tired of you half as fast.',
    flavor: 'Aunty runs fourteen groups. She will pin your post.',
  },
  {
    id: 'wholesale',
    name: 'Wholesale contact',
    icon: 'Truck',
    tone: 'marigold',
    effect: 'Unit cost −15%, for the rest of the run.',
    flavor: 'Bhaiya at the mandi gives you the dealer rate.',
    onPick: (s) => {
      s.unitCost *= PERK_NUMBERS.wholesaleCut;
    },
  },
  {
    id: 'cousin',
    name: 'Cousin at the stall',
    icon: 'UserPlus',
    tone: 'ink',
    effect: 'Pop-up stall days cost no energy.',
    flavor: 'Free labour. Paid in samosas.',
  },
  {
    id: 'blogger',
    name: 'Blogger friend',
    icon: 'Camera',
    tone: 'rani',
    effect: '+1 fan for every 2 customers, on any channel.',
    flavor: 'One story from her and the whole hostel knows.',
  },
  {
    id: 'examInsider',
    name: 'Exam-season insider',
    icon: 'GraduationCap',
    tone: 'teal',
    effect: 'Student demand +25%.',
    flavor: 'Knows every exam date and every hostel group.',
    eligible: (_s, idea) => idea.segments.some((seg) => seg.tags.includes('student')),
  },
  {
    id: 'regulars',
    name: 'Mohalla regulars',
    icon: 'Handshake',
    tone: 'rani',
    effect: 'Friends & word-of-mouth reach ×1.6.',
    flavor: 'Same faces every evening, and they bring cousins.',
  },
  {
    id: 'adIntern',
    name: 'Ad-agency intern',
    icon: 'Megaphone',
    tone: 'rani',
    effect: 'Boosted Insta ads cost ₹35 instead of ₹60.',
    flavor: 'Has a client account with spare credits.',
  },
  {
    id: 'haat',
    name: 'Weekly haat pitch',
    icon: 'Tent',
    tone: 'teal',
    effect: 'Tired segments recover twice as fast.',
    flavor: 'A new crowd every market day.',
  },
  {
    id: 'kirana',
    name: "Kirana uncle's rate card",
    icon: 'ShoppingBasket',
    tone: 'marigold',
    effect: 'Bulk discounts start at 10+ (−10%) and 30+ (−20%).',
    flavor: 'Buy like a shop, pay like a shop.',
  },
  {
    id: 'fridge',
    name: "Neighbour's fridge",
    icon: 'Refrigerator',
    tone: 'marigold',
    effect: 'Stock stays fresh 2 days longer.',
    flavor: "Top shelf is yours. Don't touch the paneer.",
    eligible: (_s, idea) => idea.perishDays !== null,
  },
  {
    id: 'shagun',
    name: "Mama's shagun",
    icon: 'Gift',
    tone: 'parrot',
    effect: `+${formatRs(SHAGUN)} cash, right now.`,
    flavor: '"For the business, beta." One-rupee coin included.',
    onPick: (s) => {
      s.cash += SHAGUN;
    },
  },
  {
    id: 'researcher',
    name: 'Psychology-major friend',
    icon: 'Microscope',
    tone: 'teal',
    effect: 'Price tests ask 40 people. Interviews narrow the range faster.',
    flavor: 'Turns every chat into a survey.',
  },
  {
    id: 'tapri',
    name: 'Tapri chai tab',
    icon: 'Coffee',
    tone: 'ink',
    effect: '+10 extra energy every morning.',
    flavor: 'Cutting chai on credit, settled at month end.',
  },
  {
    id: 'jugaad',
    name: 'Jugaad workshop',
    icon: 'Wrench',
    tone: 'marigold',
    effect: 'Quality upgrades cost half.',
    flavor: "Your uncle's toolbox and a free Sunday.",
    eligible: (s) => s.quality < MAX_QUALITY,
  },
];

export const PERKS_BY_ID: Record<string, PerkDef> = Object.fromEntries(PERKS.map((p) => [p.id, p]));

export function hasPerk(s: GameState, id: PerkId): boolean {
  return s.perks.includes(id);
}

/**
 * Deals the week's three cards. The shuffle comes from the seed and the week number,
 * so every daily-challenge player is offered the same first draft.
 */
export function dealPerks(s: GameState, idea: IdeaDef, week: number): string[] {
  const pool = PERKS.filter((p) => !s.perks.includes(p.id) && (!p.eligible || p.eligible(s, idea))).map((p) => p.id);
  const rng = new Rng((s.seed ^ Math.imul(week, 0x9e3779b1)) >>> 0);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, OFFER_SIZE);
}

export function applyPerk(s: GameState, idea: IdeaDef, id: string): void {
  const def = PERKS_BY_ID[id];
  s.perks.push(def.id);
  def.onPick?.(s, idea);
  addLog(s, 'good', `New perk: ${def.name}`, def.effect);
}

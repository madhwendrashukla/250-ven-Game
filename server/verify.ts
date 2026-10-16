import { CHANNEL_ORDER, getIdea, IDEAS } from '../src/game/content';
import { act, createGame, pickPerk, resolveEvent } from '../src/game/engine';
import { OFFER_SIZE } from '../src/game/perks';
import { dailySeedForLabel } from '../src/game/rng';
import { buildReport, type Report } from '../src/game/score';
import type { GameAction, GameState, Step } from '../src/game/types';
import type { RunSubmission } from '../src/shared/leaderboard';

const MAX_STEPS = 600;
const DAY_MS = 86_400_000;
/** Daily runs may be submitted up to this many days either side of the server's date (time zones, late finishes). */
const DAILY_WINDOW_DAYS = 2;

export type VerifyResult =
  | { ok: true; submission: RunSubmission; state: GameState; report: Report }
  | { ok: false; error: string };

function isInt(n: unknown, min: number, max: number): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
}

function isPrice(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 100_000;
}

function validAction(a: unknown, segments: number): a is GameAction {
  if (!a || typeof a !== 'object') return false;
  const x = a as Record<string, unknown>;
  switch (x.type) {
    case 'interview':
      return isInt(x.segment, 0, segments - 1);
    case 'priceTest':
      return isInt(x.segment, 0, segments - 1) && isPrice(x.price);
    case 'restock':
      return isInt(x.qty, 1, 5000);
    case 'sell':
      return isInt(x.segment, 0, segments - 1) && CHANNEL_ORDER.includes(x.channel as never) && isPrice(x.price);
    case 'post':
    case 'improve':
    case 'rest':
    case 'endEarly':
      return true;
    default:
      return false;
  }
}

function validStep(step: unknown, segments: number): step is Step {
  if (!step || typeof step !== 'object') return false;
  const s = step as Record<string, unknown>;
  if (s.t === 'act') return validAction(s.a, segments);
  if (s.t === 'choose') return isInt(s.i, 0, 9);
  if (s.t === 'perk') return isInt(s.i, 0, OFFER_SIZE - 1);
  return false;
}

export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N} ._-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (name.length < 2 || name.length > 20) return null;
  if (/https?|www\.|\.com/i.test(name)) return null;
  return name;
}

export function verifyRun(input: unknown, now = new Date()): VerifyResult {
  if (!input || typeof input !== 'object') return { ok: false, error: 'Invalid body' };
  const sub = input as Record<string, unknown>;

  if (typeof sub.playerId !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(sub.playerId)) return { ok: false, error: 'Invalid player id' };
  const name = cleanName(sub.name);
  if (!name) return { ok: false, error: 'Name must be 2–20 letters or numbers' };
  if (typeof sub.ideaId !== 'string' || !IDEAS.some((i) => i.id === sub.ideaId)) return { ok: false, error: 'Unknown idea' };
  if (!isInt(sub.seed, 0, 2 ** 32 - 1)) return { ok: false, error: 'Invalid seed' };

  let dailyLabel: string | null = null;
  if (sub.dailyLabel !== null && sub.dailyLabel !== undefined) {
    if (typeof sub.dailyLabel !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(sub.dailyLabel)) return { ok: false, error: 'Invalid daily date' };
    const labelTime = Date.parse(`${sub.dailyLabel}T00:00:00Z`);
    if (Number.isNaN(labelTime) || Math.abs(labelTime - now.getTime()) > (DAILY_WINDOW_DAYS + 1) * DAY_MS) {
      return { ok: false, error: 'That daily challenge is closed' };
    }
    if (sub.seed !== dailySeedForLabel(sub.dailyLabel)) return { ok: false, error: 'Seed does not match the daily challenge' };
    if (sub.ideaId !== IDEAS[sub.seed % IDEAS.length].id) return { ok: false, error: 'Idea does not match the daily challenge' };
    dailyLabel = sub.dailyLabel;
  }

  const segments = getIdea(sub.ideaId).segments.length;
  if (!Array.isArray(sub.steps) || sub.steps.length === 0 || sub.steps.length > MAX_STEPS) return { ok: false, error: 'Invalid move list' };

  let state = createGame(sub.ideaId, sub.seed, dailyLabel);
  for (let i = 0; i < sub.steps.length; i++) {
    const step = sub.steps[i];
    if (!validStep(step, segments)) return { ok: false, error: `Malformed move #${i + 1}` };
    const next = step.t === 'act' ? act(state, step.a) : step.t === 'choose' ? resolveEvent(state, step.i) : pickPerk(state, step.i);
    if (next === state) return { ok: false, error: `Illegal move #${i + 1}` };
    state = next;
  }
  if (state.status !== 'ended') return { ok: false, error: 'Run is not finished' };

  return {
    ok: true,
    submission: { playerId: sub.playerId, name, ideaId: sub.ideaId, seed: sub.seed, dailyLabel, steps: sub.steps as Step[] },
    state,
    report: buildReport(state),
  };
}

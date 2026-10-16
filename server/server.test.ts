import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { IDEAS } from '../src/game/content';
import { act, createGame, pickPerk, resolveEvent } from '../src/game/engine';
import { dailySeedForLabel, dateLabel, Rng } from '../src/game/rng';
import { computeScore } from '../src/game/score';
import { naiveBot, playRun, smartBot } from '../src/game/sim';
import type { LeaderboardResponse, RunSubmission, SubmitResponse } from '../src/shared/leaderboard';
import { createApp } from './app';
import { openDb } from './db';
import { openPg } from './pg';
import { pgliteClient } from './pglite-client';
import type { Store } from './store';
import { cleanName, verifyRun } from './verify';

const PLAYER_A = 'player-aaaaaaaa';
const PLAYER_B = 'player-bbbbbbbb';

function submission(ideaId: string, seed: number, bot = smartBot, dailyLabel: string | null = null, playerId = PLAYER_A, name = 'Asha'): RunSubmission {
  const s = playRun(ideaId, seed, bot, (id, sd) => createGame(id, sd, dailyLabel));
  return { playerId, name, ideaId, seed, dailyLabel, steps: s.history };
}

function daily(bot = smartBot, playerId = PLAYER_A, name = 'Asha') {
  const label = dateLabel();
  const seed = dailySeedForLabel(label);
  return submission(IDEAS[seed % IDEAS.length].id, seed, bot, label, playerId, name);
}

describe('verifyRun', () => {
  it('accepts a finished run and recomputes its score', () => {
    const sub = submission('cookies', 99);
    const result = verifyRun(sub);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const direct = playRun('cookies', 99, smartBot, createGame);
      expect(result.report.score).toBe(computeScore(direct));
    }
  });

  it('replays the perks a run drafted and reproduces its score', () => {
    for (const idea of IDEAS) {
      const sub = submission(idea.id, 2024);
      const perkSteps = sub.steps.filter((st) => st.t === 'perk');
      expect(perkSteps).toHaveLength(4);
      const result = verifyRun(sub);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const direct = playRun(idea.id, 2024, smartBot, createGame);
        expect(result.state.perks).toEqual(direct.perks);
        expect(result.state.weeks).toEqual(direct.weeks);
        expect(result.report.score).toBe(computeScore(direct));
      }
    }
  });

  it('rejects perk picks that were not on offer, skipped or out of range', () => {
    const sub = submission('notes', 31);
    const first = sub.steps.findIndex((st) => st.t === 'perk');
    expect(verifyRun({ ...sub, steps: [{ t: 'perk', i: 0 }, ...sub.steps] })).toEqual({ ok: false, error: 'Illegal move #1' });
    expect(verifyRun({ ...sub, steps: sub.steps.map((st, i) => (i === first ? { t: 'perk', i: 3 } : st)) })).toEqual({
      ok: false,
      error: `Malformed move #${first + 1}`,
    });
    const skipped = sub.steps.filter((_, i) => i !== first);
    expect(verifyRun({ ...sub, steps: skipped })).toEqual({ ok: false, error: `Illegal move #${first + 1}` });
  });

  it('scores the perk the player actually picked', () => {
    const sub = submission('cookies', 4040);
    const first = sub.steps.findIndex((st) => st.t === 'perk');
    // Re-pick a different card at the first draft, then play the rest of the run out with the smart bot.
    let state = createGame('cookies', 4040);
    for (const st of sub.steps.slice(0, first)) state = st.t === 'act' ? act(state, st.a) : resolveEvent(state, st.i);
    const offered = state.perkOffer!;
    const other = (sub.steps[first] as { i: number }).i === 0 ? 1 : 0;
    state = pickPerk(state, other);
    const rng = new Rng(7);
    for (let guard = 0; guard < 400 && state.status === 'playing'; guard++) {
      if (state.perkOffer) state = pickPerk(state, smartBot.perk(state, rng));
      else if (state.pendingEvent) state = resolveEvent(state, state.pendingEvent.choices.findIndex((c) => !c.disabled));
      else {
        const next = act(state, smartBot.move(state, rng));
        state = next === state ? act(state, { type: 'rest' }) : next;
      }
    }
    const result = verifyRun({ ...sub, steps: state.history });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.perks[0]).toBe(offered[other]);
      expect(result.report.score).toBe(computeScore(state));
    }
  });

  it('rejects an illegal move', () => {
    const sub = submission('cookies', 99);
    sub.steps = [{ t: 'act', a: { type: 'restock', qty: 4000 } }, ...sub.steps];
    const result = verifyRun(sub);
    expect(result).toEqual({ ok: false, error: 'Illegal move #1' });
  });

  it('rejects malformed moves and unfinished runs', () => {
    const sub = submission('stickers', 5);
    expect(verifyRun({ ...sub, steps: [{ t: 'act', a: { type: 'sell', segment: 0, channel: 'telepathy', price: 10 } }] }).ok).toBe(false);
    expect(verifyRun({ ...sub, steps: sub.steps.slice(0, 5) })).toEqual({ ok: false, error: 'Run is not finished' });
  });

  it('checks daily-challenge seeds and dates', () => {
    const good = daily();
    expect(verifyRun(good).ok).toBe(true);
    expect(verifyRun({ ...good, seed: good.seed + 1 }).ok).toBe(false);
    expect(verifyRun({ ...good, dailyLabel: '2001-01-01', seed: dailySeedForLabel('2001-01-01') })).toEqual({
      ok: false,
      error: 'That daily challenge is closed',
    });
  });

  it('cleans player names', () => {
    expect(cleanName('  Asha   K. ')).toBe('Asha K.');
    expect(cleanName('<script>x</script>')).toBe('scriptxscript');
    expect(cleanName('a')).toBeNull();
    expect(cleanName('visit www.spam')).toBeNull();
  });
});

// The same API tests run on both stores: SQLite (local/single host) and Postgres (Supabase, here PGlite).
const STORES: [string, () => Promise<Store>][] = [
  ['SQLite', async () => openDb(':memory:')],
  ['Postgres', async () => openPg(await pgliteClient())],
];

describe.each(STORES)('leaderboard API on %s', (kind, open) => {
  let db: Store;
  let base = '';
  let server: ReturnType<ReturnType<typeof createApp>['listen']>;

  beforeAll(async () => {
    db = await open();
    server = createApp(db, { rateLimit: 1000 }).listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }, 30_000);

  afterAll(async () => {
    server.close();
    await db.close();
  });

  it('reports the store in the health check', async () => {
    const health = await (await fetch(`${base}/api/health`)).json();
    expect(health).toEqual({ ok: true, store: kind.toLowerCase(), db: 'ok' });
  });

  const post = (body: unknown) =>
    fetch(`${base}/api/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  it('ranks daily runs by each player’s best score', async () => {
    const weak = await post(daily(naiveBot, PLAYER_A, 'Asha'));
    expect(weak.status).toBe(201);
    const strong = (await (await post(daily(smartBot, PLAYER_A, 'Asha'))).json()) as SubmitResponse;
    expect(strong.improved).toBe(true);
    expect(strong.daily).toEqual({ rank: 1, total: 1 });

    const other = (await (await post(daily(naiveBot, PLAYER_B, 'Ravi'))).json()) as SubmitResponse;
    expect(other.daily?.total).toBe(2);

    const board = (await (await fetch(`${base}/api/leaderboard?board=daily&date=${dateLabel()}&playerId=${PLAYER_B}`)).json()) as LeaderboardResponse;
    expect(board.rows).toHaveLength(2);
    expect(board.rows[0].name).toBe('Asha');
    expect(board.rows[0].score).toBe(strong.score);
    expect(board.rows.find((r) => r.isMe)?.name).toBe('Ravi');
    expect(board.me?.rank).toBe(board.rows.find((r) => r.isMe)?.rank);
  });

  it('accepts a run that drafted perks and stores the replayed score', async () => {
    const sub = submission('plants', 555, smartBot, null, PLAYER_A, 'Asha');
    expect(sub.steps.some((st) => st.t === 'perk')).toBe(true);
    const res = await post(sub);
    expect(res.status).toBe(201);
    const body = (await res.json()) as SubmitResponse;
    expect(body.score).toBe(computeScore(playRun('plants', 555, smartBot, createGame)));
  });

  it('filters the all-time board by idea', async () => {
    await post(submission('thrift', 77, smartBot, null, PLAYER_B, 'Ravi'));
    const all = (await (await fetch(`${base}/api/leaderboard?board=alltime`)).json()) as LeaderboardResponse;
    const thrift = (await (await fetch(`${base}/api/leaderboard?board=alltime&idea=thrift`)).json()) as LeaderboardResponse;
    expect(all.total).toBe(2);
    expect(thrift.rows.every((r) => r.ideaId === 'thrift')).toBe(true);
    expect(thrift.total).toBe(1);
  });

  it('rejects bad submissions with a reason', async () => {
    const res = await post({ ...daily(), name: '!' });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/Name/);
    const bad = await fetch(`${base}/api/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{nope' });
    expect(bad.status).toBe(400);
  });
});

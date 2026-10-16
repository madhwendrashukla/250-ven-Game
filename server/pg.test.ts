import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import fs from 'node:fs';
import net from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectPg, PG_SCHEMA } from './pg';
import type { RunRow, Store } from './store';

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer().listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as net.AddressInfo;
      probe.close(() => resolve(port));
    });
    probe.on('error', reject);
  });
}

function run(playerId: string, name: string, score: number, seed = 1): RunRow {
  return {
    playerId,
    name,
    ideaId: 'cookies',
    seed,
    dailyLabel: '2026-10-16',
    score,
    profit: score - 100,
    finalCash: score + 150,
    customers: 10,
    grade: 'B',
    archetype: 'The Tinkerer',
    archetypeIcon: 'Wrench',
    days: 30,
    stepsJson: '[]',
  };
}

describe('Postgres store', () => {
  it('keeps the Supabase migration identical to the schema the server applies', () => {
    const migration = fs.readFileSync(new URL('../supabase/migrations/20261016000000_leaderboard.sql', import.meta.url), 'utf8');
    expect(migration).toBe(PG_SCHEMA);
  });

  describe('over a real connection (postgres.js driver → PGlite socket)', () => {
    let pg: PGlite;
    let socket: PGLiteSocketServer;
    let store: Store;

    beforeAll(async () => {
      pg = await PGlite.create();
      const port = await freePort();
      socket = new PGLiteSocketServer({ db: pg, port, host: '127.0.0.1', maxConnections: 4 });
      await socket.start();
      store = connectPg(`postgres://postgres:postgres@127.0.0.1:${port}/postgres`);
    }, 30_000);

    afterAll(async () => {
      await store.close();
      await socket.stop();
      await pg.close();
    });

    it('creates the table on first use with row level security on', async () => {
      await store.ping();
      expect(await store.leaderboard({ board: 'alltime' })).toMatchObject({ total: 0, rows: [], me: null });
      const rls = await pg.query<{ relrowsecurity: boolean }>(`select relrowsecurity from pg_class where oid = 'public.runs'::regclass`);
      expect(rls.rows[0].relrowsecurity).toBe(true);
    });

    it("keeps each player's best run per seed, renames and ranks them", async () => {
      expect(await store.saveRun(run('p1', 'Asha', 900))).toBe(true);
      expect(await store.saveRun(run('p1', 'Asha', 500))).toBe(false);
      expect(await store.saveRun(run('p2', 'Ravi', 1200))).toBe(true);
      // Seeds go up to 2^32 − 1, beyond a Postgres integer.
      expect(await store.saveRun(run('p1', 'Asha K', 1500, 4_000_000_000))).toBe(true);

      const board = await store.leaderboard({ board: 'alltime', playerId: 'p2' });
      expect(board.rows.map((r) => [r.rank, r.name, r.score, r.isMe])).toEqual([
        [1, 'Asha K', 1500, false],
        [2, 'Ravi', 1200, true],
      ]);
      expect(board.total).toBe(2);
      expect(board.me).toEqual({ rank: 2, score: 1200 });
      expect(board.rows[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(await store.rankOf({ board: 'daily', date: '2026-10-16', playerId: 'p1' })).toEqual({ rank: 1, total: 2 });
      expect(await store.rankOf({ board: 'daily', date: '2026-10-17', playerId: 'p1' })).toBeNull();
      expect((await store.leaderboard({ board: 'alltime', idea: 'thrift' })).total).toBe(0);
    });
  });
});

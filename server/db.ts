import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { boardParams, runKey, toBoardRow, type BoardQuery, type RunRow, type Store } from './store';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS runs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  run_key        TEXT    NOT NULL UNIQUE,
  player_id      TEXT    NOT NULL,
  name           TEXT    NOT NULL,
  idea_id        TEXT    NOT NULL,
  seed           INTEGER NOT NULL,
  daily_label    TEXT,
  score          INTEGER NOT NULL,
  profit         INTEGER NOT NULL,
  final_cash     INTEGER NOT NULL,
  customers      INTEGER NOT NULL,
  grade          TEXT    NOT NULL,
  archetype      TEXT    NOT NULL,
  archetype_icon TEXT    NOT NULL,
  days           INTEGER NOT NULL,
  steps_json     TEXT    NOT NULL,
  created_at     TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_runs_daily ON runs (daily_label, score DESC);
CREATE INDEX IF NOT EXISTS idx_runs_idea  ON runs (idea_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_runs_score ON runs (score DESC);
`;

/** Best run per player for the chosen board, ranked. */
const RANKED = `
WITH filtered AS (
  SELECT * FROM runs
  WHERE (@board = 'daily' AND daily_label = @date)
     OR (@board = 'alltime' AND (@idea IS NULL OR idea_id = @idea))
),
best AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY score DESC, created_at ASC) AS rn FROM filtered
),
ranked AS (
  SELECT *, RANK() OVER (ORDER BY score DESC) AS rank FROM best WHERE rn = 1
)`;

/** SQLite store: local dev, tests, or a single Node host with a persistent disk. */
export function openDb(file: string): Store {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);

  const existing = db.prepare('SELECT score FROM runs WHERE run_key = ?');
  const upsert = db.prepare(`
    INSERT INTO runs (run_key, player_id, name, idea_id, seed, daily_label, score, profit, final_cash, customers,
                      grade, archetype, archetype_icon, days, steps_json, created_at)
    VALUES (@runKey, @playerId, @name, @ideaId, @seed, @dailyLabel, @score, @profit, @finalCash, @customers,
            @grade, @archetype, @archetypeIcon, @days, @stepsJson, @createdAt)
    ON CONFLICT(run_key) DO UPDATE SET
      name = excluded.name, score = excluded.score, profit = excluded.profit, final_cash = excluded.final_cash,
      customers = excluded.customers, grade = excluded.grade, archetype = excluded.archetype,
      archetype_icon = excluded.archetype_icon, days = excluded.days, steps_json = excluded.steps_json,
      created_at = excluded.created_at
    WHERE excluded.score > runs.score`);
  const rename = db.prepare('UPDATE runs SET name = ? WHERE player_id = ?');
  const rows = db.prepare(`${RANKED}
    SELECT rank, name, idea_id, score, profit, grade, archetype, archetype_icon, daily_label, created_at, player_id
    FROM ranked ORDER BY rank, created_at LIMIT @limit`);
  const me = db.prepare(`${RANKED} SELECT rank, score FROM ranked WHERE player_id = @playerId`);
  const total = db.prepare(`${RANKED} SELECT COUNT(*) AS n FROM ranked`);

  return {
    kind: 'sqlite',

    async saveRun(run: RunRow) {
      const key = runKey(run);
      const prev = existing.get(key) as { score: number } | undefined;
      const tx = db.transaction(() => {
        upsert.run({ ...run, runKey: key, createdAt: new Date().toISOString() });
        // A player's latest name is shown on all their entries.
        rename.run(run.name, run.playerId);
      });
      tx();
      return !prev || run.score > prev.score;
    },

    async rankOf(q: BoardQuery) {
      const p = boardParams(q);
      const mine = me.get(p) as { rank: number } | undefined;
      if (!mine) return null;
      return { rank: mine.rank, total: (total.get(p) as { n: number }).n };
    },

    async leaderboard(q: BoardQuery) {
      const p = boardParams(q);
      const list = (rows.all(p) as Record<string, unknown>[]).map((r) => toBoardRow(r, p));
      const mine = p.playerId ? (me.get(p) as { rank: number; score: number } | undefined) : undefined;
      return {
        board: q.board,
        date: p.date,
        idea: p.idea,
        total: (total.get(p) as { n: number }).n,
        rows: list,
        me: mine ? { rank: mine.rank, score: mine.score } : null,
      };
    },

    async ping() {
      db.prepare('SELECT 1').get();
    },

    async close() {
      db.close();
    },
  };
}

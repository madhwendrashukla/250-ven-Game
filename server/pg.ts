import postgres from 'postgres';
import { boardParams, runKey, toBoardRow, type BoardQuery, type RunRow, type Store } from './store';

/** The few things the store needs from a Postgres connection (postgres.js in production, PGlite in tests). */
export interface PgClient {
  query(text: string, params: unknown[]): Promise<Record<string, unknown>[]>;
  /** Runs several statements that take no parameters. */
  exec(text: string): Promise<void>;
  end(): Promise<void>;
}

/**
 * The leaderboard table. Kept identical to supabase/migrations/20261016000000_leaderboard.sql
 * (a test checks); the server also runs it once if the table is missing.
 */
export const PG_SCHEMA = `-- ₹250 Venture leaderboard (Supabase / Postgres).
create table if not exists public.runs (
  id             bigint generated always as identity primary key,
  run_key        text        not null unique,
  player_id      text        not null,
  name           text        not null,
  idea_id        text        not null,
  seed           bigint      not null,
  daily_label    text,
  score          integer     not null,
  profit         integer     not null,
  final_cash     integer     not null,
  customers      integer     not null,
  grade          text        not null,
  archetype      text        not null,
  archetype_icon text        not null,
  days           integer     not null,
  steps_json     text        not null,
  created_at     timestamptz not null default now()
);
create index if not exists idx_runs_daily  on public.runs (daily_label, score desc);
create index if not exists idx_runs_idea   on public.runs (idea_id, score desc);
create index if not exists idx_runs_score  on public.runs (score desc);
create index if not exists idx_runs_player on public.runs (player_id);

-- Only the game server touches this table: it connects as the table owner and verifies every run.
-- Row level security with no policies keeps the table out of Supabase's public REST API.
alter table public.runs enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table public.runs from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on table public.runs from authenticated;
  end if;
end $$;
`;

/** Best run per player for the chosen board, ranked. $1 board, $2 date, $3 idea. */
const RANKED = `
with filtered as (
  select * from public.runs
  where ($1::text = 'daily' and daily_label = $2::text)
     or ($1::text = 'alltime' and ($3::text is null or idea_id = $3::text))
),
best as (
  select *, row_number() over (partition by player_id order by score desc, created_at asc) as rn from filtered
),
ranked as (
  select *, (rank() over (order by score desc))::int as rank from best where rn = 1
)`;

const UPSERT = `
insert into public.runs (run_key, player_id, name, idea_id, seed, daily_label, score, profit, final_cash, customers,
                         grade, archetype, archetype_icon, days, steps_json, created_at)
values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now())
on conflict (run_key) do update set
  name = excluded.name, score = excluded.score, profit = excluded.profit, final_cash = excluded.final_cash,
  customers = excluded.customers, grade = excluded.grade, archetype = excluded.archetype,
  archetype_icon = excluded.archetype_icon, days = excluded.days, steps_json = excluded.steps_json,
  created_at = excluded.created_at
where excluded.score > runs.score`;

/** Postgres store over any client. Creates the table on first use if it doesn't exist yet. */
export function openPg(client: PgClient): Store {
  let ready: Promise<void> | null = null;
  function ensureSchema(): Promise<void> {
    ready ??= (async () => {
      const [row] = await client.query(`select to_regclass('public.runs') as t`, []);
      if (!row?.t) await client.exec(PG_SCHEMA);
    })().catch((err) => {
      ready = null;
      throw err;
    });
    return ready;
  }
  async function query(text: string, params: unknown[]) {
    await ensureSchema();
    return client.query(text, params);
  }

  return {
    kind: 'postgres',

    async saveRun(run: RunRow) {
      const key = runKey(run);
      const [prev] = await query('select score from public.runs where run_key = $1', [key]);
      await query(UPSERT, [
        key,
        run.playerId,
        run.name,
        run.ideaId,
        run.seed,
        run.dailyLabel,
        run.score,
        run.profit,
        run.finalCash,
        run.customers,
        run.grade,
        run.archetype,
        run.archetypeIcon,
        run.days,
        run.stepsJson,
      ]);
      // A player's latest name is shown on all their entries.
      await query('update public.runs set name = $1 where player_id = $2', [run.name, run.playerId]);
      return !prev || run.score > Number(prev.score);
    },

    async rankOf(q: BoardQuery) {
      const p = boardParams(q);
      const base = [p.board, p.date, p.idea];
      const [mine] = await query(`${RANKED} select rank from ranked where player_id = $4`, [...base, p.playerId]);
      if (!mine) return null;
      const [count] = await query(`${RANKED} select count(*)::int as n from ranked`, base);
      return { rank: Number(mine.rank), total: Number(count.n) };
    },

    async leaderboard(q: BoardQuery) {
      const p = boardParams(q);
      const base = [p.board, p.date, p.idea];
      const rows = await query(
        `${RANKED} select rank, name, idea_id, score, profit, grade, archetype, archetype_icon, daily_label, created_at, player_id
         from ranked order by rank, created_at limit $4`,
        [...base, p.limit],
      );
      const [mine] = p.playerId ? await query(`${RANKED} select rank, score from ranked where player_id = $4`, [...base, p.playerId]) : [];
      const [count] = await query(`${RANKED} select count(*)::int as n from ranked`, base);
      return {
        board: q.board,
        date: p.date,
        idea: p.idea,
        total: Number(count.n),
        rows: rows.map((r) => toBoardRow(r, p)),
        me: mine ? { rank: Number(mine.rank), score: Number(mine.score) } : null,
      };
    },

    async ping() {
      await client.query('select 1', []);
    },

    close: () => client.end(),
  };
}

/**
 * Connects to Postgres by URL. For Supabase on Vercel use the *transaction pooler* string
 * (port 6543): serverless functions open and drop connections constantly, and the pooler absorbs that.
 */
export function connectPg(url: string): Store {
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const sql = postgres(url, {
    prepare: false, // the transaction pooler can't keep prepared statements between requests
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: local ? false : 'require',
    onnotice: () => {},
  });
  return openPg({
    query: async (text, params) => [...(await sql.unsafe(text, params as never[]))],
    exec: async (text) => {
      await sql.unsafe(text).simple();
    },
    end: () => sql.end({ timeout: 5 }),
  });
}

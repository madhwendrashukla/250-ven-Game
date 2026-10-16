-- ₹250 Venture leaderboard (Supabase / Postgres).
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

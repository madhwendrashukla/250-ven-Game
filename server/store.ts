import type { Board, LeaderboardResponse, LeaderboardRow, RankInfo } from '../src/shared/leaderboard';

/**
 * Leaderboard storage. Two implementations share these semantics:
 * SQLite (`db.ts`, local dev, tests, a single Node host) and Postgres (`pg.ts`, Supabase on Vercel).
 */
export interface Store {
  readonly kind: 'sqlite' | 'postgres';
  /** Saves a run, keeping only the best score per player + seed. Resolves to whether it improved. */
  saveRun(run: RunRow): Promise<boolean>;
  rankOf(q: BoardQuery): Promise<RankInfo | null>;
  leaderboard(q: BoardQuery): Promise<LeaderboardResponse>;
  /** Cheap round trip, for the health check. */
  ping(): Promise<void>;
  close(): Promise<void>;
}

export interface RunRow {
  playerId: string;
  name: string;
  ideaId: string;
  seed: number;
  dailyLabel: string | null;
  score: number;
  profit: number;
  finalCash: number;
  customers: number;
  grade: string;
  archetype: string;
  archetypeIcon: string;
  days: number;
  stepsJson: string;
}

export interface BoardQuery {
  board: Board;
  date?: string | null;
  idea?: string | null;
  limit?: number;
  playerId?: string | null;
}

export interface BoardParams {
  board: Board;
  date: string | null;
  idea: string | null;
  limit: number;
  playerId: string | null;
}

export function boardParams(q: BoardQuery): BoardParams {
  return {
    board: q.board,
    date: q.date ?? null,
    idea: q.idea ?? null,
    limit: Math.min(100, Math.max(1, q.limit ?? 50)),
    playerId: q.playerId ?? null,
  };
}

/** One entry per player + idea + seed (+ daily date): replaying the same world only keeps your best. */
export function runKey(run: RunRow): string {
  return `${run.playerId}:${run.ideaId}:${run.seed}:${run.dailyLabel ?? ''}`;
}

/** A ranked row as either database returns it (snake_case columns). */
export function toBoardRow(r: Record<string, unknown>, p: BoardParams): LeaderboardRow {
  const created = r.created_at;
  return {
    rank: Number(r.rank),
    name: r.name as string,
    ideaId: r.idea_id as string,
    score: Number(r.score),
    profit: Number(r.profit),
    grade: r.grade as string,
    archetype: r.archetype as string,
    archetypeIcon: r.archetype_icon as string,
    dailyLabel: (r.daily_label as string | null) ?? null,
    createdAt: created instanceof Date ? created.toISOString() : String(created),
    isMe: !!p.playerId && r.player_id === p.playerId,
  };
}

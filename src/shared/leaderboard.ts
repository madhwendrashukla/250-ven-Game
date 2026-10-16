import type { Step } from '../game/types';

/** What the client sends when a run ends. The server replays `steps` to compute the real score. */
export interface RunSubmission {
  playerId: string;
  name: string;
  ideaId: string;
  seed: number;
  dailyLabel: string | null;
  steps: Step[];
}

export interface RankInfo {
  rank: number;
  total: number;
}

export interface SubmitResponse {
  score: number;
  grade: string;
  /** True when this run beat the player's previous best on that seed. */
  improved: boolean;
  daily: RankInfo | null;
  alltime: RankInfo;
}

export type Board = 'daily' | 'alltime';

export interface LeaderboardRow {
  rank: number;
  name: string;
  ideaId: string;
  score: number;
  profit: number;
  grade: string;
  archetype: string;
  archetypeIcon: string;
  dailyLabel: string | null;
  createdAt: string;
  isMe: boolean;
}

export interface LeaderboardResponse {
  board: Board;
  date: string | null;
  idea: string | null;
  total: number;
  rows: LeaderboardRow[];
  me: { rank: number; score: number } | null;
}

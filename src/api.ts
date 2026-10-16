import type { GameState } from './game/types';
import type { Board, LeaderboardResponse, RunSubmission, SubmitResponse } from './shared/leaderboard';

const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/$/, '');
const PLAYER_KEY = 'rs250:player';
export const OFFLINE = 'Leaderboard server is offline';

export interface Player {
  id: string;
  name: string;
}

function randomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function getPlayer(): Player {
  try {
    const saved = JSON.parse(localStorage.getItem(PLAYER_KEY) ?? 'null') as Player | null;
    if (saved?.id) return saved;
  } catch {
    // Fall through to a fresh identity.
  }
  const player = { id: randomId(), name: '' };
  savePlayer(player);
  return player;
}

export function savePlayer(player: Player): void {
  try {
    localStorage.setItem(PLAYER_KEY, JSON.stringify(player));
  } catch {
    // Identity won't persist across visits; submissions still work this session.
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(`${BASE}${path}`, { ...init, signal: ctrl.signal });
    const body = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) {
      // A dev proxy with no API behind it answers 5xx with an empty body.
      throw new Error(body.error ?? (res.status >= 500 ? OFFLINE : `Request failed (${res.status})`));
    }
    return body;
  } catch (err) {
    if (err instanceof TypeError || (err instanceof DOMException && err.name === 'AbortError')) throw new Error(OFFLINE);
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

export function submitRun(game: GameState, name: string): Promise<SubmitResponse> {
  const player = getPlayer();
  const body: RunSubmission = {
    playerId: player.id,
    name,
    ideaId: game.ideaId,
    seed: game.seed,
    dailyLabel: game.dailyLabel,
    steps: game.history,
  };
  return request<SubmitResponse>('/api/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function fetchLeaderboard(q: { board: Board; date?: string; idea?: string | null }): Promise<LeaderboardResponse> {
  const params = new URLSearchParams({ board: q.board, limit: '50', playerId: getPlayer().id });
  if (q.date) params.set('date', q.date);
  if (q.idea) params.set('idea', q.idea);
  return request<LeaderboardResponse>(`/api/leaderboard?${params}`);
}

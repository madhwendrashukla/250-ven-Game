import type { GameState } from './game/types';

const SAVE_KEY = 'rs250:save:v1';
const HISTORY_KEY = 'rs250:history:v1';

export interface RunRecord {
  id: string;
  ideaId: string;
  score: number;
  profit: number;
  grade: string;
  archetype: string;
  dailyLabel: string | null;
  playedAt: string;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is a convenience; the game works without it.
  }
}

export function loadSave(): GameState | null {
  const s = read<GameState>(SAVE_KEY);
  return s && s.version === 3 && s.status === 'playing' && Array.isArray(s.history) ? s : null;
}

export function saveGame(s: GameState | null): void {
  write(SAVE_KEY, s && s.status === 'playing' ? s : null);
}

export function loadHistory(): RunRecord[] {
  // v0.1 stored archetypes with a leading emoji.
  return (read<RunRecord[]>(HISTORY_KEY) ?? []).map((r) => ({ ...r, archetype: r.archetype.replace(/^[\p{Extended_Pictographic}️\s]+/u, '') }));
}

export function recordRun(record: RunRecord): RunRecord[] {
  const history = loadHistory().filter((r) => r.id !== record.id);
  history.unshift(record);
  const trimmed = history.slice(0, 30);
  write(HISTORY_KEY, trimmed);
  return trimmed;
}

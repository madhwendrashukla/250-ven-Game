import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { fetchLeaderboard, OFFLINE } from '../api';
import { getIdea, IDEAS } from '../game/content';
import { formatRs } from '../game/helpers';
import { dailySeedForLabel, dateLabel } from '../game/rng';
import type { Board, LeaderboardResponse, LeaderboardRow } from '../shared/leaderboard';
import { Icon, IDEA_TONE } from './icons';

interface Props {
  initialBoard?: Board;
  initialDate?: string;
  onBack: () => void;
  onPlayDaily: () => void;
}

type Load = { kind: 'loading' } | { kind: 'ready'; data: LeaderboardResponse } | { kind: 'error'; message: string };

function shiftDate(label: string, days: number): string {
  const d = new Date(`${label}T12:00:00`);
  d.setDate(d.getDate() + days);
  return dateLabel(d);
}

function prettyDate(label: string): string {
  const today = dateLabel();
  if (label === today) return 'Today';
  if (label === shiftDate(today, -1)) return 'Yesterday';
  return new Date(`${label}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const PODIUM_ORDER = [1, 0, 2];
const MEDAL = ['gold', 'silver', 'bronze'];

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function Podium({ rows }: { rows: LeaderboardRow[] }) {
  return (
    <div className="podium">
      {PODIUM_ORDER.map((idx, col) => {
        const r = rows[idx];
        if (!r) return <div key={col} className="podium-slot is-empty" />;
        return (
          <motion.div
            key={`${r.name}-${r.score}`}
            className={`podium-slot podium-${MEDAL[idx]} ${r.isMe ? 'is-me' : ''}`}
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 + (2 - idx) * 0.12, type: 'spring', stiffness: 200, damping: 16 }}
          >
            {idx === 0 && (
              <motion.span className="podium-crown" initial={{ y: -20, rotate: -30, opacity: 0 }} animate={{ y: 0, rotate: -10, opacity: 1 }} transition={{ delay: 0.7, type: 'spring', stiffness: 400, damping: 10 }}>
                <Icon name="Crown" size={28} fill="currentColor" />
              </motion.span>
            )}
            <span className={`podium-avatar tone-${IDEA_TONE[r.ideaId]}`}>{initials(r.name)}</span>
            <b className="podium-name">
              {r.name}
              {r.isMe && <span className="you">you</span>}
            </b>
            <span className="podium-score">{r.score.toLocaleString('en-IN')}</span>
            <div className="podium-block">
              <span>{idx + 1}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export function Leaderboard({ initialBoard = 'daily', initialDate, onBack, onPlayDaily }: Props) {
  const today = dateLabel();
  const [board, setBoard] = useState<Board>(initialBoard);
  const [date, setDate] = useState(initialDate ?? today);
  const [idea, setIdea] = useState<string | null>(null);
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoad({ kind: 'loading' });
    fetchLeaderboard({ board, date: board === 'daily' ? date : undefined, idea: board === 'alltime' ? idea : null })
      .then((data) => alive && setLoad({ kind: 'ready', data }))
      .catch((err: Error) => alive && setLoad({ kind: 'error', message: err.message }));
    return () => {
      alive = false;
    };
  }, [board, date, idea, reload]);

  const dailyIdea = board === 'daily' ? IDEAS[dailySeedForLabel(date) % IDEAS.length] : null;
  const rows = load.kind === 'ready' ? load.data.rows : [];
  const meVisible = rows.some((r) => r.isMe);

  return (
    <div className="page fame">
      <header className="page-header">
        <button className="btn btn-sm tone-paper" onClick={onBack}>
          <Icon name="ChevronLeft" /> Back
        </button>
        <h2 className="page-title">Hall of fame</h2>
      </header>

      <div className="toggle" role="tablist">
        {(['daily', 'alltime'] as const).map((b) => (
          <button key={b} role="tab" aria-selected={board === b} className={`toggle-btn ${board === b ? 'is-on' : ''}`} onClick={() => setBoard(b)}>
            {board === b && <motion.span layoutId="toggle-pill" className="toggle-pill" transition={{ type: 'spring', stiffness: 500, damping: 34 }} />}
            <span className="toggle-label">
              <Icon name={b === 'daily' ? 'CalendarDays' : 'Award'} size={18} /> {b === 'daily' ? 'Daily challenge' : 'All-time'}
            </span>
          </button>
        ))}
      </div>

      {board === 'daily' ? (
        <div className="fame-filter">
          <button className="icon-btn" onClick={() => setDate(shiftDate(date, -1))} aria-label="Previous day">
            <Icon name="ChevronLeft" />
          </button>
          <div className="fame-date">
            <b>{prettyDate(date)}</b>
            <span>{dailyIdea?.name} · same world for all</span>
          </div>
          <button className="icon-btn" onClick={() => setDate(shiftDate(date, 1))} disabled={date >= today} aria-label="Next day">
            <Icon name="ChevronRight" />
          </button>
          {date === today && (
            <button className="btn btn-sm tone-teal fame-play" onClick={onPlayDaily}>
              <Icon name="Play" size={16} /> Play today's
            </button>
          )}
        </div>
      ) : (
        <div className="fame-ideas">
          <button className={`chip-btn ${idea === null ? 'is-on' : ''}`} onClick={() => setIdea(null)}>
            All ideas
          </button>
          {IDEAS.map((i) => (
            <button key={i.id} className={`chip-btn ${idea === i.id ? 'is-on' : ''}`} onClick={() => setIdea(i.id)}>
              <Icon name={i.icon} size={15} /> {i.name}
            </button>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {load.kind === 'loading' && (
          <motion.div key="loading" className="fame-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className="sk" style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </motion.div>
        )}

        {load.kind === 'error' && (
          <motion.div key="error" className="fame-empty card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <span className="fame-empty-icon tone-chili">
              <Icon name={load.message === OFFLINE ? 'WifiOff' : 'AlertTriangle'} size={30} />
            </span>
            <b>{load.message}</b>
            {load.message === OFFLINE && (
              <p>
                The leaderboard server isn't running. Start the game with <code>npm run dev</code> — it launches the game and the API together.
              </p>
            )}
            <button className="btn tone-paper" onClick={() => setReload((n) => n + 1)}>
              <Icon name="RotateCcw" /> Try again
            </button>
          </motion.div>
        )}

        {load.kind === 'ready' && rows.length === 0 && (
          <motion.div key="empty" className="fame-empty card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <motion.span className="fame-empty-icon tone-marigold" animate={{ rotate: [0, -8, 8, 0] }} transition={{ repeat: Infinity, duration: 2.4 }}>
              <Icon name="Trophy" size={34} />
            </motion.span>
            <b>The podium is empty</b>
            <p>{board === 'daily' ? 'Finish this daily challenge to claim the gold.' : 'Finish any venture to claim the top spot.'}</p>
            {board === 'daily' && date === today && (
              <button className="btn tone-teal" onClick={onPlayDaily}>
                <Icon name="Play" /> Play today's challenge
              </button>
            )}
          </motion.div>
        )}

        {load.kind === 'ready' && rows.length > 0 && (
          <motion.div key={`rows-${board}-${date}-${idea}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Podium rows={rows} />
            {rows.length > 3 && (
              <motion.ol className="fame-list" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.04, delayChildren: 0.5 } } }}>
                {rows.slice(3).map((r) => (
                  <motion.li key={`${r.rank}-${r.name}-${r.createdAt}`} className={`fame-row ${r.isMe ? 'is-me' : ''}`} variants={{ hidden: { opacity: 0, x: -20 }, show: { opacity: 1, x: 0 } }}>
                    <span className="fame-rank">{r.rank}</span>
                    <span className={`podium-avatar podium-avatar-sm tone-${IDEA_TONE[r.ideaId]}`}>{initials(r.name)}</span>
                    <span className="fame-name">
                      <b>
                        {r.name}
                        {r.isMe && <span className="you">you</span>}
                      </b>
                      <small>
                        <Icon name={getIdea(r.ideaId).icon} size={12} /> {r.archetype} · <span className={r.profit >= 0 ? 'text-good' : 'text-bad'}>{formatRs(r.profit)}</span>
                      </small>
                    </span>
                    <span className="fame-grade">{r.grade}</span>
                    <span className="fame-score">{r.score.toLocaleString('en-IN')}</span>
                  </motion.li>
                ))}
              </motion.ol>
            )}
            <div className="fame-foot">
              {load.data.me && !meVisible ? (
                <span>
                  <Icon name="User" size={14} /> You're #{load.data.me.rank} of {load.data.total} · {load.data.me.score} pts
                </span>
              ) : (
                <span>
                  {load.data.total} player{load.data.total === 1 ? '' : 's'}
                </span>
              )}
              <span>
                <Icon name="ShieldCheck" size={14} /> every score verified by replay
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

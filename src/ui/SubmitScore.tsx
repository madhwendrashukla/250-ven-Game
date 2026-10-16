import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { getPlayer, OFFLINE, savePlayer, submitRun } from '../api';
import { sfx } from '../audio/sfx';
import type { GameState } from '../game/types';
import type { SubmitResponse } from '../shared/leaderboard';
import { Icon } from './icons';

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'done'; res: SubmitResponse } | { kind: 'error'; message: string };

/** A raffle-ticket style card that posts the run to the hall of fame. */
export function SubmitScore({ game, onOpenLeaderboard }: { game: GameState; onOpenLeaderboard: () => void }) {
  const [name, setName] = useState(() => getPlayer().name);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const autoSent = useRef(false);

  async function send(n = name) {
    const clean = n.trim();
    if (clean.length < 2) {
      setStatus({ kind: 'error', message: 'Pick a name with at least 2 characters.' });
      return;
    }
    setStatus({ kind: 'sending' });
    try {
      const res = await submitRun(game, clean);
      savePlayer({ ...getPlayer(), name: clean });
      setStatus({ kind: 'done', res });
      sfx.rank();
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : 'Could not submit' });
    }
  }

  // Returning players are submitted automatically.
  useEffect(() => {
    if (autoSent.current || !getPlayer().name || game.history.length === 0) return;
    autoSent.current = true;
    void send(getPlayer().name);
  }, []);

  return (
    <section className="ticket submit-ticket">
      <div className="ticket-stub">
        <Icon name="Ticket" size={22} />
        <span>Hall of fame</span>
      </div>
      <div className="ticket-main">
        <AnimatePresence mode="wait">
          {status.kind === 'done' ? (
            <motion.div key="done" className="submit-done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <div className="ranks">
                {status.res.daily && <Rank label="Today's daily" rank={status.res.daily.rank} total={status.res.daily.total} />}
                <Rank label="All-time" rank={status.res.alltime.rank} total={status.res.alltime.total} />
              </div>
              <p className="submit-note">
                <Icon name="ShieldCheck" size={14} /> Verified — the server replayed all {game.history.length} of your moves
                {!status.res.improved && '. Your earlier run on this world scored higher, so that one stays'}.
              </p>
              <button className="btn btn-sm tone-rani" onClick={onOpenLeaderboard}>
                <Icon name="Trophy" size={16} /> Open hall of fame
              </button>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              className="submit-form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <label className="field-legend" htmlFor="player-name">
                Put your name on the board
              </label>
              <div className="submit-row">
                <input id="player-name" className="text-input" value={name} maxLength={20} placeholder="e.g. Asha" autoComplete="nickname" onChange={(e) => setName(e.target.value)} />
                <button className="btn tone-marigold" type="submit" disabled={status.kind === 'sending'} data-sfx="off">
                  {status.kind === 'sending' ? <Icon name="Loader2" className="spin" /> : <Icon name="Send" />}
                  Submit
                </button>
              </div>
              {status.kind === 'error' && (
                <motion.p className="submit-error" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
                  <Icon name={status.message === OFFLINE ? 'WifiOff' : 'AlertTriangle'} size={14} /> {status.message}
                  {status.message === OFFLINE && ' — start it with npm run dev.'}
                </motion.p>
              )}
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function Rank({ label, rank, total }: { label: string; rank: number; total: number }) {
  return (
    <motion.div className="rank" initial={{ y: 14, opacity: 0, rotate: -4 }} animate={{ y: 0, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 16 }}>
      <span className="rank-label">{label}</span>
      <span className="rank-value">#{rank}</span>
      <span className="rank-sub">
        of {total} player{total === 1 ? '' : 's'}
      </span>
    </motion.div>
  );
}

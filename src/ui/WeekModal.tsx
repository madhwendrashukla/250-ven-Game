import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { sfx } from '../audio/sfx';
import { formatRs } from '../game/helpers';
import { PERKS_BY_ID } from '../game/perks';
import type { GameState } from '../game/types';
import { currentGoal, goalText, rewardText, weekCloseDay } from '../game/weeks';
import { Icon } from './icons';
import { Modal } from './Modal';
import { PerkCard } from './PerkCard';

/** Keys are ignored for a moment while the paper spins in, so a stray keypress can't pick a card. */
const ARM_MS = 900;
const PICK_MS = 650;

/** Week close: the Bazaar Times weekly edition settles the target and rent, then deals a perk draft. */
export function WeekModal({ game, onPick }: { game: GameState; onPick: (i: number) => void }) {
  const result = game.weeks[game.weeks.length - 1];
  const goal = game.goals[result.week - 1];
  const next = currentGoal(game);
  const offer = game.perkOffer ?? [];
  const [picked, setPicked] = useState<number | null>(null);
  const opened = useRef(Date.now());

  function pick(i: number) {
    if (picked !== null || !offer[i]) return;
    setPicked(i);
    sfx.stamp();
    window.setTimeout(() => onPick(i), PICK_MS);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || Date.now() - opened.current < ARM_MS) return;
      const n = Number(e.key);
      if (n >= 1 && n <= offer.length) {
        e.preventDefault();
        pick(n - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const owed = result.rent - result.rentPaid;

  return (
    <Modal title={`Week ${result.week} closes`} className={`news week-news news-${result.hit ? 'good' : 'bad'}`} variant="news">
      <div className="news-mast">
        <span>Week {result.week}</span>
        <b>Bazaar Times</b>
        <span>Day {weekCloseDay(result.week)}</span>
      </div>
      <div className="news-rule" />
      <div className="news-flag">
        <Icon name="CalendarCheck" size={14} />
        Weekly edition
      </div>
      <h2 className="news-headline week-headline">{result.hit ? 'Stall beats its target!' : 'Week ends short of target'}</h2>

      <div className="settle">
        <div className="settle-row">
          <span className="settle-key">Target</span>
          <span className="settle-what">{goalText(goal)}</span>
          <b className="settle-val">
            {result.progress}/{result.target}
          </b>
          <motion.span
            className={`settle-stamp ${result.hit ? 'is-hit' : 'is-miss'}`}
            initial={{ scale: 3, opacity: 0, rotate: -30 }}
            animate={{ scale: 1, opacity: 1, rotate: -10 }}
            transition={{ delay: 0.75, type: 'spring', stiffness: 600, damping: 16 }}
          >
            {result.hit ? 'Hit' : 'Missed'}
          </motion.span>
        </div>
        <div className="settle-row">
          <span className="settle-key">Reward</span>
          <span className="settle-what">{result.hit ? rewardText(goal) : 'Nothing this week'}</span>
        </div>
        <div className="settle-row">
          <span className="settle-key">Rent</span>
          <span className="settle-what">{owed > 0 ? `${formatRs(result.rentPaid)} paid · ${formatRs(owed)} owed, collected from tomorrow's cash` : `${formatRs(result.rentPaid)} paid to the landlord`}</span>
          <b className="settle-val settle-minus">−{formatRs(result.rentPaid)}</b>
        </div>
        <div className="settle-row settle-next">
          <span className="settle-key">Next</span>
          <span className="settle-what">
            {next ? (
              <>
                <b>Week {next.week}:</b> {goalText(next)} · rent {formatRs(next.rent)} on day {weekCloseDay(next.week)}
              </>
            ) : (
              <>
                <b>Final stretch:</b> {game.maxDays - weekCloseDay(result.week)} days, no target, no rent — sell what you can
              </>
            )}
          </span>
        </div>
      </div>

      <div className="draft-head">
        <h3>Pick one contact</h3>
        <span>
          They help for the rest of the run
          {offer.length > 1 && <span className="draft-keys"> · keys 1–{offer.length}</span>}
        </span>
      </div>
      <div className="draft">
        {offer.map((id, i) => (
          <PerkCard key={id} perk={PERKS_BY_ID[id]} index={i} hotkey={i + 1} picked={picked} onPick={pick} />
        ))}
      </div>
    </Modal>
  );
}

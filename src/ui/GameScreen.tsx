import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { getIdea } from '../game/content';
import { formatRs } from '../game/helpers';
import type { GameAction, GameState } from '../game/types';
import { ActionPanel } from './ActionPanel';
import { EventModal } from './EventModal';
import { useFx } from './Fx';
import { Hud, type MovePreview } from './Hud';
import { Journal, KIND_ICON } from './Journal';
import { Icon } from './icons';
import { SegmentPanel } from './SegmentPanel';
import { WeekModal } from './WeekModal';

interface Props {
  game: GameState;
  onAct: (a: GameAction) => void;
  onChoose: (i: number) => void;
  onPerk: (i: number) => void;
  onHome: () => void;
  onHelp: () => void;
}

/** Feedback tiers: bigger wins get more coins, more shake and a louder headline. */
function tierFor(revenue: number): 0 | 1 | 2 | 3 {
  if (revenue <= 0) return 0;
  if (revenue < 200) return 1;
  if (revenue < 600) return 2;
  return 3;
}

export function GameScreen({ game, onAct, onChoose, onPerk, onHome, onHelp }: Props) {
  const idea = getIdea(game.ideaId);
  const [freshFrom, setFreshFrom] = useState(() => Math.max(0, game.log.length - 1));
  const [gain, setGain] = useState(0);
  const [preview, setPreview] = useState<MovePreview | null>(null);
  const fresh = game.log.slice(freshFrom);
  const fx = useFx();
  const prev = useRef(game);
  const shake = useAnimationControls();

  useEffect(() => {
    const before = prev.current;
    prev.current = game;
    if (before === game) return;
    const sold = game.stats.sold - before.stats.sold;
    const revenue = game.stats.revenue - before.stats.revenue;
    setGain(revenue);
    const cash = document.querySelector('[data-fx="cash"]');
    const tier = tierFor(revenue);
    if (sold > 0) {
      const source = document.querySelector('.do-btn') ?? document.querySelector('.receipt');
      fx.coins(source, cash, [0, 4, 9, 14][tier]);
      fx.float(cash, `+${formatRs(revenue)}`);
      if (tier === 3 && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        void shake.start({ x: [0, -7, 7, -5, 5, -2, 0], rotate: [0, -0.4, 0.4, 0], transition: { duration: 0.42 } });
      }
    } else if (game.cash < before.cash - 0.5) {
      fx.float(cash, `−${formatRs(before.cash - game.cash)}`, 'bad');
    }
  }, [game, fx, shake]);

  function act(a: GameAction) {
    setFreshFrom(game.log.length);
    onAct(a);
  }

  function choose(i: number) {
    setFreshFrom(game.log.length);
    onChoose(i);
  }

  function takePerk(i: number) {
    setFreshFrom(game.log.length);
    onPerk(i);
  }

  function wrapUp() {
    if (window.confirm('Pull the shutters down now and see your results?')) act({ type: 'endEarly' });
  }

  const tier = tierFor(gain);
  const receiptNo = String(game.history.length).padStart(4, '0');

  return (
    <div className="game">
      <Hud game={game} preview={preview} onHome={onHome} onHelp={onHelp} onWrapUp={wrapUp} />

      <motion.main className="board" animate={shake}>
        <div className="board-main">
          <ActionPanel game={game} onAct={act} onPreview={setPreview} />
          <AnimatePresence mode="wait">
            {fresh.length > 0 && (
              <motion.section
                key={freshFrom}
                className={`receipt ${tier >= 2 ? 'receipt-big' : ''}`}
                aria-live="polite"
                initial={{ clipPath: 'inset(0 0 100% 0)', y: -8 }}
                animate={{ clipPath: 'inset(0 0 -20px 0)', y: 0 }}
                exit={{ opacity: 0, y: 20, rotate: 3 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="receipt-head">
                  <b>₹250 Venture</b>
                  <span>
                    Day {fresh[0].day} · #{receiptNo}
                  </span>
                </div>
                <div className="receipt-sub">{idea.name}</div>
                <ul className="receipt-lines">
                  {fresh.map((e, i) => (
                    <motion.li key={i} className={`r-line r-${e.kind}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 + i * 0.12 }}>
                      <Icon name={KIND_ICON[e.kind]} size={15} />
                      <div>
                        <b>{e.title}</b>
                        {e.detail && <small>{e.detail}</small>}
                      </div>
                    </motion.li>
                  ))}
                </ul>
                {gain > 0 && (
                  <motion.div
                    className="receipt-total"
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.45, type: 'spring', stiffness: 500, damping: 14 }}
                  >
                    <span>{tier === 3 ? 'Big day!' : 'Total'}</span>
                    <b>+{formatRs(gain)}</b>
                  </motion.div>
                )}
                <div className="receipt-foot">
                  <span lang="hi">शुभ लाभ</span> · thank you, come again
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
        <aside className="board-side">
          <SegmentPanel game={game} />
          <Journal log={game.log} />
        </aside>
      </motion.main>

      <AnimatePresence>
        {game.pendingEvent && <EventModal key={game.pendingEvent.id + game.day} event={game.pendingEvent} day={game.day} onChoose={choose} />}
        {game.perkOffer && <WeekModal key={`week-${game.weeks.length}`} game={game} onPick={takePerk} />}
      </AnimatePresence>
    </div>
  );
}

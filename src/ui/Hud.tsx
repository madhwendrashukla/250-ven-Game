import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { getIdea } from '../game/content';
import { shelfLife } from '../game/engine';
import { formatRs, inventoryCount, MAX_QUALITY, TIRED_THRESHOLD } from '../game/helpers';
import { PERKS_BY_ID } from '../game/perks';
import type { GameState } from '../game/types';
import { currentGoal, GOAL_ICON, goalProgress, goalShort, goalText, weekCloseDay, WEEKS } from '../game/weeks';
import { AnimatedNumber } from './AnimatedNumber';
import { ChaiMeter, DayCalendar, DayTrack, FinalStretchChit, GoalChit } from './bits';
import { Icon, IDEA_TONE } from './icons';
import { MuteButton } from './MuteButton';

/** What the currently selected move would change — shown as ghost badges before you commit. */
export interface MovePreview {
  cash: number;
  energy: number;
  days: number;
  stock: number;
}

interface Props {
  game: GameState;
  preview: MovePreview | null;
  onHome: () => void;
  onHelp: () => void;
  onWrapUp: () => void;
}

function Delta({ value, format = (n: number) => String(n) }: { value: number; format?: (n: number) => string }) {
  return (
    <AnimatePresence>
      {value !== 0 && (
        <motion.span
          key={value}
          className={`stat-delta ${value > 0 ? 'up' : 'down'}`}
          initial={{ opacity: 0, y: 6, scale: 0.7 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.7 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
        >
          {value > 0 ? '+' : '−'}
          {format(Math.abs(value))}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function Stat({ icon, label, children, delta, className = '', fx }: { icon: ReactNode; label: string; children: ReactNode; delta?: ReactNode; className?: string; fx?: string }) {
  return (
    <div className={`stat ${className}`} data-fx={fx}>
      <span className="stat-icon">{icon}</span>
      <span className="stat-text">
        <span className="stat-label">{label}</span>
        <span className="stat-value">{children}</span>
      </span>
      {delta}
    </div>
  );
}

export function Hud({ game, preview, onHome, onHelp, onWrapUp }: Props) {
  const idea = getIdea(game.ideaId);
  const stock = inventoryCount(game);
  const tired = game.energy < TIRED_THRESHOLD;

  let stockNote = '';
  const life = shelfLife(game, idea);
  if (life && game.inventory.length) {
    const oldest = Math.min(...game.inventory.map((b) => b.day));
    const left = life - (game.day - oldest);
    stockNote = left <= 1 ? 'stale tmrw' : `fresh ${left}d`;
  }
  const goal = currentGoal(game);
  const money = goal?.kind === 'cash' || goal?.kind === 'revenue';
  const weekEnds = Array.from({ length: WEEKS }, (_, i) => weekCloseDay(i + 1));
  const showChips = game.modifiers.length > 0 || tired || game.perks.length > 0 || game.debt > 0;

  return (
    <header className="hud">
      <div className="hud-bar">
        <div className="hud-left">
          <button className="icon-btn" onClick={onHome} aria-label="Home">
            <Icon name="Home" />
          </button>
          <div className={`signboard tone-${IDEA_TONE[idea.id]}`}>
            <Icon name={idea.icon} size={18} />
            <span className="signboard-text">{idea.name}</span>
            {game.dailyLabel && <span className="signboard-tag">Daily</span>}
          </div>
        </div>

        <div className="hud-stats">
          <div className="calendar-wrap">
            <DayCalendar day={game.day} max={game.maxDays} />
            <Delta value={preview?.days ?? 0} format={() => 'day'} />
          </div>
          {goal ? (
            <GoalChit
              week={goal.week}
              icon={GOAL_ICON[goal.kind]}
              label={goalShort(goal)}
              title={goalText(goal)}
              progress={goalProgress(game, goal)}
              target={goal.target}
              format={money ? (n) => (n >= 1000 ? `${Math.floor(n / 100) / 10}k` : String(n)) : undefined}
              rent={goal.rent}
              daysLeft={weekCloseDay(goal.week) - game.day + 1}
              doneLabel={goal.kind === 'cash' ? 'On track' : 'Done'}
              money={money}
            />
          ) : (
            <FinalStretchChit daysLeft={game.maxDays - game.day + 1} />
          )}
          <Stat
            fx="cash"
            className={game.cash < 40 ? 'stat-bad' : 'stat-cash'}
            icon={<Icon name="Coins" size={20} />}
            label="Cash"
            delta={<Delta value={-(preview?.cash ?? 0)} format={formatRs} />}
          >
            <AnimatedNumber value={game.cash} format={formatRs} />
          </Stat>
          <Stat className={tired ? 'stat-bad' : ''} icon={<ChaiMeter value={game.energy} />} label="Energy" delta={<Delta value={-(preview?.energy ?? 0)} />}>
            <AnimatedNumber value={game.energy} />
          </Stat>
          <Stat fx="stock" icon={<Icon name="Package" size={20} />} label={stockNote ? `Stock · ${stockNote}` : 'Stock'} delta={<Delta value={preview?.stock ?? 0} />}>
            <AnimatedNumber value={stock} duration={0.4} />
          </Stat>
          <Stat icon={<Icon name="Users" size={20} />} label="Fans">
            <AnimatedNumber value={game.followers} />
          </Stat>
          <Stat icon={<Icon name="Star" size={20} />} label="Quality" className="stat-quality">
            <span className="stars" aria-label={`${game.quality} of ${MAX_QUALITY}`}>
              {Array.from({ length: MAX_QUALITY }, (_, i) => (
                <motion.span key={i} initial={false} animate={i < game.quality ? { scale: [1, 1.6, 1], rotate: [0, 20, 0] } : { scale: 1 }} transition={{ duration: 0.45 }}>
                  <Icon name="Star" size={14} fill={i < game.quality ? 'currentColor' : 'none'} />
                </motion.span>
              ))}
            </span>
          </Stat>
        </div>

        <div className="hud-right">
          <MuteButton />
          <button className="icon-btn" onClick={onHelp} aria-label="How to play">
            <Icon name="CircleHelp" />
          </button>
          <button className="btn btn-sm tone-paper hud-wrap" onClick={onWrapUp}>
            <Icon name="Flag" size={16} />
            <span>Wrap up</span>
          </button>
        </div>
      </div>

      <div className="hud-under">
        <DayTrack day={game.day} max={game.maxDays} weekEnds={weekEnds} />
        <AnimatePresence initial={false}>
          {showChips && (
            <motion.div className="modifiers" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              {tired && (
                <motion.span className="chip chip-bad" animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}>
                  <Icon name="BatteryLow" size={14} /> Exhausted — take a chai break
                </motion.span>
              )}
              {game.debt > 0 && (
                <span className="chip chip-bad" title="Collected from your cash each morning">
                  <Icon name="Landmark" size={14} /> Rent owed {formatRs(game.debt)}
                </span>
              )}
              {game.perks.map((id) => {
                const perk = PERKS_BY_ID[id];
                return (
                  <motion.span key={id} layout initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`chip chip-perk tone-${perk.tone}`} title={perk.effect}>
                    <Icon name={perk.icon} size={14} />
                    {perk.name}
                  </motion.span>
                );
              })}
              {game.modifiers.map((m) => (
                <motion.span key={m.id} layout initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`chip ${m.mult >= 1 ? 'chip-good' : 'chip-warn'}`}>
                  <Icon name={m.mult >= 1 ? 'TrendingUp' : 'TrendingDown'} size={14} />
                  {m.label} ×{m.mult} · to day {m.until}
                </motion.span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}

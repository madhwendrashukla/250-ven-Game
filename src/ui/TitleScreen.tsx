import { motion, type Variants } from 'framer-motion';
import { IDEAS } from '../game/content';
import { formatRs } from '../game/helpers';
import { dailySeed } from '../game/rng';
import type { RunRecord } from '../storage';
import { Bunting, Marquee, Sticker } from './bits';
import { Icon, IconBadge, IDEA_TONE } from './icons';
import { MuteButton } from './MuteButton';

interface Props {
  canContinue: boolean;
  continueLabel: string;
  history: RunRecord[];
  onContinue: () => void;
  onNew: () => void;
  onDaily: () => void;
  onHelp: () => void;
  onLeaderboard: () => void;
}

const menu: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.55 } } };
const drop: Variants = {
  hidden: { opacity: 0, y: 30, rotate: -3 },
  show: { opacity: 1, y: 0, rotate: 0, transition: { type: 'spring', stiffness: 320, damping: 18 } },
};

const TICKER = ['Chai', 'Cookies', 'Stickers', 'Cheat-sheets', 'Plants', 'Thrift', 'Customers', 'Margins', 'Hustle', 'Shubh Labh'];

export function TitleScreen({ canContinue, continueLabel, history, onContinue, onNew, onDaily, onHelp, onLeaderboard }: Props) {
  const { label, seed } = dailySeed();
  const dailyIdea = IDEAS[seed % IDEAS.length];
  const best = history.reduce<RunRecord | null>((b, r) => (!b || r.score > b.score ? r : b), null);
  const todays = history.find((r) => r.dailyLabel === label);

  function confirmNew(fn: () => void) {
    if (!canContinue || window.confirm('Abandon your current venture and start over?')) fn();
  }

  return (
    <div className="title-screen">
      <Bunting />
      <div className="title-corner">
        <MuteButton />
      </div>

      <div className="poster">
        <motion.div className="poster-stickers" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.9, type: 'spring', stiffness: 300, damping: 12 }}>
          <Sticker tone="rani" tilt={-12} className="sticker-a">
            30 din
            <small>30 days</small>
          </Sticker>
          <Sticker tone="teal" tilt={10} className="sticker-b">
            No VC
            <small>needed</small>
          </Sticker>
        </motion.div>

        <motion.div
          className="coin-mascot"
          aria-hidden
          initial={{ y: -220, rotate: -200 }}
          animate={{ y: 0, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 160, damping: 11 }}
        >
          <motion.div className="coin" animate={{ rotateY: [0, 360] }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}>
            <Icon name="IndianRupee" size={50} strokeWidth={3} />
          </motion.div>
          <span className="coin-shadow" />
        </motion.div>

        <motion.h1 className="logo" initial={{ scale: 0.6, opacity: 0, rotate: -8 }} animate={{ scale: 1, opacity: 1, rotate: -3 }} transition={{ delay: 0.2, type: 'spring', stiffness: 260, damping: 14 }}>
          <span className="logo-amt">₹250</span>
          <span className="logo-word">Venture</span>
        </motion.h1>
        <motion.p className="poster-tag" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          You've got <b>₹250</b> and <b>30 days</b>. Find customers who'll actually pay.
        </motion.p>
      </div>

      <motion.nav className="menu" variants={menu} initial="hidden" animate="show">
        {canContinue && (
          <motion.div variants={drop}>
            <button className="btn btn-xl tone-marigold menu-btn" onClick={onContinue}>
              <span className="menu-icon">
                <Icon name="Play" size={20} />
              </span>
              <span className="menu-text">
                Continue
                <small>{continueLabel}</small>
              </span>
            </button>
          </motion.div>
        )}
        <motion.div variants={drop}>
          <button className={`btn btn-xl menu-btn ${canContinue ? 'tone-paper' : 'tone-marigold'}`} onClick={() => confirmNew(onNew)}>
            <span className="menu-icon">
              <Icon name="Rocket" size={20} />
            </span>
            <span className="menu-text">
              New venture
              <small>Pick an idea and open your stall</small>
            </span>
          </button>
        </motion.div>
        <motion.div variants={drop}>
          <button className="btn btn-xl tone-teal menu-btn" onClick={() => confirmNew(onDaily)}>
            <span className="menu-icon">
              <Icon name="CalendarDays" size={20} />
            </span>
            <span className="menu-text">
              Daily challenge
              <small>{todays ? `You scored ${todays.score} today` : `Today: ${dailyIdea.name} · same world for all`}</small>
            </span>
            <span className="menu-badge">
              <IconBadge name={dailyIdea.icon} tone="paper" size="md" />
            </span>
          </button>
        </motion.div>
        <motion.div variants={drop} className="menu-row">
          <button className="btn btn-lg tone-rani" onClick={onLeaderboard}>
            <Icon name="Trophy" /> Hall of fame
          </button>
          <button className="btn btn-lg tone-paper" onClick={onHelp}>
            <Icon name="BookOpen" /> How to play
          </button>
        </motion.div>
      </motion.nav>

      {best && (
        <motion.div className="ticket best-ticket" initial={{ opacity: 0, y: 16, rotate: 3 }} animate={{ opacity: 1, y: 0, rotate: 1.5 }} transition={{ delay: 1 }}>
          <span className="ticket-label">Your best</span>
          <span className="ticket-score">{best.score}</span>
          <span className="ticket-meta">
            <IconBadge name={IDEAS.find((i) => i.id === best.ideaId)?.icon ?? 'Rocket'} tone={IDEA_TONE[best.ideaId]} size="sm" />
            {best.archetype} · {formatRs(best.profit)}
          </span>
        </motion.div>
      )}

      <p className="footnote">A learning game about bootstrapping, customer discovery and pricing. Unofficial fan project — not affiliated with any university.</p>
      <Marquee items={TICKER} />
    </div>
  );
}

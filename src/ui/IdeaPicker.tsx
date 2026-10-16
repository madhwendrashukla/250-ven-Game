import { motion, type Variants } from 'framer-motion';
import { IDEAS } from '../game/content';
import { formatRs } from '../game/helpers';
import { Pips, Sticker } from './bits';
import { Icon, IDEA_TONE } from './icons';

/** Character-select style stats (hand-tuned from the economics in content.ts). */
const STATS: Record<string, { margin: number; crowd: number; risk: number; vibe: string }> = {
  cookies: { margin: 3, crowd: 5, risk: 3, vibe: 'Fast cash' },
  stickers: { margin: 3, crowd: 4, risk: 1, vibe: 'Safe start' },
  notes: { margin: 5, crowd: 2, risk: 2, vibe: 'Exam season' },
  plants: { margin: 4, crowd: 2, risk: 2, vibe: 'Slow & steady' },
  thrift: { margin: 4, crowd: 1, risk: 5, vibe: 'High stakes' },
};

const grid: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } } };
const deal: Variants = {
  hidden: { opacity: 0, y: 60, rotate: 8 },
  show: (i: number) => ({ opacity: 1, y: 0, rotate: i % 2 ? 1.2 : -1.2, transition: { type: 'spring', stiffness: 240, damping: 18 } }),
};

export function IdeaPicker({ onPick, onBack }: { onPick: (id: string) => void; onBack: () => void }) {
  return (
    <div className="page picker">
      <header className="page-header">
        <button className="btn btn-sm tone-paper" onClick={onBack}>
          <Icon name="ChevronLeft" /> Back
        </button>
        <h2 className="page-title">Pick your hustle</h2>
      </header>
      <p className="page-sub">Five tiny businesses. Same ₹250. The market behind each one is different every run.</p>

      <motion.div className="hustle-grid" variants={grid} initial="hidden" animate="show">
        {IDEAS.map((idea, i) => {
          const st = STATS[idea.id];
          const tone = IDEA_TONE[idea.id];
          return (
            <motion.button
              key={idea.id}
              custom={i}
              variants={deal}
              className={`hustle tone-${tone}`}
              onClick={() => onPick(idea.id)}
              whileHover={{ y: -8, rotate: 0, transition: { type: 'spring', stiffness: 400, damping: 15 } }}
            >
              <span className="hustle-art">
                <Sticker tone="paper" tilt={8} className="hustle-price">
                  {formatRs(idea.unitCost)}
                  <small>/{idea.unitName}</small>
                </Sticker>
                <motion.span className="hustle-icon" whileHover={{ rotate: [0, -14, 12, 0], scale: 1.08 }} transition={{ duration: 0.5 }}>
                  <Icon name={idea.icon} size={46} strokeWidth={2.2} />
                </motion.span>
                <span className="hustle-vibe">{st.vibe}</span>
              </span>
              <span className="hustle-body">
                <span className="hustle-name">{idea.name}</span>
                <span className="hustle-blurb">{idea.blurb}</span>
                <span className="hustle-stats">
                  <span>Margin</span>
                  <Pips value={st.margin} label="Margin" />
                  <span>Crowd</span>
                  <Pips value={st.crowd} label="Crowd" />
                  <span>Risk</span>
                  <Pips value={st.risk} label="Risk" />
                </span>
                <span className="hustle-foot">
                  <span className="chip">
                    <Icon name={idea.perishDays ? 'Hourglass' : 'ShieldCheck'} size={13} />
                    {idea.perishDays ? `Stale in ${idea.perishDays} days` : 'Never spoils'}
                  </span>
                  <span className="hustle-go">
                    Open stall <Icon name="ArrowRight" size={16} />
                  </span>
                </span>
              </span>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}

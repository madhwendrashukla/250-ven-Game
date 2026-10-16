import { motion } from 'framer-motion';
import type { PendingEvent } from '../game/types';
import { Icon } from './icons';
import { Modal } from './Modal';

const FLAG = { good: 'Good news', bad: 'Trouble', neutral: 'Decision time' } as const;

/** Events arrive as the front page of the local paper. */
export function EventModal({ event, day, onChoose }: { event: PendingEvent; day: number; onChoose: (i: number) => void }) {
  return (
    <Modal title={event.title} className={`news news-${event.tone}`} variant="news">
      <div className="news-mast">
        <span>Day {day}</span>
        <b>Bazaar Times</b>
        <span>₹2 only</span>
      </div>
      <div className="news-rule" />
      <div className="news-flag">
        <Icon name={event.flag ? (event.tone === 'bad' ? 'TrendingDown' : 'TrendingUp') : event.tone === 'bad' ? 'Siren' : event.tone === 'good' ? 'Sparkles' : 'Newspaper'} size={14} />
        {event.flag ?? FLAG[event.tone]}
      </div>
      <div className="news-story">
        <motion.span className="news-icon" initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: -6 }} transition={{ delay: 0.55, type: 'spring', stiffness: 400, damping: 10 }}>
          <Icon name={event.icon} size={38} strokeWidth={2.2} />
        </motion.span>
        <div>
          <h2 className="news-headline">{event.title}</h2>
          <p className="news-text">{event.text}</p>
        </div>
      </div>
      <div className="news-choices">
        {event.choices.map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 + i * 0.08 }}>
            <button className={`btn btn-lg btn-block ${i === 0 ? 'tone-marigold' : 'tone-paper'}`} disabled={c.disabled} onClick={() => onChoose(i)} data-sfx="off">
              <span className="btn-stack">
                {c.label}
                {c.detail && <small>{c.detail}</small>}
              </span>
            </button>
          </motion.div>
        ))}
      </div>
    </Modal>
  );
}

import { AnimatePresence, motion } from 'framer-motion';
import { CHANNELS, getIdea } from '../game/content';
import type { GameState } from '../game/types';
import { Icon, SEGMENT_TONE } from './icons';

const SIZE_LABEL = { unknown: 'size ?', small: 'small crowd', medium: 'medium crowd', large: 'big crowd' };

export function SegmentPanel({ game }: { game: GameState }) {
  const idea = getIdea(game.ideaId);
  return (
    <section className="card customers">
      <div className="card-head">
        <h3 className="card-title">Your customers</h3>
        <span className="card-kicker">what you know so far</span>
      </div>
      <div className="customer-list">
        {idea.segments.map((seg, i) => {
          const k = game.knowledge[i];
          const scale = Math.round(seg.wtp * 2);
          const pct = (v: number) => Math.min(100, Math.max(0, (v / scale) * 100));
          const quote = k.quotes[k.quotes.length - 1];
          const sat = game.saturation[i];
          return (
            <motion.article
              key={seg.id}
              className={`customer tone-${SEGMENT_TONE[i]}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.07, type: 'spring', stiffness: 260, damping: 22 }}
            >
              {game.mentorHint === i && (
                <span className="ribbon">
                  <Icon name="Lightbulb" size={12} /> Mentor's pick
                </span>
              )}
              <div className="customer-top">
                <span className="avatar">
                  <Icon name={seg.icon} size={22} />
                </span>
                <div className="customer-id">
                  <b>{seg.name}</b>
                  <span className="tags">
                    <span className={k.sizeHint === 'unknown' ? 'tag tag-dim' : 'tag'}>
                      <Icon name="Users" size={12} /> {SIZE_LABEL[k.sizeHint]}
                    </span>
                    <span className={k.bestChannel ? 'tag' : 'tag tag-dim'}>
                      {k.bestChannel ? (
                        <>
                          <Icon name={CHANNELS[k.bestChannel].icon} size={12} /> {CHANNELS[k.bestChannel].name}
                        </>
                      ) : (
                        'channel ?'
                      )}
                    </span>
                    <span className="tag tag-dim">
                      <Icon name="MessagesSquare" size={12} /> {k.interviews}
                    </span>
                    <AnimatePresence>
                      {k.stale && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: [0, 1.25, 1] }}
                          exit={{ scale: 0 }}
                          className="tag tag-warn"
                          title={`The market moved on day ${k.movedOn}. Talk to them or run a price test to re-check.`}
                        >
                          <Icon name="RefreshCw" size={12} /> market moved
                        </motion.span>
                      )}
                    </AnimatePresence>
                    <AnimatePresence>
                      {sat < 0.9 && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          className={`tag ${sat < 0.65 ? 'tag-bad' : 'tag-warn'}`}
                          title="Demand recovers a little each day you don't sell to them"
                        >
                          <Icon name="Hourglass" size={12} /> tired of you −{Math.round((1 - sat) * 100)}%
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {quote && (
                  <motion.blockquote key={quote} className="bubble" initial={{ opacity: 0, scale: 0.8, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0 }}>
                    {quote}
                  </motion.blockquote>
                )}
              </AnimatePresence>

              <div className="ruler" aria-label={`Would pay roughly ₹${k.lo} to ₹${k.hi}`}>
                <motion.div
                  className={`ruler-band ${k.stale ? 'is-stale' : ''}`}
                  initial={false}
                  animate={{ left: `${pct(k.lo)}%`, width: `${pct(k.hi) - pct(k.lo)}%` }}
                  transition={{ type: 'spring', stiffness: 90, damping: 15 }}
                />
                <AnimatePresence>
                  {k.points.slice(-8).map((p) => (
                    <motion.span
                      key={`${p.day}-${p.kind}-${p.price}`}
                      className={`pin pin-${p.kind} ${k.movedOn !== null && p.day < k.movedOn ? 'is-old' : ''}`}
                      style={{ left: `${pct(p.price)}%` }}
                      initial={{ scale: 0, y: -10 }}
                      animate={{ scale: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 12 }}
                      title={`Day ${p.day}: ₹${p.price} → ${Math.round(p.rate * 100)}% ${p.kind === 'test' ? 'said yes' : 'bought'}`}
                    />
                  ))}
                </AnimatePresence>
              </div>
              <div className="ruler-labels">
                <span>₹0</span>
                <b>
                  {k.stale ? 'moved: ' : 'would pay '}₹{k.lo}–₹{k.hi}
                  {k.stale ? '?' : ''}
                </b>
                <span>₹{scale}</span>
              </div>
              {k.points.length > 0 && (
                <div className="evidence">
                  {k.points.slice(-3).map((p, j) => (
                    <span key={j} className={`evidence-chip evidence-${p.kind} ${k.movedOn !== null && p.day < k.movedOn ? 'is-old' : ''}`}>
                      <Icon name={p.kind === 'test' ? 'FlaskConical' : 'Coins'} size={12} /> ₹{p.price} → {Math.round(p.rate * 100)}%
                    </span>
                  ))}
                </div>
              )}
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}

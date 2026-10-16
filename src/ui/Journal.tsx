import { motion } from 'framer-motion';
import { useState } from 'react';
import type { LogEntry } from '../game/types';
import { Icon } from './icons';

export const KIND_ICON: Record<LogEntry['kind'], string> = {
  action: 'ArrowRight',
  sale: 'Coins',
  event: 'Newspaper',
  warn: 'AlertTriangle',
  good: 'CheckCircle2',
  info: 'Info',
};

export function LogLine({ entry, delay = 0 }: { entry: LogEntry; delay?: number }) {
  return (
    <motion.li className={`line line-${entry.kind}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay, duration: 0.25 }}>
      <span className="line-icon">
        <Icon name={KIND_ICON[entry.kind]} size={14} />
      </span>
      <div>
        <div className="line-title">{entry.title}</div>
        {entry.detail && <div className="line-detail">{entry.detail}</div>}
      </div>
    </motion.li>
  );
}

/** The founder's bahi-khata: red cloth cover, ruled pages, handwritten entries. */
export function Journal({ log }: { log: LogEntry[] }) {
  const [all, setAll] = useState(false);
  const entries = [...log].reverse();
  const shown = all ? entries : entries.slice(0, 12);
  let lastDay = -1;

  return (
    <section className="ledger">
      <div className="ledger-cover">
        <span className="ledger-mark" lang="hi">
          शुभ लाभ
        </span>
        <h3>Ledger</h3>
        <Icon name="ScrollText" size={18} />
      </div>
      <ul className="ledger-page">
        {shown.map((e, i) => {
          const header = e.day !== lastDay;
          lastDay = e.day;
          return (
            <li key={log.length - i}>
              {header && <div className="ledger-day">Day {e.day}</div>}
              <ul className="lines">
                <LogLine entry={e} />
              </ul>
            </li>
          );
        })}
      </ul>
      {entries.length > shown.length && (
        <button className="btn btn-sm tone-paper ledger-more" onClick={() => setAll(true)}>
          Turn the page · {entries.length - shown.length} older
        </button>
      )}
    </section>
  );
}

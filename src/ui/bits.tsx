/** Small diegetic pieces of the stall: bunting, ticker, calendar, chai glass, stamps. */
import { AnimatePresence, motion } from 'framer-motion';
import { useId, type ReactNode } from 'react';
import { Icon, type Tone } from './icons';

export function Bunting({ count = 22 }: { count?: number }) {
  return (
    <div className="bunting" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`flag flag-${i % 5}`} style={{ animationDelay: `${(i % 7) * 0.18}s` }} />
      ))}
    </div>
  );
}

export function Marquee({ items, reverse = false }: { items: string[]; reverse?: boolean }) {
  const all = [...items, ...items];
  return (
    <div className={`marquee ${reverse ? 'marquee-reverse' : ''}`} aria-hidden>
      <div className="marquee-track">
        {all.map((t, i) => (
          <span key={i} className="marquee-item">
            {t}
            <i className="marquee-dot" />
          </span>
        ))}
      </div>
    </div>
  );
}

export function Pips({ value, max = 5, label }: { value: number; max?: number; label: string }) {
  return (
    <span className="pips" aria-label={`${label}: ${value} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={i < value ? 'on' : ''} />
      ))}
    </span>
  );
}

export function Stamp({ children, tone = 'chili', className = '' }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={`stamp tone-${tone} ${className}`}>{children}</span>;
}

export function Sticker({ children, tone = 'marigold', tilt = -6, className = '' }: { children: ReactNode; tone?: Tone; tilt?: number; className?: string }) {
  return (
    <span className={`sticker tone-${tone} ${className}`} style={{ rotate: `${tilt}deg` }}>
      {children}
    </span>
  );
}

/** Tear-off wall calendar: yesterday's page falls away when the day changes. */
export function DayCalendar({ day, max }: { day: number; max: number }) {
  const left = max - day + 1;
  return (
    <div className={`calendar ${left <= 3 ? 'calendar-late' : ''}`} aria-label={`Day ${day} of ${max}`}>
      <div className="calendar-head">
        <i />
        <span>Day</span>
        <i />
      </div>
      <div className="calendar-pages">
        <AnimatePresence initial={false}>
          <motion.div
            key={day}
            className="calendar-page"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0, zIndex: 1 }}
            exit={{ y: 38, rotate: -24, opacity: 0, zIndex: 2, transition: { duration: 0.55, ease: [0.5, 0, 0.75, 0] } }}
          >
            {day}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="calendar-foot">{left <= 3 ? (left === 1 ? 'last day!' : `${left} left`) : `of ${max}`}</div>
    </div>
  );
}

/**
 * This week's target, pinned beside the calendar like a chit on the stall's nail:
 * the goal, a progress bar, and the rent due when the week closes.
 */
export function GoalChit({
  week,
  icon,
  label,
  title,
  progress,
  target,
  format = String,
  rent,
  daysLeft,
  doneLabel = 'Done',
  money = false,
}: {
  week: number;
  icon: string;
  label: string;
  title: string;
  progress: number;
  target: number;
  format?: (n: number) => string;
  rent: number;
  daysLeft: number;
  /** Stamp text once the target is met ("On track" for a cash target that is only checked at the close). */
  doneLabel?: string;
  /** ₹ targets: on narrow screens only the amount is shown, the bar carries the rest. */
  money?: boolean;
}) {
  const done = progress >= target;
  const pct = Math.max(0, Math.min(100, (progress / target) * 100));
  const due = daysLeft <= 1 ? 'closes today' : `${daysLeft} days`;
  return (
    <div className={`chit ${done ? 'chit-done' : ''} ${daysLeft <= 1 && !done ? 'chit-due' : ''} ${money ? 'chit-money' : ''}`} title={`${title} · rent ₹${rent} when the week closes`} aria-label={`Week ${week} target: ${title}. ${format(progress)} of ${format(target)}. Rent ₹${rent}, ${due}.`}>
      <div className="chit-head">
        <span>Week {week}</span>
        <span>target</span>
      </div>
      <div className="chit-body">
        <Icon name={icon} size={15} />
        <span className="chit-label">{label}</span>
        <b className="chit-count">
          {format(Math.max(0, Math.min(progress, target)))}
          <span className="chit-of">/{format(target)}</span>
        </b>
      </div>
      <div className="chit-bar">
        <motion.i initial={false} animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 120, damping: 18 }} />
      </div>
      <div className="chit-foot">
        <span>rent ₹{rent}</span>
        <span>{due}</span>
      </div>
      <AnimatePresence>
        {done && (
          <motion.span
            className="chit-stamp"
            initial={{ scale: 3, opacity: 0, rotate: -40 }}
            animate={{ scale: 1, opacity: 1, rotate: -14 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 600, damping: 18 }}
          >
            {doneLabel}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

/** After week 4: no target, no rent — just sell what's left. */
export function FinalStretchChit({ daysLeft }: { daysLeft: number }) {
  return (
    <div className="chit chit-final" aria-label={`Final stretch: ${daysLeft} days left, no rent due`}>
      <div className="chit-head">
        <span>Final stretch</span>
      </div>
      <div className="chit-body">
        <Icon name="Flag" size={15} />
        <span className="chit-label">Sell what's left</span>
      </div>
      <div className="chit-foot">
        <span>no rent</span>
        <span>{daysLeft === 1 ? 'last day' : `${daysLeft} days`}</span>
      </div>
    </div>
  );
}

/** A cutting-chai glass that empties as you work. */
export function ChaiMeter({ value }: { value: number }) {
  const clip = useId();
  const level = Math.max(0, Math.min(100, value));
  const top = 4 + 26 * (1 - level / 100);
  return (
    <span className={`chai ${level < 25 ? 'chai-low' : ''}`} aria-hidden>
      {level >= 60 && (
        <span className="steam">
          <i />
          <i />
          <i />
        </span>
      )}
      <svg viewBox="0 0 28 34" width="26" height="32">
        <defs>
          <clipPath id={clip}>
            <path d="M4 4h20l-2.6 26H6.6z" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          <motion.rect x="0" width="28" height="34" fill="var(--chai)" initial={false} animate={{ y: top }} transition={{ type: 'spring', stiffness: 120, damping: 18 }} />
          <motion.rect x="0" width="28" height="2.5" fill="var(--chai-foam)" initial={false} animate={{ y: top }} transition={{ type: 'spring', stiffness: 120, damping: 18 }} />
        </g>
        <path d="M4 4h20l-2.6 26H6.6z" fill="none" stroke="var(--line)" strokeWidth="2.4" strokeLinejoin="round" />
        <path d="M9 9v17M14 9v17M19 9v17" stroke="var(--line)" strokeOpacity="0.18" strokeWidth="1.4" />
      </svg>
    </span>
  );
}

/** Thirty-stop road with a little cart that moves along it. Rent posts mark each week's close. */
export function DayTrack({ day, max, weekEnds = [] }: { day: number; max: number; weekEnds?: number[] }) {
  return (
    <div className="day-track" aria-hidden>
      <div className="day-road">
        {Array.from({ length: max }, (_, i) => (
          <i
            key={i}
            className={`${i < day - 1 ? 'done' : i === day - 1 ? 'now' : i >= max - 3 ? 'late' : ''} ${weekEnds.includes(i + 1) ? 'week' : ''}`}
          />
        ))}
      </div>
      <motion.span
        className="day-cart"
        initial={false}
        animate={{ left: `${((day - 1) / (max - 1)) * 100}%` }}
        transition={{ type: 'spring', stiffness: 90, damping: 16 }}
      >
        <svg viewBox="0 0 24 24" width="22" height="22">
          <path d="M3 4h3l2.2 10.2a1.5 1.5 0 0 0 1.5 1.2h8.1a1.5 1.5 0 0 0 1.4-1.1L21 8H7" fill="var(--marigold)" stroke="var(--line)" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="10" cy="19.5" r="1.8" fill="var(--card)" stroke="var(--line)" strokeWidth="2" />
          <circle cx="17" cy="19.5" r="1.8" fill="var(--card)" stroke="var(--line)" strokeWidth="2" />
        </svg>
      </motion.span>
    </div>
  );
}

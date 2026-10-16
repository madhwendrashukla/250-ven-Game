import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { CHANNEL_ORDER, CHANNELS } from '../game/content';
import { formatRs } from '../game/helpers';
import { PERKS } from '../game/perks';
import { RENT, weekCloseDay } from '../game/weeks';
import { ACTIONS } from './actions';
import { Icon, type Tone } from './icons';
import { Modal } from './Modal';
import { PerkFace } from './PerkCard';

const LOOP: { icon: string; title: string; text: string; tone: Tone }[] = [
  { icon: 'MessagesSquare', title: 'Discover', text: 'Talk to segments and test prices before spending.', tone: 'teal' },
  { icon: 'Package', title: 'Make', text: 'Stock only what you can sell this week.', tone: 'marigold' },
  { icon: 'HandCoins', title: 'Sell', text: 'Pick who, where and how much.', tone: 'rani' },
  { icon: 'Receipt', title: 'Learn', text: 'Read the receipt, adjust, go again.', tone: 'parrot' },
];

const RULES: { icon: string; title: string; text: string; tone: Tone }[] = [
  { icon: 'Coffee', title: 'Energy', text: 'Work empties your chai glass. Under 25 you are exhausted: every move is 35% weaker. A chai break refills 45.', tone: 'marigold' },
  { icon: 'Hourglass', title: 'Saturation', text: "People who just bought don't need another tomorrow. Rotate segments so they recover.", tone: 'rani' },
  { icon: 'MessageCircle', title: 'Group fatigue', text: 'Spam the same WhatsApp groups two days running and everyone mutes you.', tone: 'teal' },
  { icon: 'Trash2', title: 'Spoilage', text: 'Cookies go stale after 3 days. Unsold stock is money in the bin.', tone: 'coral' },
  { icon: 'Sparkles', title: 'Quality', text: 'Upgrades make more of the people you reach buy — but raise unit cost.', tone: 'parrot' },
  { icon: 'Newspaper', title: 'Events', text: 'Exams, monsoon, festivals, copycats, bulk orders, mentors. Read the paper, choose wisely.', tone: 'paper' },
  { icon: 'RefreshCw', title: 'Markets move', text: "Once or twice a run a trend, a price war, a new hostel or a fading fad changes what a segment will pay or how many buy. Your old price notes go stale — re-check before you re-price.", tone: 'chili' },
  { icon: 'CalendarCheck', title: 'Weekly targets', text: 'Each week has a target, pinned by the calendar. Hit it by the week close for cash or fans plus bonus points.', tone: 'teal' },
  { icon: 'Landmark', title: 'Rent day', text: 'Rent is due when each week closes. Short of cash? The landlord collects the rest from tomorrow — and anything still owed comes off your score.', tone: 'marigold' },
];

const RULE_TILT = [-1.5, 1, -0.5, 1.5, -1, 0.5, -1.2, 0.8, -0.6];

const GRADES: { g: string; min: string; tone: Tone }[] = [
  { g: 'S', min: '5,000+', tone: 'marigold' },
  { g: 'A', min: '3,500+', tone: 'parrot' },
  { g: 'B', min: '1,800+', tone: 'teal' },
  { g: 'C', min: '700+', tone: 'rani' },
  { g: 'D', min: '< 700', tone: 'chili' },
];

const TIPS = [
  'Talk to every segment once before you buy stock — the best market changes every run.',
  "Price a little under what a segment values it at today. When the Bazaar Times says a market moved, yesterday's price is a guess — test before you trust it.",
  'Plan each week around its target, and keep the rent in your pocket on closing day.',
  'Draft perks that fit the stall you are running: a wholesale contact is gold for volume, a WhatsApp admin for group sellers.',
  'Rotate segments and channels so markets and WhatsApp groups recover.',
  'Take a chai break before you hit 25 energy.',
  'For perishables, stock about one day of proven demand at a time.',
  'On a keyboard: 1–7 picks a move card, Enter plays it, R repeats your last move.',
];

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <motion.section className="manual-section" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ type: 'spring', stiffness: 220, damping: 24 }}>
      <h3 className="manual-h">
        <span className="manual-n">{n}</span>
        {title}
      </h3>
      {children}
    </motion.section>
  );
}

export function HowToPlayContent() {
  return (
    <div className="manual">
      <div className="manual-goal">
        <span className="coin coin-sm" aria-hidden>
          <Icon name="IndianRupee" size={26} strokeWidth={3} />
        </span>
        <div className="bubble bubble-left">
          Start with <b>₹250</b> and <b>30 days</b>. Find the customers who'll actually pay, build the most profitable little stall you can, then beat your friends in the hall of fame.
        </div>
      </div>

      <Section n={1} title="The loop">
        <div className="loop">
          {LOOP.map((step, i) => (
            <motion.div
              key={step.title}
              className={`loop-step tone-${step.tone}`}
              initial={{ opacity: 0, y: 16, rotate: 4 }}
              whileInView={{ opacity: 1, y: 0, rotate: i % 2 ? 1 : -1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.08 + i * 0.1, type: 'spring', stiffness: 260, damping: 18 }}
            >
              <span className="loop-n">{i + 1}</span>
              <Icon name={step.icon} size={26} />
              <b>{step.title}</b>
              <span>{step.text}</span>
            </motion.div>
          ))}
        </div>
      </Section>

      <Section n={2} title="Your daily moves">
        <p className="manual-p">Every day you play one move card. Colours tell you the family: teal discovers, marigold makes, pink sells, ink recharges.</p>
        <div className="manual-moves">
          {ACTIONS.map((a) => (
            <div key={a.id} className={`manual-move tone-${a.tone}`}>
              <span className="move-icon">
                <Icon name={a.icon} size={22} />
              </span>
              <div>
                <b>{a.title}</b>
                <span className="manual-cost">{a.cost}</span>
                <p>{a.help}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section n={3} title="Where to sell">
        <div className="manual-channels">
          {CHANNEL_ORDER.map((id) => {
            const ch = CHANNELS[id];
            return (
              <div key={id} className="manual-channel">
                <span className="channel-icon">
                  <Icon name={ch.icon} size={18} />
                </span>
                <div>
                  <b>{ch.name}</b> <span className="manual-cost">{ch.cost ? formatRs(ch.cost) : 'Free'}</span>
                  <p>{ch.blurb}</p>
                </div>
              </div>
            );
          })}
        </div>
        <p className="manual-p">Each segment has a favourite channel. Interviews can reveal it.</p>
      </Section>

      <Section n={4} title="Rules of the bazaar">
        <div className="notes">
          {RULES.map((r, i) => (
            <div key={r.title} className={`note tone-${r.tone}`} style={{ rotate: `${RULE_TILT[i % RULE_TILT.length]}deg` }}>
              <span className="note-tape" />
              <Icon name={r.icon} size={22} />
              <b>{r.title}</b>
              <p>{r.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section n={5} title="Weeks, rent & perks">
        <p className="manual-p">
          The month runs in four weeks. Each closes at the end of day {weekCloseDay(1)}, {weekCloseDay(2)}, {weekCloseDay(3)} and {weekCloseDay(4)}: the paper settles your target, the landlord takes rent, and you draft a perk. Days 29–30 are a free final stretch.
        </p>
        <div className="rent-row">
          {RENT.map((rent, i) => (
            <div key={i} className="rent-week">
              <span>Week {i + 1}</span>
              <b>{formatRs(rent)}</b>
              <small>rent · day {weekCloseDay(i + 1)}</small>
            </div>
          ))}
        </div>
        <p className="manual-p">
          <b>Perk draft:</b> at every week close you are dealt three contacts and keep one for the rest of the run. Here is the whole deck:
        </p>
        <div className="perk-deck">
          {PERKS.map((perk) => (
            <div key={perk.id} className={`perk-card perk-mini tone-${perk.tone}`}>
              <PerkFace perk={perk} />
            </div>
          ))}
        </div>
      </Section>

      <Section n={6} title="Scoring">
        <p className="manual-p">
          <b>Score</b> = profit (after rent) + 3 per customer + 15 per experiment (max 12) + half your fans + 20 per quality star + weekly target points (100 / 150 / 200 / 250).
        </p>
        <div className="grade-row">
          {GRADES.map((g) => (
            <span key={g.g} className="grade-chip">
              <span className={`mini-stamp tone-${g.tone}`}>{g.g}</span>
              {g.min}
            </span>
          ))}
        </div>
        <p className="manual-p">At the end you get a founder card and a debrief that reveals what each segment would really have paid.</p>
      </Section>

      <Section n={7} title="Hall of fame">
        <ul className="checklist">
          <li>
            <Icon name="CalendarDays" size={18} />
            <span>
              <b>Daily challenge</b> — everyone gets the same idea and the same hidden market for the day. The fairest race.
            </span>
          </li>
          <li>
            <Icon name="Award" size={18} />
            <span>
              <b>All-time</b> — your best score from any run, filterable by idea.
            </span>
          </li>
          <li>
            <Icon name="ShieldCheck" size={18} />
            <span>
              <b>No fake scores</b> — the server replays every move and perk pick you made and calculates the score itself.
            </span>
          </li>
        </ul>
      </Section>

      <Section n={8} title="Founder tips">
        <ul className="checklist">
          {TIPS.map((t) => (
            <li key={t}>
              <Icon name="CheckCircle2" size={18} />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

export function HowToPlayScreen({ onBack, onStart, onDaily }: { onBack: () => void; onStart: () => void; onDaily: () => void }) {
  return (
    <div className="page manual-page">
      <header className="page-header">
        <button className="btn btn-sm tone-paper" onClick={onBack}>
          <Icon name="ChevronLeft" /> Back
        </button>
        <h2 className="page-title">How to play</h2>
      </header>
      <HowToPlayContent />
      <div className="end-actions">
        <button className="btn btn-lg tone-marigold" onClick={onStart}>
          <Icon name="Rocket" /> Open a stall
        </button>
        <button className="btn btn-lg tone-teal" onClick={onDaily}>
          <Icon name="CalendarDays" /> Daily challenge
        </button>
      </div>
    </div>
  );
}

export function HowToPlayModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="How to play" onClose={onClose} className="modal-wide">
      <h2 className="page-title modal-heading">How to play</h2>
      <HowToPlayContent />
      <button className="btn btn-lg btn-block tone-marigold" onClick={onClose}>
        Back to the stall
      </button>
    </Modal>
  );
}

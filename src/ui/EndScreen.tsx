import confetti from 'canvas-confetti';
import { motion, type Variants } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { sfx } from '../audio/sfx';
import { getIdea, IDEAS } from '../game/content';
import { formatRs } from '../game/helpers';
import { PERKS_BY_ID } from '../game/perks';
import { buildReport } from '../game/score';
import { goalText } from '../game/weeks';
import type { GameState } from '../game/types';
import type { RunRecord } from '../storage';
import { AnimatedNumber } from './AnimatedNumber';
import { Bunting } from './bits';
import { Icon, IconBadge, IDEA_TONE, SEGMENT_TONE, type Tone } from './icons';
import { SubmitScore } from './SubmitScore';

interface Props {
  game: GameState;
  history: RunRecord[];
  onReplay: () => void;
  onNewIdea: () => void;
  onHome: () => void;
  onLeaderboard: () => void;
}

const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 1.1 } } };
const rise: Variants = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 22 } } };

const NOTE_TONE: Record<string, Tone> = { good: 'parrot', bad: 'rani', neutral: 'marigold' };
const STAMP_TONE: Record<string, Tone> = { S: 'marigold', A: 'parrot', B: 'teal', C: 'rani', D: 'chili' };

export function EndScreen({ game, history, onReplay, onNewIdea, onHome, onLeaderboard }: Props) {
  const idea = getIdea(game.ideaId);
  const report = useMemo(() => buildReport(game), [game]);
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const roiPct = Math.round(report.roi * 100);
  const winning = report.profit > 0;
  const holo = report.grade === 'S' || report.grade === 'A';

  useEffect(() => {
    if (winning) sfx.fanfare(0.2);
    else sfx.sadTrombone(0.2);
    const stamp = window.setTimeout(() => sfx.stamp(), 900);
    let burst: number | undefined;
    if (winning) {
      burst = window.setTimeout(() => {
        const opts = { disableForReducedMotion: true, colors: ['#FFB000', '#FF3D7F', '#00B3A4', '#7BD148', '#FFF3DC'], shapes: ['square' as const, 'circle' as const] };
        confetti({ ...opts, particleCount: holo ? 170 : 90, spread: 90, origin: { y: 0.35 } });
        if (holo) {
          confetti({ ...opts, particleCount: 70, angle: 60, spread: 70, origin: { x: 0, y: 0.7 } });
          confetti({ ...opts, particleCount: 70, angle: 120, spread: 70, origin: { x: 1, y: 0.7 } });
        }
      }, 950);
    }
    return () => {
      window.clearTimeout(stamp);
      window.clearTimeout(burst);
    };
  }, [winning, holo]);

  const shareText = [
    `₹250 Venture — ${idea.name}${game.dailyLabel ? ` (Daily ${game.dailyLabel})` : ''}`,
    `Turned ₹250 into ${formatRs(report.finalCash)} in ${game.day} days (${roiPct >= 0 ? '+' : ''}${roiPct}%)`,
    `${report.archetype.title} · Grade ${report.grade} · ${report.score} pts`,
    `${game.stats.sold} customers · ${report.insights} experiments · ${report.weeksHit}/${game.goals.length} weekly targets`,
  ].join('\n');

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText });
        return;
      }
    } catch {
      // User cancelled or share failed; fall through to clipboard.
    }
    try {
      await navigator.clipboard.writeText(shareText);
      setShareState('copied');
    } catch {
      setShareState('manual');
    }
  }

  const top = [...history].sort((a, b) => b.score - a.score).slice(0, 5);

  return (
    <div className="page report">
      <Bunting />
      <header className="report-head">
        <span className="kicker">
          Day {game.day} · shutters down
        </span>
        <h1 className="page-title">Venture report</h1>
      </header>

      <div className="report-top">
        <motion.div
          className="card-stage"
          initial={{ rotateY: 180, scale: 0.6, opacity: 0 }}
          animate={{ rotateY: 0, scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 120, damping: 14, delay: 0.15 }}
        >
          <div className={`trading-card tone-${winning ? IDEA_TONE[idea.id] : 'paper'} ${holo ? 'holo' : ''}`}>
            <div className="tc-top">
              <span>{idea.name}</span>
              <span>#{String(game.seed % 10000).padStart(4, '0')}</span>
            </div>
            <div className="tc-art">
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.6, type: 'spring', stiffness: 300, damping: 10 }}>
                <Icon name={report.archetype.icon} size={64} strokeWidth={2} />
              </motion.span>
            </div>
            <div className="tc-label">You are</div>
            <div className="tc-name">{report.archetype.title}</div>
            <p className="tc-text">{report.archetype.text}</p>
            <div className="tc-foot">
              <span>
                <Icon name="Users" size={13} /> {game.stats.sold}
              </span>
              <span>
                <Icon name="FlaskConical" size={13} /> {report.insights}
              </span>
              <span>
                <Icon name="Star" size={13} /> {report.score}
              </span>
            </div>
          </div>
          <motion.div
            className={`grade-stamp tone-${STAMP_TONE[report.grade]}`}
            initial={{ scale: 4, opacity: 0, rotate: -40 }}
            animate={{ scale: 1, opacity: 1, rotate: -14 }}
            transition={{ delay: 0.9, type: 'spring', stiffness: 600, damping: 18 }}
          >
            <span>Grade</span>
            <b>{report.grade}</b>
          </motion.div>
        </motion.div>

        <motion.section className="report-stats" variants={stagger} initial="hidden" animate="show">
          <Big icon="Coins" tone="marigold" label="Final cash" value={report.finalCash} format={formatRs} />
          <Big
            icon={report.profit >= 0 ? 'TrendingUp' : 'TrendingDown'}
            tone={report.profit >= 0 ? 'parrot' : 'chili'}
            label="Profit"
            value={report.profit}
            format={formatRs}
            sub={`${roiPct >= 0 ? '+' : ''}${roiPct}% ROI`}
          />
          <Big icon="Users" tone="teal" label="Customers" value={game.stats.sold} />
          <Big icon="FlaskConical" tone="teal" label="Experiments" value={report.insights} />
          <Big icon="Smartphone" tone="rani" label="Fans" value={game.followers} />
          <Big icon="Star" tone="marigold" label="Score" value={report.score} big />
        </motion.section>
      </div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="report-stack">
        <motion.div variants={rise}>
          <SubmitScore game={game} onOpenLeaderboard={onLeaderboard} />
        </motion.div>

        <motion.section variants={rise} className="card truth">
          <div className="card-head">
            <h3 className="card-title">What they'd really have paid</h3>
            <span className="card-kicker">the hidden market, revealed</span>
          </div>
          <div className="truth-list">
            {report.segments.map((seg, i) => {
              const scale = Math.max(seg.estimate[1], seg.trueWtp, seg.avgPrice ?? 0) * 1.25;
              const pct = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;
              return (
                <div key={seg.name} className={`truth-row tone-${SEGMENT_TONE[i]} ${seg.best ? 'is-best' : ''}`}>
                  <div className="truth-who">
                    <span className="avatar avatar-sm">
                      <Icon name={seg.icon} size={16} />
                    </span>
                    <b>{seg.name}</b>
                    {seg.best && <span className="tag tag-good">best market</span>}
                    <span className="truth-sold">
                      {seg.sold} sold{seg.avgPrice !== null ? ` · avg ${formatRs(seg.avgPrice)}` : ''}
                      {seg.startWtp !== seg.trueWtp && (
                        <>
                          {' · '}value ₹{seg.trueWtp}
                          <s className="was">₹{seg.startWtp}</s>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="ruler ruler-tall">
                    <div className="ruler-band" style={{ left: pct(seg.estimate[0]), width: `calc(${pct(seg.estimate[1])} - ${pct(seg.estimate[0])})` }} />
                    <motion.span className="truth-pin" style={{ left: pct(seg.trueWtp) }} initial={{ y: -30, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ type: 'spring', stiffness: 400, damping: 12, delay: 0.2 + i * 0.12 }}>
                      <span>₹{seg.trueWtp}</span>
                    </motion.span>
                    {seg.avgPrice !== null && <span className="avg-pin" style={{ left: pct(seg.avgPrice) }} title={`Your average price ₹${Math.round(seg.avgPrice)}`} />}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="truth-legend">
            <span>
              <i className="lg-band" /> your estimate
            </span>
            <span>
              <i className="lg-truth" /> true value
            </span>
            <span>
              <i className="lg-avg" /> your avg price
            </span>
          </div>
        </motion.section>

        {game.weeks.length > 0 && (
          <motion.section variants={rise} className="card">
            <div className="card-head">
              <h3 className="card-title">Week by week</h3>
              <span className="card-kicker">
                {report.weeksHit}/{game.weeks.length} targets · +{report.goalPoints} pts · {formatRs(game.stats.rentPaid)} rent
              </span>
            </div>
            <ol className="week-list">
              {game.weeks.map((w, i) => {
                const perk = PERKS_BY_ID[game.perks[i]];
                return (
                  <li key={w.week} className="week-item">
                    <span className="week-no">W{w.week}</span>
                    <span className="week-goal">
                      <b>{goalText(game.goals[w.week - 1])}</b>
                      <small>
                        {w.progress}/{w.target} · rent {formatRs(w.rentPaid)}
                        {w.rentPaid < w.rent ? ` of ${formatRs(w.rent)}` : ''}
                      </small>
                    </span>
                    <span className={`week-verdict ${w.hit ? 'is-hit' : 'is-miss'}`}>{w.hit ? `+${w.points}` : 'Missed'}</span>
                    {perk && (
                      <span className={`chip chip-perk tone-${perk.tone}`} title={perk.effect}>
                        <Icon name={perk.icon} size={14} /> {perk.name}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </motion.section>
        )}

        <motion.section variants={rise} className="notes-wrap">
          <h3 className="section-title">Debrief</h3>
          <div className="notes">
            {report.lessons.map((l, i) => (
              <motion.div
                key={l.title}
                className={`note tone-${NOTE_TONE[l.tone]}`}
                style={{ rotate: `${[-2, 1.5, -1, 2, -1.5][i % 5]}deg` }}
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, type: 'spring', stiffness: 260, damping: 18 }}
              >
                <span className="note-tape" />
                <Icon name={l.icon} size={22} />
                <b>{l.title}</b>
                <p>{l.text}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        <motion.div variants={rise} className="end-actions">
          <button className="btn btn-lg tone-marigold" onClick={share}>
            <Icon name={shareState === 'copied' ? 'CheckCircle2' : 'Share2'} />
            {shareState === 'copied' ? 'Copied!' : 'Share result'}
          </button>
          <button className="btn btn-lg tone-teal" onClick={onReplay}>
            <Icon name="RotateCcw" /> {game.dailyLabel ? 'Retry daily' : 'Play again'}
          </button>
          <button className="btn btn-lg tone-rani" onClick={onNewIdea}>
            <Icon name="Lightbulb" /> New idea
          </button>
          <button className="btn btn-lg tone-paper" onClick={onHome}>
            <Icon name="Home" /> Home
          </button>
        </motion.div>
        {shareState === 'manual' && <textarea className="share-text" readOnly value={shareText} rows={4} />}

        {top.length > 0 && (
          <motion.section variants={rise} className="card">
            <div className="card-head">
              <h3 className="card-title">Your best runs</h3>
              <span className="card-kicker">on this device</span>
            </div>
            <ol className="history">
              {top.map((r, i) => (
                <li key={r.id}>
                  <span className="history-rank">{i + 1}</span>
                  <IconBadge name={IDEAS.find((x) => x.id === r.ideaId)?.icon ?? 'Rocket'} tone={IDEA_TONE[r.ideaId]} size="sm" />
                  <span className="history-name">{r.archetype}</span>
                  <span className="history-meta">{r.dailyLabel ? `Daily ${r.dailyLabel}` : new Date(r.playedAt).toLocaleDateString()}</span>
                  <span className="history-score">{r.score}</span>
                </li>
              ))}
            </ol>
          </motion.section>
        )}
      </motion.div>
    </div>
  );
}

function Big({
  icon,
  tone,
  label,
  value,
  format,
  sub,
  big = false,
}: {
  icon: string;
  tone: Tone;
  label: string;
  value: number;
  format?: (n: number) => string;
  sub?: string;
  big?: boolean;
}) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setShown(value), 1200);
    return () => window.clearTimeout(t);
  }, [value]);
  return (
    <motion.div variants={rise} className={`big-stat ${big ? 'big-stat-hero' : ''}`}>
      <span className={`big-icon tone-${tone}`}>
        <Icon name={icon} size={18} />
      </span>
      <span className="big-label">{label}</span>
      <span className="big-value">
        <AnimatedNumber value={shown} format={format} duration={1.3} />
      </span>
      {sub && <span className="big-sub">{sub}</span>}
    </motion.div>
  );
}

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CHANNEL_ORDER, CHANNELS, getIdea } from '../game/content';
import { actionCost, bulkTiers, canAct, channelCost, improveCost, maxAffordableQty, priceTestSample, restockPrice } from '../game/engine';
import { formatRs, inventoryCount, MAX_QUALITY, round5 } from '../game/helpers';
import type { ChannelId, GameAction, GameState } from '../game/types';
import { ACTIONS, type Tab } from './actions';
import type { MovePreview } from './Hud';
import { Icon, SEGMENT_TONE } from './icons';

interface Props {
  game: GameState;
  onAct: (a: GameAction) => void;
  onPreview: (p: MovePreview | null) => void;
}

const SPRING = { type: 'spring' as const, stiffness: 420, damping: 24 };

const CHANNEL_SHORT: Record<ChannelId, string> = { friends: 'friends', whatsapp: 'WhatsApp', instagram: 'Insta', stall: 'stall', ads: 'ad' };

/** Shortcuts stay out of the way while you type a price or quantity. Sliders and toggles don't count as typing. */
function isTyping(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  return el instanceof HTMLInputElement && !['range', 'checkbox', 'radio', 'button', 'submit'].includes(el.type);
}

/** The player's most recent move (ignoring "wrap up"), for the repeat button. */
function lastMove(game: GameState): GameAction | null {
  for (let i = game.history.length - 1; i >= 0; i--) {
    const step = game.history[i];
    if (step.t === 'act' && step.a.type !== 'endEarly') return step.a;
  }
  return null;
}

export function ActionPanel({ game, onAct, onPreview }: Props) {
  const idea = getIdea(game.ideaId);
  const firstMove = game.stats.interviews === 0 && game.stats.sold === 0;
  const [tab, setTab] = useState<Tab>(firstMove ? 'interview' : 'sell');
  const [segment, setSegment] = useState(game.mentorHint ?? 0);
  const [channel, setChannel] = useState<ChannelId>('friends');
  const [prices, setPrices] = useState<Record<number, number>>({});
  const [qty, setQty] = useState(10);

  const k = game.knowledge[segment];
  const price = prices[segment] ?? round5(((k.lo + k.hi) / 2) * 0.8);
  const setPrice = (p: number) => setPrices({ ...prices, [segment]: Math.max(1, Math.round(p) || 1) });
  const stock = inventoryCount(game);
  const maxQty = maxAffordableQty(game);
  const restockQty = Math.min(qty, Math.max(1, maxQty));
  const info = ACTIONS.find((a) => a.id === tab)!;

  let action: GameAction;
  switch (tab) {
    case 'interview':
      action = { type: 'interview', segment };
      break;
    case 'priceTest':
      action = { type: 'priceTest', segment, price };
      break;
    case 'restock':
      action = { type: 'restock', qty: restockQty };
      break;
    case 'sell':
      action = { type: 'sell', segment, channel, price };
      break;
    default:
      action = { type: tab };
  }
  const cost = actionCost(game, action);
  const check = canAct(game, action);

  const last = useMemo(() => lastMove(game), [game]);
  const lastCheck = last ? canAct(game, last) : null;
  const segName = (i: number) => idea.segments[i].name.replace(/\s*\(.*\)/, '');
  function describe(a: GameAction): string {
    switch (a.type) {
      case 'interview':
        return `Talk to ${segName(a.segment).toLowerCase()}`;
      case 'priceTest':
        return `Test ₹${a.price} · ${segName(a.segment).toLowerCase()}`;
      case 'restock':
        return `${idea.restockVerb} ${a.qty}`;
      case 'sell':
        return `Sell ₹${a.price} · ${segName(a.segment).toLowerCase()} · ${CHANNEL_SHORT[a.channel]}`;
      case 'post':
        return 'Post content';
      case 'improve':
        return 'Improve';
      default:
        return 'Chai break';
    }
  }

  /** Plays the last move again and leaves the slip set to it, so Enter repeats it too. */
  function repeat() {
    if (!last || !lastCheck?.ok) return;
    if (last.type !== 'endEarly') setTab(last.type);
    if ('segment' in last) setSegment(last.segment);
    if (last.type === 'sell') setChannel(last.channel);
    if (last.type === 'sell' || last.type === 'priceTest') setPrices((p) => ({ ...p, [last.segment]: last.price }));
    if (last.type === 'restock') setQty(last.qty);
    onAct(last);
  }

  // Keyboard: 1–7 pick a move card, Enter plays it, R repeats the last move.
  const onKey = useRef<(e: KeyboardEvent) => void>(() => {});
  onKey.current = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    if (game.pendingEvent || game.perkOffer || document.querySelector('[aria-modal="true"]')) return;
    if (isTyping(e.target)) return;
    if (/^[1-9]$/.test(e.key) && Number(e.key) <= ACTIONS.length) {
      e.preventDefault();
      setTab(ACTIONS[Number(e.key) - 1].id);
    } else if (e.key === 'Enter') {
      // Inside the move panel Enter always plays the slip (Space still presses a focused chip);
      // a focused button elsewhere (the HUD, the ledger) keeps its own Enter.
      const btn = e.target instanceof Element ? e.target.closest('button, a, [role="button"]') : null;
      if (btn && !btn.closest('.moves')) return;
      e.preventDefault();
      if (!e.repeat && check.ok) onAct(action);
    } else if ((e.key === 'r' || e.key === 'R') && !e.repeat) {
      e.preventDefault();
      repeat();
    }
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey.current(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Tell the HUD what this move would change (Reigns-style preview).
  const previewKey = `${cost.cash}|${cost.energy}|${cost.days}|${tab === 'restock' ? restockQty : 0}|${check.ok}`;
  useEffect(() => {
    onPreview(check.ok ? { cash: cost.cash, energy: cost.energy, days: cost.days, stock: tab === 'restock' ? restockQty : 0 } : null);
  }, [previewKey]);
  useEffect(() => () => onPreview(null), [onPreview]);

  const verb: Record<Tab, string> = {
    interview: `Talk to ${idea.segments[segment].name}`,
    priceTest: `Test ₹${price} on ${priceTestSample(game)} people`,
    restock: `${idea.restockVerb} ${restockQty} ${idea.unitName}s`,
    sell: stock > 0 ? `Sell at ₹${price}` : 'Sell anyway (no stock)',
    post: 'Post on Instagram',
    improve: game.quality >= MAX_QUALITY ? 'Quality maxed' : `Upgrade · ${formatRs(improveCost(game))}`,
    rest: 'Put the kettle on',
  };

  const needsSegment = tab === 'interview' || tab === 'priceTest' || tab === 'sell';
  const needsPrice = tab === 'priceTest' || tab === 'sell';
  const sliderMax = Math.round(idea.segments[segment].wtp * 2);
  const margin = price - game.unitCost;
  const tiers = bulkTiers(game);
  const qtyChips = [...new Set([5, 10, ...tiers.map((t) => t.min), 50])].sort((a, b) => a - b);

  return (
    <section className="moves">
      <div className="moves-bar">
        <span className="keys-hint" aria-hidden>
          <kbd className="kbd">1</kbd>–<kbd className="kbd">{ACTIONS.length}</kbd> pick
          <i />
          <kbd className="kbd">Enter</kbd> play
          <i />
          <kbd className="kbd">R</kbd> repeat
        </span>
        <motion.button
          key={game.history.length}
          className="repeat-btn"
          onClick={repeat}
          disabled={!lastCheck?.ok}
          data-sfx="off"
          title={last && lastCheck && !lastCheck.ok ? lastCheck.reason : 'Play your last move again (R)'}
          initial={{ scale: 0.92 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 18 }}
        >
          <span className="repeat-icon">
            <Icon name="Repeat" size={16} />
          </span>
          <span className="repeat-text">
            <b>Same again</b>
            <small>{last ? (lastCheck?.ok ? describe(last) : lastCheck?.reason) : 'no move yet'}</small>
          </span>
        </motion.button>
      </div>
      <div className="hand" role="tablist" aria-label="Today's move">
        {ACTIONS.map((a, i) => {
          const active = tab === a.id;
          return (
            <motion.button
              key={a.id}
              role="tab"
              aria-selected={active}
              aria-label={a.title}
              className={`move-card tone-${a.tone} ${active ? 'is-active' : ''}`}
              onClick={() => setTab(a.id)}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: active ? -10 : 0, rotate: active ? (i % 2 ? 2 : -2) : 0 }}
              whileHover={{ y: active ? -12 : -5 }}
              transition={{ ...SPRING, opacity: { delay: i * 0.04 } }}
            >
              <kbd className="move-key" aria-hidden>
                {i + 1}
              </kbd>
              <span className="move-icon">
                <Icon name={a.icon} size={24} />
              </span>
              <span className="move-name">{a.id === 'restock' ? idea.restockVerb : a.label}</span>
              <span className="move-tag">{a.tag}</span>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          className={`slip tone-${info.tone}`}
          initial={{ opacity: 0, y: -14, rotate: -0.6 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.18 }}
        >
          <div className="slip-head">
            <span className="slip-group">{info.group}</span>
            <h3 className="slip-title">{info.title}</h3>
            <p className="slip-help">{info.help}</p>
          </div>

          <div className="slip-body">
            {needsSegment && (
              <fieldset className="field">
                <legend>Who?</legend>
                <div className="who">
                  {idea.segments.map((seg, i) => (
                    <button key={seg.id} className={`who-chip tone-${SEGMENT_TONE[i]} ${segment === i ? 'is-on' : ''}`} aria-pressed={segment === i} onClick={() => setSegment(i)}>
                      <span className="who-avatar">
                        <Icon name={seg.icon} size={18} />
                      </span>
                      <span className="who-text">
                        <b>{seg.name}</b>
                        <small>
                          pays ~₹{game.knowledge[i].lo}–₹{game.knowledge[i].hi}
                        </small>
                      </span>
                      {game.mentorHint === i && (
                        <span className="who-flag" title="Mentor's pick">
                          <Icon name="Lightbulb" size={13} />
                        </span>
                      )}
                      {game.knowledge[i].stale && (
                        <span className="who-flag who-flag-moved" title="The market moved — talk or test to re-check">
                          <Icon name="RefreshCw" size={12} />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {tab === 'sell' && (
              <fieldset className="field">
                <legend>Where?</legend>
                <div className="channels">
                  {CHANNEL_ORDER.map((id) => {
                    const ch = CHANNELS[id];
                    const chCost = channelCost(game, id);
                    const fav = k.bestChannel === id;
                    return (
                      <button
                        key={id}
                        className={`channel ${channel === id ? 'is-on' : ''}`}
                        aria-pressed={channel === id}
                        disabled={chCost.cash > game.cash}
                        onClick={() => setChannel(id)}
                      >
                        {fav && <span className="channel-fav">Their fave</span>}
                        <span className="channel-icon">
                          <Icon name={ch.icon} size={18} />
                        </span>
                        <span className="channel-name">{ch.name}</span>
                        <span className="channel-meta">
                          <b className={chCost.cash < ch.cost ? 'text-good' : ''}>{chCost.cash ? formatRs(chCost.cash) : 'Free'}</b>
                          <span className={chCost.energy < ch.energy ? 'text-good' : ''}>
                            <Icon name="Zap" size={12} />
                            {chCost.energy}
                          </span>
                        </span>
                        {id === 'whatsapp' && game.whatsappFatigue < 0.99 && <span className="channel-warn">groups {Math.round((1 - game.whatsappFatigue) * 100)}% tired</span>}
                        {(id === 'instagram' || id === 'ads') && <span className="channel-sub">{game.followers} fans</span>}
                      </button>
                    );
                  })}
                </div>
                <p className="field-note">{CHANNELS[channel].blurb}</p>
              </fieldset>
            )}

            {needsPrice && (
              <div className="field">
                <span className="field-legend">Price per {idea.unitName}</span>
                <div className="dial">
                  <button className="dial-btn" onClick={() => setPrice(price - 5)} aria-label="Lower price by 5">
                    <Icon name="Minus" />
                  </button>
                  <label className="dial-value">
                    <span>₹</span>
                    <input type="number" inputMode="numeric" min={1} value={price} onChange={(e) => setPrice(Number(e.target.value))} aria-label="Price" />
                  </label>
                  <button className="dial-btn" onClick={() => setPrice(price + 5)} aria-label="Raise price by 5">
                    <Icon name="Plus" />
                  </button>
                </div>
                <input className="slider" type="range" min={1} max={sliderMax} value={Math.min(price, sliderMax)} onChange={(e) => setPrice(Number(e.target.value))} aria-label="Price slider" />
                <div className="dial-notes">
                  <span className={k.stale ? 'text-warn' : ''}>
                    {k.stale ? 'Market moved: ' : "They'd pay "}~₹{k.lo}–₹{k.hi}
                    {k.stale ? '?' : ''}
                  </span>
                  <span className={margin < 0 ? 'text-bad' : 'text-good'}>
                    {margin < 0 ? 'Loss' : 'Margin'} {formatRs(margin)} / {idea.unitName}
                  </span>
                </div>
              </div>
            )}

            {tab === 'restock' && (
              <div className="field">
                <span className="field-legend">How many {idea.unitName}s?</span>
                <div className="dial">
                  <button className="dial-btn" onClick={() => setQty(Math.max(1, restockQty - 5))} aria-label="Five fewer">
                    <Icon name="Minus" />
                  </button>
                  <label className="dial-value">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={Math.max(1, maxQty)}
                      value={restockQty}
                      onChange={(e) => setQty(Math.max(1, Math.round(Number(e.target.value)) || 1))}
                      aria-label="Quantity"
                    />
                  </label>
                  <button className="dial-btn" onClick={() => setQty(Math.min(maxQty, restockQty + 5))} aria-label="Five more" disabled={restockQty >= maxQty}>
                    <Icon name="Plus" />
                  </button>
                </div>
                <div className="qty-chips">
                  {qtyChips.map((n) => {
                    const off = tiers.find((t) => n >= t.min)?.off;
                    return (
                      <button key={n} className={`chip-btn ${restockQty === n ? 'is-on' : ''}`} disabled={n > maxQty} onClick={() => setQty(n)}>
                        {n}
                        {off && <small>−{Math.round(off * 100)}%</small>}
                      </button>
                    );
                  })}
                  <button className={`chip-btn ${restockQty === maxQty ? 'is-on' : ''}`} disabled={maxQty < 1} onClick={() => setQty(maxQty)}>
                    Max {maxQty}
                  </button>
                </div>
                <div className="dial-notes">
                  <span>
                    {formatRs(game.unitCost)} each · in stock {stock}
                  </span>
                  <span>Total {formatRs(restockPrice(game, restockQty))}</span>
                </div>
              </div>
            )}

            {tab === 'improve' && game.quality < MAX_QUALITY && (
              <p className="field-note">
                {idea.improveName}. Costs {formatRs(improveCost(game))}. About 20% more of the people you reach will buy; unit cost rises 8%.
              </p>
            )}
          </div>

          <div className="slip-foot">
            <motion.button
              className={`btn btn-go tone-${info.tone} do-btn`}
              disabled={!check.ok}
              onClick={() => onAct(action)}
              data-sfx="off"
              whileHover={check.ok ? { scale: 1.015 } : undefined}
            >
              <Icon name={check.ok ? info.icon : 'AlertTriangle'} size={22} />
              <span>{check.ok ? verb[tab] : check.reason}</span>
              {check.ok && (
                <motion.span className="btn-go-arrow" animate={{ x: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.4 }}>
                  <Icon name="ArrowRight" size={20} />
                </motion.span>
              )}
            </motion.button>
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

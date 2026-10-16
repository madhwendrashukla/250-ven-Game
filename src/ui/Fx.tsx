import { AnimatePresence, motion } from 'framer-motion';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icons';

interface Particle {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  lift: number;
  delay: number;
}

interface FloatText {
  id: number;
  x: number;
  y: number;
  text: string;
  tone: 'good' | 'bad';
}

interface FxApi {
  /** Flies `count` coins from one element to another (e.g. Sell button → cash counter). */
  coins: (from: Element | null, to: Element | null, count: number) => void;
  /** Floats a short label up from an element. */
  float: (from: Element | null, text: string, tone?: 'good' | 'bad') => void;
}

const FxContext = createContext<FxApi>({ coins: () => {}, float: () => {} });

export const useFx = () => useContext(FxContext);

function center(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function FxProvider({ children }: { children: ReactNode }) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [texts, setTexts] = useState<FloatText[]>([]);
  const nextId = useRef(1);

  const coins = useCallback((from: Element | null, to: Element | null, count: number) => {
    if (!from || !to || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const a = center(from);
    const b = center(to);
    const n = Math.max(1, Math.min(14, count));
    const batch: Particle[] = Array.from({ length: n }, (_, i) => ({
      id: nextId.current++,
      x: a.x + (Math.random() - 0.5) * 60,
      y: a.y + (Math.random() - 0.5) * 16,
      dx: b.x - a.x,
      dy: b.y - a.y,
      lift: 60 + Math.random() * 90,
      delay: i * 0.045,
    }));
    setParticles((p) => [...p, ...batch]);
    window.setTimeout(() => setParticles((p) => p.filter((x) => !batch.includes(x))), 1400 + n * 45);
  }, []);

  const float = useCallback((from: Element | null, text: string, tone: 'good' | 'bad' = 'good') => {
    if (!from) return;
    const a = center(from);
    const item = { id: nextId.current++, x: a.x, y: a.y - 20, text, tone };
    setTexts((t) => [...t, item]);
    window.setTimeout(() => setTexts((t) => t.filter((x) => x !== item)), 1500);
  }, []);

  return (
    <FxContext.Provider value={{ coins, float }}>
      {children}
      {createPortal(
        <div className="fx-layer" aria-hidden>
          <AnimatePresence>
            {particles.map((p) => (
              <motion.div
                key={p.id}
                className="fx-coin"
                style={{ left: p.x, top: p.y }}
                initial={{ x: 0, y: 0, scale: 0.4, opacity: 0, rotate: 0 }}
                animate={{
                  x: [0, p.dx * 0.35, p.dx],
                  y: [0, -p.lift, p.dy],
                  scale: [0.4, 1.15, 0.55],
                  opacity: [0, 1, 1, 0.2],
                  rotate: [0, 180, 360],
                }}
                transition={{ duration: 0.95, delay: p.delay, ease: 'easeInOut', times: [0, 0.45, 1] }}
              >
                <Icon name="IndianRupee" size={14} strokeWidth={3} />
              </motion.div>
            ))}
            {texts.map((t) => (
              <motion.div
                key={t.id}
                className={`fx-float fx-float-${t.tone}`}
                style={{ left: t.x, top: t.y }}
                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                animate={{ opacity: [0, 1, 1, 0], y: -50, scale: 1 }}
                transition={{ duration: 1.4, ease: 'easeOut', times: [0, 0.15, 0.7, 1] }}
              >
                {t.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </FxContext.Provider>
  );
}

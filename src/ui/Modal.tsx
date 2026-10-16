import { motion } from 'framer-motion';
import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './icons';

interface Props {
  title: string;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
  /** "news" spins in like a newspaper in an old film. */
  variant?: 'pop' | 'news';
}

const VARIANTS = {
  pop: {
    initial: { opacity: 0, scale: 0.9, y: 24 },
    animate: { opacity: 1, scale: 1, y: 0, rotate: 0 },
    exit: { opacity: 0, scale: 0.95, y: 12 },
    transition: { type: 'spring' as const, stiffness: 380, damping: 28 },
  },
  news: {
    initial: { opacity: 0, scale: 0.1, rotate: -540 },
    animate: { opacity: 1, scale: 1, rotate: -1.5 },
    exit: { opacity: 0, scale: 0.8, rotate: 8, y: 40 },
    transition: { type: 'spring' as const, stiffness: 140, damping: 16, mass: 0.9 },
  },
};

/** Render inside <AnimatePresence> so it can animate out. */
export function Modal({ title, onClose, children, className, variant = 'pop' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const v = VARIANTS[variant];

  useEffect(() => {
    ref.current?.focus();
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div className="modal-backdrop" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <motion.div
        ref={ref}
        className={`modal ${className ?? ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        initial={v.initial}
        animate={v.animate}
        exit={v.exit}
        transition={v.transition}
      >
        {onClose && (
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <Icon name="X" size={18} />
          </button>
        )}
        {children}
      </motion.div>
    </motion.div>
  );
}

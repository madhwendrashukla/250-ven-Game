import { motion } from 'framer-motion';
import type { PerkDef } from '../game/perks';
import { Icon } from './icons';

/** A perk as a hand-made visiting card: tone band, icon medallion, rules text and a scribbled line. */
export function PerkFace({ perk, hotkey }: { perk: PerkDef; hotkey?: number }) {
  return (
    <>
      <span className="perk-band">
        <span className="perk-kind">Perk</span>
        {hotkey !== undefined && <kbd className="kbd">{hotkey}</kbd>}
      </span>
      <span className="perk-medal">
        <Icon name={perk.icon} size={28} />
      </span>
      <span className="perk-name">{perk.name}</span>
      <span className="perk-effect">{perk.effect}</span>
      <span className="perk-flavor">{perk.flavor}</span>
    </>
  );
}

interface Props {
  perk: PerkDef;
  index: number;
  hotkey: number;
  picked: number | null;
  onPick: (i: number) => void;
}

const FAN = [-4, 0, 4];

/** One card in the week-close draft. Dealt in like a hand; the pick gets a rubber stamp. */
export function PerkCard({ perk, index, hotkey, picked, onPick }: Props) {
  const chosen = picked === index;
  const passed = picked !== null && !chosen;
  return (
    <motion.button
      type="button"
      className={`perk-card tone-${perk.tone} ${chosen ? 'is-picked' : ''}`}
      onClick={() => onPick(index)}
      disabled={picked !== null}
      data-sfx="off"
      aria-label={`Take ${perk.name}: ${perk.effect}`}
      initial={{ opacity: 0, y: 90, rotate: 0 }}
      animate={chosen ? { opacity: 1, y: -14, rotate: 0, scale: 1.05 } : passed ? { opacity: 0.35, y: 18, rotate: FAN[index] * 2, scale: 0.95 } : { opacity: 1, y: 0, rotate: FAN[index], scale: 1 }}
      whileHover={picked === null ? { y: -10, rotate: 0, scale: 1.03 } : undefined}
      transition={{ type: 'spring', stiffness: 320, damping: 20, delay: picked === null ? 0.75 + index * 0.1 : 0 }}
    >
      <PerkFace perk={perk} hotkey={hotkey} />
      <span className="perk-take">
        Take card <Icon name="ArrowRight" size={15} />
      </span>
      {chosen && (
        <motion.span
          className="perk-stamp"
          initial={{ scale: 3.5, opacity: 0, rotate: -40 }}
          animate={{ scale: 1, opacity: 1, rotate: -16 }}
          transition={{ type: 'spring', stiffness: 600, damping: 16 }}
        >
          Yours
        </motion.span>
      )}
    </motion.button>
  );
}

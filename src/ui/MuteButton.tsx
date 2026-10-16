import { motion } from 'framer-motion';
import { sfx, useMuted } from '../audio/sfx';
import { Icon } from './icons';

export function MuteButton({ className = '' }: { className?: string }) {
  const [muted, setMuted] = useMuted();
  return (
    <motion.button
      className={`icon-btn ${className}`}
      onClick={() => {
        setMuted(!muted);
        if (muted) window.setTimeout(() => sfx.good(), 30);
      }}
      aria-label={muted ? 'Turn sound on' : 'Mute sound'}
      aria-pressed={!muted}
      title={muted ? 'Sound off' : 'Sound on'}
      whileTap={{ scale: 0.88 }}
      data-sfx="off"
    >
      <Icon name={muted ? 'VolumeX' : 'Volume2'} />
    </motion.button>
  );
}

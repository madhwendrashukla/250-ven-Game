import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { useEffect, useState } from 'react';
import { playForStep } from './audio/gameSounds';
import { sfx } from './audio/sfx';
import { IDEAS } from './game/content';
import { act, createGame, pickPerk, resolveEvent } from './game/engine';
import { dailySeed, randomSeed } from './game/rng';
import { buildReport } from './game/score';
import type { GameAction, GameState, Step } from './game/types';
import type { Board } from './shared/leaderboard';
import { loadHistory, loadSave, recordRun, saveGame, type RunRecord } from './storage';
import { EndScreen } from './ui/EndScreen';
import { FxProvider } from './ui/Fx';
import { GameScreen } from './ui/GameScreen';
import { HowToPlayModal, HowToPlayScreen } from './ui/HowToPlay';
import { IdeaPicker } from './ui/IdeaPicker';
import { Leaderboard } from './ui/Leaderboard';
import { TitleScreen } from './ui/TitleScreen';

type Screen = 'title' | 'pick' | 'game' | 'howto' | 'leaderboard';

function runId(s: GameState): string {
  return `${s.ideaId}-${s.seed}-${s.dailyLabel ?? 'free'}`;
}

export default function App() {
  const [game, setGame] = useState<GameState | null>(() => loadSave());
  const [screen, setScreen] = useState<Screen>('title');
  const [history, setHistory] = useState<RunRecord[]>(() => loadHistory());
  const [showHelp, setShowHelp] = useState(false);
  const [boardView, setBoardView] = useState<{ board: Board; date?: string }>({ board: 'daily' });

  useEffect(() => saveGame(game), [game]);

  // A soft click for every ordinary button; action buttons opt out with data-sfx="off" and play their own sound.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const btn = (e.target as Element | null)?.closest('button');
      if (btn && !btn.disabled && btn.dataset.sfx !== 'off') sfx.click();
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, []);

  function update(next: GameState, step: Step) {
    if (!game) return;
    playForStep(game, next, step);
    if (game.status === 'playing' && next.status === 'ended') {
      const report = buildReport(next);
      setHistory(
        recordRun({
          id: runId(next),
          ideaId: next.ideaId,
          score: report.score,
          profit: report.profit,
          grade: report.grade,
          archetype: report.archetype.title,
          dailyLabel: next.dailyLabel,
          playedAt: new Date().toISOString(),
        }),
      );
    }
    setGame(next);
  }

  function start(ideaId: string) {
    setGame(createGame(ideaId, randomSeed()));
    setScreen('game');
  }

  function startDaily() {
    const { seed, label } = dailySeed();
    setGame(createGame(IDEAS[seed % IDEAS.length].id, seed, label));
    setScreen('game');
  }

  function quitToTitle() {
    if (game?.status === 'ended') setGame(null);
    setScreen('title');
  }

  function openLeaderboard(view: { board: Board; date?: string }) {
    setBoardView(view);
    setScreen('leaderboard');
  }

  let key: string = screen;
  let body;
  if (screen === 'game' && game) {
    key = game.status === 'ended' ? `end-${runId(game)}` : `game-${runId(game)}`;
    body =
      game.status === 'ended' ? (
        <EndScreen
          game={game}
          history={history}
          onReplay={() => (game.dailyLabel ? startDaily() : start(game.ideaId))}
          onNewIdea={() => {
            setGame(null);
            setScreen('pick');
          }}
          onHome={quitToTitle}
          onLeaderboard={() => openLeaderboard(game.dailyLabel ? { board: 'daily', date: game.dailyLabel } : { board: 'alltime' })}
        />
      ) : (
        <GameScreen
          game={game}
          onAct={(a: GameAction) => update(act(game, a), { t: 'act', a })}
          onChoose={(i: number) => update(resolveEvent(game, i), { t: 'choose', i })}
          onPerk={(i: number) => update(pickPerk(game, i), { t: 'perk', i })}
          onHome={quitToTitle}
          onHelp={() => setShowHelp(true)}
        />
      );
  } else if (screen === 'pick') {
    body = <IdeaPicker onPick={start} onBack={() => setScreen('title')} />;
  } else if (screen === 'howto') {
    body = <HowToPlayScreen onBack={() => setScreen('title')} onStart={() => setScreen('pick')} onDaily={startDaily} />;
  } else if (screen === 'leaderboard') {
    key = `leaderboard-${boardView.board}-${boardView.date ?? ''}`;
    body = (
      <Leaderboard
        initialBoard={boardView.board}
        initialDate={boardView.date}
        onBack={() => setScreen(game?.status === 'ended' ? 'game' : 'title')}
        onPlayDaily={startDaily}
      />
    );
  } else {
    key = 'title';
    body = (
      <TitleScreen
        canContinue={!!game && game.status === 'playing'}
        continueLabel={game ? `Day ${game.day} · ${IDEAS.find((i) => i.id === game.ideaId)?.name}` : ''}
        history={history}
        onContinue={() => setScreen('game')}
        onNew={() => setScreen('pick')}
        onDaily={startDaily}
        onHelp={() => setScreen('howto')}
        onLeaderboard={() => openLeaderboard({ board: 'daily' })}
      />
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <FxProvider>
        <AnimatePresence mode="wait">
          <motion.div
            key={key}
            className="screen"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onAnimationStart={() => window.scrollTo({ top: 0 })}
          >
            {body}
          </motion.div>
        </AnimatePresence>
        <AnimatePresence>{showHelp && <HowToPlayModal onClose={() => setShowHelp(false)} />}</AnimatePresence>
      </FxProvider>
    </MotionConfig>
  );
}

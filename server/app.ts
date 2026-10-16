import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { IDEAS } from '../src/game/content';
import type { SubmitResponse } from '../src/shared/leaderboard';
import type { Store } from './store';
import { verifyRun } from './verify';

interface AppOptions {
  /** Folder with the built front-end to serve (optional). */
  staticDir?: string;
  corsOrigin?: string;
  /** Max submissions per IP per window. */
  rateLimit?: number;
  rateWindowMs?: number;
  /** Behind a proxy (Vercel), read the client IP from X-Forwarded-For for rate limiting. */
  trustProxy?: boolean;
}

function rateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      res.status(429).json({ error: 'Too many submissions — try again in a few minutes.' });
      return;
    }
    recent.push(now);
    hits.set(key, recent);
    next();
  };
}

export function createApp(db: Store, opts: AppOptions = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (opts.trustProxy) app.set('trust proxy', true);
  app.use(express.json({ limit: '200kb' }));

  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', opts.corsOrigin ?? '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.get('/api/health', async (_req, res) => {
    try {
      await db.ping();
      res.json({ ok: true, store: db.kind, db: 'ok' });
    } catch (err) {
      console.error('[api] health check failed', err);
      res.status(503).json({ ok: false, store: db.kind, db: 'unreachable' });
    }
  });

  app.post('/api/runs', rateLimiter(opts.rateLimit ?? 30, opts.rateWindowMs ?? 5 * 60_000), async (req, res, next) => {
    const result = verifyRun(req.body);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    const { submission: sub, state, report } = result;
    try {
      const improved = await db.saveRun({
        playerId: sub.playerId,
        name: sub.name,
        ideaId: sub.ideaId,
        seed: sub.seed,
        dailyLabel: sub.dailyLabel,
        score: report.score,
        profit: Math.round(report.profit),
        finalCash: Math.round(report.finalCash),
        customers: state.stats.sold,
        grade: report.grade,
        archetype: report.archetype.title,
        archetypeIcon: report.archetype.icon,
        days: state.day,
        stepsJson: JSON.stringify(sub.steps),
      });
      const body: SubmitResponse = {
        score: report.score,
        grade: report.grade,
        improved,
        daily: sub.dailyLabel ? await db.rankOf({ board: 'daily', date: sub.dailyLabel, playerId: sub.playerId }) : null,
        alltime: (await db.rankOf({ board: 'alltime', playerId: sub.playerId })) ?? { rank: 0, total: 0 },
      };
      res.status(201).json(body);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/leaderboard', async (req, res, next) => {
    const board = req.query.board === 'daily' ? 'daily' : 'alltime';
    const date = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date) ? req.query.date : null;
    if (board === 'daily' && !date) {
      res.status(400).json({ error: 'date=YYYY-MM-DD is required for the daily board' });
      return;
    }
    const idea = typeof req.query.idea === 'string' && IDEAS.some((i) => i.id === req.query.idea) ? req.query.idea : null;
    const limit = Number(req.query.limit) || 50;
    const playerId = typeof req.query.playerId === 'string' ? req.query.playerId : null;
    try {
      res.json(await db.leaderboard({ board, date, idea, limit, playerId }));
    } catch (err) {
      next(err);
    }
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  if (opts.staticDir && fs.existsSync(path.join(opts.staticDir, 'index.html'))) {
    const dir = opts.staticDir;
    app.use(express.static(dir, { index: 'index.html', maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(dir, 'index.html')));
  }

  // Malformed JSON and other errors.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = (err as { status?: number }).status ?? 500;
    if (status >= 500) console.error('[api]', err);
    res.status(status).json({ error: status === 500 ? 'Server error' : 'Bad request' });
  });

  return app;
}

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';
import { connectPg } from './pg';
import type { Store } from './store';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// `--port` wins so `npm run dev` keeps the API off the web server's PORT; hosts set PORT in production.
const portArg = process.argv.indexOf('--port');
const port = Number(portArg > -1 ? process.argv[portArg + 1] : process.env.PORT) || 8787;
const dbFile = process.env.DB_FILE ?? path.join(root, 'data', 'leaderboard.db');

// Postgres (e.g. Supabase) when DATABASE_URL is set, otherwise a local SQLite file.
// SQLite is loaded lazily so hosts without its native module can still run on Postgres.
const db: Store = process.env.DATABASE_URL ? connectPg(process.env.DATABASE_URL) : (await import('./db')).openDb(dbFile);
const where = db.kind === 'postgres' ? 'postgres (DATABASE_URL)' : dbFile;
const app = createApp(db, {
  staticDir: path.join(root, 'dist'),
  corsOrigin: process.env.CORS_ORIGIN,
});

const server = app.listen(port, () => {
  console.log(`[api] leaderboard on http://localhost:${port}  (db: ${where})`);
});

function shutdown() {
  server.close(() => {
    void db.close().finally(() => process.exit(0));
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

/**
 * Vercel serverless entry for the leaderboard API. scripts/build-vercel.mjs bundles this file
 * (with the game engine) into one function per API route. Storage is Supabase Postgres via DATABASE_URL.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from './app';
import { connectPg } from './pg';

const url = process.env.DATABASE_URL;

// One app (and connection pool) per warm function instance.
const app = url ? createApp(connectPg(url), { trustProxy: true, corsOrigin: process.env.CORS_ORIGIN }) : null;

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  if (app) {
    app(req, res);
    return;
  }
  res.statusCode = 503;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: 'Leaderboard database is not configured: set DATABASE_URL in the Vercel project.' }));
}

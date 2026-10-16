/**
 * Builds the site for Vercel using the Build Output API (.vercel/output):
 *   static/                              the Vite front-end
 *   functions/api/{runs,leaderboard,health}.func   the leaderboard API, bundled with the game engine
 * Vercel picks this folder up after the build command (or `vercel deploy --prebuilt`).
 */
import { build as esbuild } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as viteBuild } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '.vercel', 'output');
const ROUTES = ['runs', 'leaderboard', 'health'];
const RUNTIME = 'nodejs22.x';
// Mumbai by default, next to a Supabase project in ap-south-1. Override to match your database's region.
const REGION = process.env.VERCEL_FUNCTION_REGION ?? 'bom1';

await fs.rm(out, { recursive: true, force: true });

await viteBuild({ root, logLevel: 'warn' });
await fs.cp(path.join(root, 'dist'), path.join(out, 'static'), { recursive: true });

const bundle = path.join(root, '.vercel', 'api-bundle', 'index.mjs');
await esbuild({
  entryPoints: [path.join(root, 'server', 'vercel.ts')],
  outfile: bundle,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  // Express is CommonJS: give the ESM bundle a real `require` for its Node built-ins.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  legalComments: 'none',
  logLevel: 'warning',
});

const fnConfig = { runtime: RUNTIME, handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false, regions: [REGION], maxDuration: 15 };
for (const route of ROUTES) {
  const dir = path.join(out, 'functions', 'api', `${route}.func`);
  await fs.mkdir(dir, { recursive: true });
  await fs.copyFile(bundle, path.join(dir, 'index.mjs'));
  await fs.writeFile(path.join(dir, '.vc-config.json'), JSON.stringify(fnConfig, null, 2));
}

await fs.writeFile(
  path.join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/assets/(.*)$', headers: { 'cache-control': 'public, max-age=31536000, immutable' }, continue: true },
        { handle: 'filesystem' },
        { src: '^/api/.*$', status: 404 },
        // Single-page app: every other path loads the game.
        { src: '^/.*$', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);

const size = (await fs.stat(bundle)).size;
console.log(`[vercel] .vercel/output ready: static site + ${ROUTES.length} API functions (${Math.round(size / 1024)} KB, ${RUNTIME}, ${REGION})`);

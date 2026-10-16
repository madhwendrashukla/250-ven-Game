# ₹250 Venture

A browser game about bootstrapping: you have **₹250 and 30 days**. Talk to customers, test prices, make stock, pick channels and sell — then get a debrief showing what the market really looked like, and climb a verified leaderboard.

Inspired by "Venturing on a Budget"-style entrepreneurship exercises. Unofficial fan project — not affiliated with any university.

## Run it

```bash
npm install
npm run dev        # game on http://localhost:5173 + leaderboard API on :8787
npm test           # engine, balance and leaderboard API tests
npm run build      # production bundle in dist/
npm start          # serves dist/ + the API from one Node process (PORT, default 8787)
npm run deploy     # builds for Vercel and deploys to production (see "Deploy" below)
```

Requires Node 20+. Vite is pinned to v6 because v7 needs Node ≥ 20.19.

Running a second dev copy next to another one? Start the API on a free port (`npx tsx server/index.ts --port 8788`) and point Vite's `/api` proxy at it with `API_PORT=8788 npx vite --port 5174`.

## Design: "the stall desk"

The interface is the founder's stall, not a dashboard. Every panel is an object from a small Indian business:

| Game concept | Object on the desk |
|---|---|
| Day | Tear-off wall calendar (yesterday's page falls away) + a cart riding a 30-stop road, with rent posts at each week's close |
| Weekly target | A paper chit pinned beside the calendar: goal, progress bar, rent due, "Done" stamp |
| Week close | The *Bazaar Times* weekly edition: target stamped HIT or MISSED, reward, rent, next week |
| Perks | Hand-made visiting cards, dealt three at a time; the one you take gets a "Yours" stamp |
| Energy | A cutting-chai glass that empties as you work |
| Daily moves | Colour-coded move cards — teal discovers, marigold makes, pink sells, ink recharges |
| Move settings | An order slip with a price dial |
| Results | A printed receipt with a torn edge |
| Journal | A red-cloth *bahi-khata* ledger marked शुभ लाभ, handwritten entries |
| Random events | The front page of the *Bazaar Times* (spins in) |
| Final result | A founder trading card + rubber grade stamp, sticky-note debrief |
| Leaderboard | Hall of fame with a podium |

Visual language: hand-painted shop-sign lettering with 3D extrusion, a truck-art palette (marigold, rani pink, peacock teal, parrot green), thick ink outlines with hard offset shadows, bunting and a ticker. Type: Bungee (signage), Baloo 2 (UI, by Ek Type), Kalam (handwriting), DM Mono (receipts). Paper objects stay paper-coloured in dark mode, like objects on a desk at a night market.

Game feel follows three references: Papers, Please (diegetic UI), Balatro (layered feedback scaled to the size of a win — coin count, register sound and screen shake grow with revenue) and Reigns (preview badges on the HUD show what a move will change before you commit).

## Features

- **Icons, not emoji** — [lucide](https://lucide.dev) icons throughout, mapped by name in `src/ui/icons.tsx`.
- **Animations** — framer-motion: card deals, page tears, receipt printing, coin bursts into your cash, counting numbers, newspaper spin-ins, stamp slams, podium rises and confetti. Respects the OS "reduce motion" setting.
- **Sound effects** — synthesised live with the Web Audio API (`src/audio/sfx.ts`): coins, cash register, interviews, events, rest, fanfare, sad trombone… No audio files. Mute toggle in the HUD and title screen, remembered per device.
- **Weekly targets, rent and a perk draft** — each week has a goal and a rent bill; every week close deals three perk cards (see below).
- **Market shifts** — once or twice a run a segment's true value or crowd size moves for good.
- **Fast play** — keyboard shortcuts (`1`–`7` pick a move card, `Enter` plays it, `R` repeats the last move; `1`–`3` take a perk card) and a "Same again" button above the cards. Shortcuts are ignored while typing a price or quantity and while any pop-up is open.
- **How to play** — a full guide screen from the title, and the same guide as a pop-up in game (the `?` button), including the whole perk deck.
- **Leaderboard** — daily-challenge and all-time boards (filter by idea), best score per player, your rank highlighted.

## Leaderboard & anti-cheat

The client never sends a score. When a run ends it sends the seed plus the list of moves (`GameState.history`: daily actions `{ t: 'act' }`, event choices `{ t: 'choose' }` and perk picks `{ t: 'perk', i }`). The server (`server/verify.ts`) replays those moves through the same deterministic engine and computes the score itself, so a tampered score is impossible and an illegal move is rejected — including a perk pick when no draft is open, a skipped draft, or a card index outside the three on offer. Daily-challenge runs must use that day's seed and idea, within ±2 days.

- API: `POST /api/runs`, `GET /api/leaderboard?board=daily&date=YYYY-MM-DD` or `?board=alltime&idea=cookies`
- Database: Postgres when `DATABASE_URL` is set (Supabase in production, `server/pg.ts`), otherwise SQLite at `data/leaderboard.db` (override with `DB_FILE`, `server/db.ts`). Both implement the same `Store` interface (`server/store.ts`), and the API tests run against both.
- Players are anonymous: a random id in localStorage plus a display name (2–20 chars, cleaned server-side).
- Simple per-IP rate limit on submissions.

**Other hosts:** `npm run build && npm start` runs everything from one Node service — on SQLite with a persistent disk (e.g. a Railway/Fly volume), or on Postgres by setting `DATABASE_URL`. If the API lives on another origin, build the front-end with `VITE_API_URL=https://your-api` and set `CORS_ORIGIN` on the server.

## Deploy: Vercel + Supabase

The game is a static site on Vercel's CDN; the leaderboard API runs as Vercel functions (in Mumbai, `bom1`) and stores runs in Supabase Postgres. `npm run build:vercel` writes Vercel's [Build Output](https://vercel.com/docs/build-output-api/v3) to `.vercel/output`: the Vite site plus the API bundled with the game engine by esbuild (`scripts/build-vercel.mjs`, entry `server/vercel.ts`). The browser and the API share one origin, so no CORS or `VITE_API_URL` is needed.

**1. Supabase (database)**

1. On [supabase.com](https://supabase.com) create a project. Pick the **South Asia (Mumbai)** region and save the database password.
2. *SQL Editor → New query*: paste `supabase/migrations/20261016000000_leaderboard.sql` and run it. (The server also creates the table on first use if you skip this.) It turns on row level security with no policies, so the table is invisible to Supabase's public REST API; only the game server, which verifies every run, can write to it.
3. Click **Connect** → **Transaction pooler** and copy the URI (port **6543**). Put your password in place of `[YOUR-PASSWORD]` — if it has symbols like `@ # / ?`, URL-encode them.

**2. Vercel (site + API)**

```bash
vercel login                                   # once, opens the browser
vercel link                                    # creates/links the Vercel project
vercel env add DATABASE_URL production         # paste the Supabase pooler URI when asked
npm run deploy                                 # build:vercel + vercel deploy --prebuilt --prod
```

Open `https://<your-project>.vercel.app/api/health` — it should answer `{"ok":true,"store":"postgres","db":"ok"}`. Then play a run and submit it to the hall of fame.

- Prefer Git? Push the repo to GitHub, import it in Vercel and add `DATABASE_URL` in *Settings → Environment Variables*; `vercel.json` makes Vercel run `npm run build:vercel` on every push.
- Supabase in another region? Build with `VERCEL_FUNCTION_REGION` set to the nearest [Vercel region](https://vercel.com/docs/edge-network/regions) (e.g. `sin1` for Singapore).
- `better-sqlite3` is an optional dependency: Vercel never loads it, so a failed native build there doesn't matter.
- The per-IP submission limit lives in memory, so on Vercel it applies per function instance. Fake scores are still impossible — every run is replayed.

## How it plays

| Action | Cost | What it does |
|---|---|---|
| Talk | 1 day, −15 energy | Narrows a segment's willingness-to-pay range, reveals market size and preferred channel |
| Price test | 1 day, −10 energy | Asks 20 people "would you buy at ₹X?" |
| Restock | no day, −5 energy | Bulk discounts at 20+ / 50+; cookies go stale after 3 days |
| Sell | 1 day, channel cost | One segment × one channel per day |
| Post | 1 day, −15 energy | Grows followers → Instagram reach |
| Improve | 1 day, ₹40/80/120 | Higher conversion, slightly higher unit cost |
| Rest | 1 day | +45 energy (below 25 energy everything is 35% weaker) |

Hidden per run: each segment's true willingness to pay and market size. Markets saturate if you sell to the same segment every day; WhatsApp groups fatigue; random events force trade-offs.

### Weeks, rent and targets

The 30 days run as four weeks plus a two-day final stretch. Each week closes at the end of day 7, 14, 21 and 28 (`src/game/weeks.ts`):

| Week | Rent | Target drawn from | Reward if hit |
|---|---|---|---|
| 1 | ₹50 | serve N customers · talk to every segment · ₹250 in sales | +₹75, +100 pts |
| 2 | ₹80 | ₹700 cash on day 14 · serve N customers · reach 60 fans | +50 fans, +150 pts |
| 3 | ₹110 | sell to 2 segments · ₹1,200 in sales · 2-star quality | +₹150, +200 pts |
| 4 | ₹150 | top quality · ₹2,000 cash on day 28 · serve N customers · sell to 2 segments | +75 fans, +250 pts |

- One target per week is drawn from the seed at the start of the run (never the same kind twice), so runs ask for different things and everyone on a daily challenge gets the same four kinds of target.
- Customer counts scale with the idea's demand (10 a week for cookies, 2 for thrift pieces).
- Targets on running totals (fans, cash, quality) that are already met when their week opens are raised above where you stand, so no week is a freebie.
- Rent comes out after the target is checked. If you're short, you pay what you have; the landlord collects the rest from your cash each morning, and anything still owed at the end is deducted from final cash and score.

### Perk draft

At every week close you're dealt three perk cards and keep one for the rest of the run (Balatro-style). Perks live in `GameState.perks`; the deck is in `src/game/perks.ts`:

| Perk | Effect |
|---|---|
| Society WhatsApp admin | WhatsApp groups tire half as fast |
| Wholesale contact | Unit cost −15% |
| Cousin at the stall | Pop-up stall days cost no energy |
| Blogger friend | +1 fan for every 2 customers |
| Exam-season insider | Student demand +25% (ideas with a student segment) |
| Mohalla regulars | Friends & word-of-mouth reach ×1.6 |
| Ad-agency intern | Boosted ads ₹35 instead of ₹60 |
| Weekly haat pitch | Tired segments recover twice as fast |
| Kirana uncle's rate card | Bulk discounts from 10+ / 30+ |
| Neighbour's fridge | Stock stays fresh 2 days longer (perishables only) |
| Mama's shagun | +₹151 cash now |
| Psychology-major friend | Price tests ask 40 people; sharper interviews |
| Tapri chai tab | +10 energy every morning |
| Jugaad workshop | Quality upgrades cost half (until top quality) |

The three cards are shuffled from the seed and the week number, so every daily-challenge player sees the same first draft; later drafts differ only by what you already own. Your pick is recorded in `GameState.history` as `{ t: 'perk', i }` and must be made before the next move.

### Market shifts

Once or twice a run (`src/game/market.ts`) the *Bazaar Times* reports that a market moved: the first move always changes what people will pay, in week 2; a 60% chance of a second, in week 3.

- **Trend** — a segment you've neglected suddenly values the product 25–40% more, and more of them are looking.
- **Price war** — a rival undercuts you with the segment you sell to most; they now value it 20–30% less (the paper prints the rival's price).
- **New hostel / office tower / society** — another segment's crowd grows 50–80%.
- **Fad fades** — your main segment's crowd shrinks.

A price move makes that segment's estimate stale: it's flagged "market moved", the range widens to cover the new value, and old pins and evidence fade until you talk to them or run a price test. "About 80% of what they'd pay" is still the shape of a good price, but *what they'd pay* is no longer fixed — re-checking after big news is part of the game, and the debrief says whether you did. Pricing lessons compare each sale against the value at the time of sale.

## Scoring

Score = profit (final cash − rent still owed − ₹250) + 3 per customer + 15 per experiment (max 12) + half your fans + 20 per quality star + weekly target points (100 / 150 / 200 / 250). Grades: S 5,000+, A 3,500+, B 1,800+, C 700+.

## Code map

```
src/game/        pure, deterministic engine (no React) — shared by client and server
  engine.ts      createGame, act, resolveEvent, pickPerk, day advance
  weeks.ts       weekly targets, rent, week close
  perks.ts       the perk deck and the seeded draft
  market.ts      mid-run market shifts
  sim.ts         scripted bots used by the balance tests
src/audio/       Web Audio sound effects + which sound each move plays
src/ui/          React screens and components
src/shared/      API types shared by client and server
src/api.ts       leaderboard client + anonymous player identity
server/          Express API, replay verification, SQLite + Postgres stores, Vercel entry (+ tests)
supabase/        Postgres migration for the leaderboard table
scripts/         build-vercel.mjs (Vercel Build Output)
```

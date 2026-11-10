# Gymmiie

**Lift. Log it. Grow.** An offline-first gym log for the web — a Cloudflare-hosted reimplementation of the ideas, catalogue and training flows in [GymMane](https://github.com/InlitX/GymMane) by InlitX.

Gymmiie stores everything in your browser. No account, no ads, no trackers. Optional cross-device sync uploads only an encrypted blob that the server cannot read.

![Gymmiie](public/icon.svg)

## Highlights

- **Body-map training** — tap the muscles you want to hit and get a matched session with warm-ups.
- **Live session logging** — weight, reps, cardio, time, RPE, set kinds, supersets, notes, automatic rest with beep/vibration, PR context, reorder/swap/remove.
- **Routines & programs** — build routines, schedule weekdays, or install Full Body, Push/Pull/Legs, Upper/Lower and Arnold templates.
- **Progress that means something** — e1RM, records, streaks, heatmaps, weekly volume, bodyweight, measurements, goals and awards.
- **466-exercise library** — search/filter by muscle and equipment, custom exercises, favourites, archive, per-exercise notes and charts.
- **Nutrition** — 561 foods and 27 dishes, meal slots, macro goals, water tracking and custom foods.
- **Tools & journal** — 1RM, BMI, TDEE/macros, body fat, FFMI, plate maths, warm-up ramps, RPE load, DOTS and Wilks, plus a tagged training journal.
- **Gym pass cards** — store membership numbers and entry codes locally.
- **Offline PWA** — installable, dark/light, service-worker app shell; everything works in airplane mode.
- **Encrypted sync** — optional AES-GCM backup to Cloudflare D1 with a code-derived key. No accounts, no plaintext on the server.

## Stack

| Layer | Choice |
| --- | --- |
| UI | React 18, TypeScript, Vite |
| Styling | Tailwind CSS 3 + semantic CSS variables |
| State | Zustand + Immer |
| Local persistence | IndexedDB via `idb-keyval` |
| Icons | Lucide |
| Edge | Cloudflare Worker (static assets + sync API) |
| Cloud data | Cloudflare D1 |

## Quick start

Requires Node 20+.

```bash
npm install
npm run dev          # http://localhost:5173
```

The Vite dev server proxies `/api` to `http://localhost:8787`. For the sync API locally:

```bash
npx wrangler d1 migrations apply gymmiie --local
npx wrangler dev --port 8787 --local
```

Useful scripts:

```bash
npm run typecheck    # app + Worker
npm run build        # typecheck + production build
npm run preview      # preview the production build
npm run icons        # regenerate PNG PWA icons from public/icon.svg
```

## Deploy to Cloudflare

1. Authenticate and create the D1 database:

   ```bash
   npx wrangler login
   npx wrangler d1 create gymmiie
   ```

2. Copy the returned `database_id` into `wrangler.toml`, replacing
   `REPLACE_WITH_YOUR_D1_DATABASE_ID`.

3. Apply the schema and deploy:

   ```bash
   npm run db:migrate
   npm run deploy
   ```

   Or deploy manually:

   ```bash
   npm run build
   npx wrangler d1 migrations apply gymmiie --remote
   npx wrangler deploy
   ```

The Worker serves the built SPA from `dist/` and routes `/api/*` to the sync
handlers. Client-side routes fall back to `index.html`.

### Sync API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness probe |
| `GET` | `/api/sync/:id` | Fetch `{ payload, updatedAt, bytes }` or `404` |
| `PUT` | `/api/sync/:id` | Upsert `{ payload }` (base64 ciphertext, max 8 MB) |
| `DELETE` | `/api/sync/:id` | Delete the snapshot |

`id` is `SHA-256("gymmiie-id:" + lowercased sync code)`. The browser derives an
AES-256-GCM key from the same code with PBKDF2-SHA256 (210,000 iterations) and
uploads `base64(iv + ciphertext)`. The Worker never sees the code or plaintext.
Losing the code means the snapshot cannot be recovered — there is no reset link.

## Data & backups

- All app data lives in IndexedDB under a single versioned document.
- Settings → **Export backup** downloads a complete JSON file.
- Settings → **Export CSV** downloads one row per set for spreadsheets.
- Settings → **Import backup** replaces local data from a valid backup.
- **Reset all data** wipes the local document; cloud copies are separate and must
  be deleted explicitly.

Weights are stored internally in kilograms and converted for display. Nutrition
values are per 100 g; dishes resolve the `a:`-prefixed food slugs in the bundled
catalogue.

## Project structure

```
src/
  pages/           17 screens (onboarding, dashboard, train, session, …)
  components/      Layout, UI primitives, body map, exercise picker/tiles
  lib/             store, stats, foods, exercises, date, IndexedDB, cloud sync
  data/            extracted exercises (466), foods (561), dishes (27)
worker/index.ts    Cloudflare Worker: assets + encrypted snapshot API
migrations/        D1 schema
public/            manifest, service worker, icons
scripts/           data extraction and icon generation
```

## Verification

```bash
npm run typecheck
npm run build
```

The local Worker can be smoke-tested with:

```bash
curl -s http://127.0.0.1:8787/api/health
curl -s -X PUT "http://127.0.0.1:8787/api/sync/$(printf 'a%.0s' {1..64})" \
  -H 'content-type: application/json' -d '{"payload":"dGVzdA=="}'
```

## License & attribution

Gymmiie is licensed under the **GNU General Public License v3.0** (`GPL-3.0-only`).
See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).

> **Based on GymMane by InlitX.**

GymMane is © 2026 InlitX and is licensed GPL-3.0 with an additional Section 7(b)
attribution term. Gymmiie keeps that attribution in its About screen and docs.

Exercise animations are bundled under **CC BY-SA 4.0**, sourced from
[Workout Guide](https://github.com/bryllim/workout-guide) by Bryl Lim,
[Everkinetic](https://github.com/everkinetic/data) and GymMane's derived pose
data for gaps — per-exercise provenance is listed in
[public/art/ATTRIBUTION.md](public/art/ATTRIBUTION.md). Step-by-step form
guidance prefers Everkinetic's public instructions (same licence), falling back
to GymMane catalogue text. Nunito is used under the SIL Open Font License via
Google Fonts. Nutrition values are approximate and not medical advice.

Gymmiie is an independent web project and is not affiliated with InlitX.

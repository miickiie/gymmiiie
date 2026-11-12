# Gymmiie

**Lift. Log it. Grow.** An offline-first gym log for the web — a Cloudflare-hosted reimplementation of the ideas, catalogue and training flows in [GymMane](https://github.com/InlitX/GymMane) by InlitX.

Gymmiie keeps each user’s training log under an account identified by name and a 4-digit PIN. Logs are cached separately on each device and synchronized to the server when connected. There are no ads or trackers. An optional code-protected encrypted backup remains separate from account sync.

![Gymmiie](public/logo.svg)

## Highlights

- **Workout start hub** — routines and empty workouts are equally accessible; optional muscle suggestions lead to an editable review with coverage checks.
- **Live session logging** — weight, reps, cardio, time, RPE/RIR, set kinds and notes through mobile set details; automatic rest with end beep/vibration, PR context, reorder/swap/remove. Active workouts cannot be replaced without confirmation.
- **Routines & programs** — build routines, schedule weekdays, or install Full Body, Push/Pull/Legs, Upper/Lower and Arnold templates.
- **Progress that means something** — e1RM, records, streaks, heatmaps, weekly volume, bodyweight, measurements, goals and awards.
- **466-exercise library** — search/filter by muscle and equipment, custom tracking modes and load types, favourites, archive, per-exercise notes and charts. Original exercise instructions and available animations are shown, with reviewed corrections retained and confirmed incompatible artwork excluded.
- **Nutrition** — 561 foods and 27 dishes, meal slots, macro goals, water tracking and custom foods.
- **Tools & journal** — 1RM, BMI, TDEE/macros, body fat, FFMI, plate maths, warm-up ramps, RPE load, DOTS and Wilks, plus a tagged training journal.
- **Gym pass cards** — store membership numbers and entry codes locally.
- **Offline PWA** — installable, dark/light, versioned precache of the app shell and route chunks; installed screens remain available offline.
- **User accounts** — return with the same name and 4-digit PIN; a server-checked registration passphrase is required only when creating a new user.
- **Manual encrypted backup** — optional AES-GCM snapshots with a separate code-derived key, alongside automatic account tracking sync.

Guide coverage and outstanding catalogue review are tracked in
[Exercise review status](docs/EXERCISE_REVIEW.md).

## Accounts and user flow

- The signed-out home asks for **Name** and a masked **4-digit PIN**. Leading zeros are preserved and the same validation runs in the browser and server.
- Existing accounts return with their current name and PIN. Account IDs and tracking data stay intact.
- PINs are stored as PBKDF2-SHA-256 hashes with random salts per normalized name. Both IP and normalized-name attempt limits apply. Different users can share a name if their PINs differ.
- **Continue** opens an existing user. Only a confirmed account-not-found response offers **Create user**, which additionally requires the registration passphrase. Connection/server failures offer retry and never create a replacement user automatically.
- Account identity is separate from the editable training display name in Settings.
- **Account menu → Switch user / Sign out** saves pending local changes, keeps active workouts with their original account and hides private screens. Another account never inherits that tracking data.
- An already cached, previously authenticated account can be opened with **Continue offline** when a connection is unavailable. Fresh sign-in and account switching require a connection; signing out locks offline reopening.
- Account sync distinguishes device saves, pending/server sync, offline state and conflicts. Conflicts preserve the device copy and require an explicit choice before loading the account copy.
- Older unassigned device logs remain untouched. After signing in, **Review device log** previews both copies before an explicit import into the named account; **Keep separate** leaves them unassigned.

The account API stores account identity and tracking JSON. The optional manual
backup API stores encrypted ciphertext; those are separate storage mechanisms.
The registration passphrase is configured on the server and is never included
in the frontend build or an exported training backup.

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

Requires Node 22+.

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
npm test             # domain, persistence and recovery regressions
npm run test:e2e     # production browser flows on desktop and mobile
npm run audit:exercises # exercise integrity and review coverage
npm run icons        # regenerate PWA icons from scripts/assets/peekaboo.png
```

## Deploy to Cloudflare

Follow the [Cloudflare deployment guide](docs/CLOUDFLARE_DEPLOYMENT.md) for account migrations, the server registration secret, and the main-branch build.

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

### Manual encrypted backup API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness probe |
| `GET` | `/api/sync/:id` | Fetch `{ payload, updatedAt, bytes }` or `404` |
| `PUT` | `/api/sync/:id` | Upsert `{ payload }` (base64 ciphertext, max 8 MB) |
| `DELETE` | `/api/sync/:id` | Delete the snapshot |

New uploads use `id = SHA-256("gymmiie-id-v2:" + trimmed case-sensitive sync code)`.
When the new location is absent, downloads also check the legacy lowercased lookup
(`"gymmiie-id:" + lowercased trimmed code). Uploads keep the legacy copy intact;
cloud deletion requires choosing the current or legacy location explicitly.
The browser derives an
AES-256-GCM key from the exact trimmed code with PBKDF2-SHA256 (210,000 iterations) and
uploads `base64(iv + ciphertext)`. The Worker never sees the code or plaintext.
Losing the code means the snapshot cannot be recovered — there is no reset link.

## Data & backups

- Each account has its own versioned IndexedDB record and tab recovery journal. Private revision metadata prevents one tab from overwriting another tab’s newer log. The original unassigned device record remains separate.
- Settings → **Export backup** downloads a complete JSON file.
- Settings → **Export CSV** downloads one row per set for spreadsheets.
- Settings → **Import backup** validates the complete version-1 backup, previews its contents and confirms replacement. Malformed and future-version backups leave the current log intact. Manual restore uses the same validation and explicitly replaces the signed-in account’s tracking log.
- **Reset tracking data** clears the current account’s training log and synchronizes that change to its other devices. The account identity remains; optional manual encrypted snapshots are separate and must be deleted explicitly.
- Save failures keep the current log in memory and expose retry/export recovery. A cross-tab conflict pauses editing until the latest saved copy is explicitly reloaded.
- Finishing a workout reports success only after the saved workout has been committed to IndexedDB.

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
npm test
npm run audit:exercises
npm run build
npm run test:e2e
```

Browser tests run against the production preview and cover mobile/desktop logging,
active-workout protection, set details, navigation and offline route access.

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
data. Available original mappings are displayed except confirmed incompatible artwork;
per-asset provenance is listed in [public/art/ATTRIBUTION.md](public/art/ATTRIBUTION.md).
Original GymMane instructions are available for every built-in exercise, with 16
reviewed guides taking priority. Everkinetic illustrations retain their original
light and dark paint layers; monochrome artwork follows the app theme.
Artwork and instruction review remain independent;
restoring existing content does not imply new approval. Known mismatched generated
instruction candidates remain excluded. Nunito is used under the SIL Open Font License via
Google Fonts. Nutrition values are approximate and not medical advice.

Gymmiie is an independent web project and is not affiliated with InlitX.

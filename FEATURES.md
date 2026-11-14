# Gymmiie feature map

A practical inventory of what the web app does, mapped to the GymMane Android
app it was reverse-engineered from. “Done” means the flow exists and persists
for the signed-in account, with device caching and automatic account synchronization. Manual encrypted backups are separate.

## Accounts

- Signed-out homepage with Name, international Telephone and Continue.
- Returning users open their server-backed tracking log using those identifiers; no private PIN or telephone verification is requested.
- Genuine not-found response reveals Create user and a server-checked registration passphrase field. Failed connectivity never becomes account creation.
- Server session verification precedes private account data hydration and navigation.
- Read-only account name/telephone, separate editable training display name.
- Home, Switch user and Sign out in the account menu; active workouts and unsynced changes remain under their original account.
- Explicit offline continuation of a previously opened, cached account. Local sign-out blocks automatic/offline reopening.
- Per-account IndexedDB, recovery journal and manual-backup preferences.
- Device/server sync status, retry/export recovery and explicit conflict replacement.
- Older unassigned device data is preserved; reviewed import into the named account is always explicit.

## Onboarding & profile

- Multi-step onboarding: welcome → units → profile → weekly goal, with optional setup later.
- Profile: name, sex, age, height, bodyweight, activity level.
- Unit system (kg/lb), six themes (Obsidian, Volt OLED, Abyss, Solar, Studio and Dune), week start, weekly workout goal. Mochi the cat announces each settings change in her speech bubble.
- TDEE/macro starter targets derived from profile.

## Today / dashboard

- Greeting, weekly goal ring, streak, level/XP progress.
- This-week strip with trained/rest/check-in states; check-in and rest-day toggles.
- One dominant Start/Resume action, with the planned routine and weekly plan shown separately.
- Recent workouts, quick-start tiles, bodyweight snapshot and journal shortcut.
- All-time workouts, working sets, total volume and calorie summary.

## Train & navigation

- Mobile navigation: Today, Train, History, Progress and More; nutrition is in More.
- Train presents routines and empty workouts equally, plus exercise library access.
- Optional front/back muscle-map suggestions from reviewed movement groups (up to 8).
- Quick warm-up and cardio starts; routine shortcuts and template discovery.
- Session review: add/remove/replace/reorder exercises, distinguish mobility drills and warn when a selected muscle has no primary movement.
- Every new-workout entry point shares Resume/Cancel/confirmed Discard & start protection.

## Live session

- Elapsed timer with pause/resume; session rename.
- Per-exercise cards with weight/repetition or time/distance set rows.
- Mobile Set details exposes RPE/RIR, notes and set kind (normal, warm-up, drop, failure, rest-pause, cluster). RIR input converts to canonical stored RPE.
- Pause freezes elapsed/rest time and prevents logging until resumed.
- Complete-set toggles; working-set and volume counters; warm-ups excluded from volume.
- Automatic rest timer with skip, ±15 s and end-of-rest beep/vibration.
- Auto-advance to the next exercise after all its sets are completed.
- Add/remove sets, add/remove/swap/reorder exercises.
- Last-time suggestions, best e1RM and PR context.
- Finish summary (duration, completed sets, volume, exercises), durable save and discard confirmation. A failed save keeps the active workout available for recovery.
- Repeat a past workout from session detail.

## Routines & programmes

- Create/edit/delete routines; name, exercises, per-exercise sets and rest.
- Weekly plan assignment per weekday with rest/unplanned state.
- One-tap start from a weekday or routine card.
- Built-in templates: Full Body (A/B/C), Push Pull Legs, Upper/Lower, Arnold Split.
- Per-exercise routine rest with the global setting as the default.

## History

- Chronological workout groups with search, date-range and routine filters.
- 17-week training heatmap.
- Per-workout duration, exercises, working sets, volume, PR count.
- Session detail: exercise/set breakdown, warm-up markers, PR badges, share/copy text,
  repeat workout and delete.

## Exercise library

- 501 built-in exercises extracted from GymMane, plus user-created exercises.
- Search and filters by muscle, equipment and body zone; a zone includes all its muscles, with favourites and archive.
- Custom exercises choose repetitions/time/distance tracking, load type and authored instructions.
- Exercise detail: muscles, equipment, instructions, cues, personal records,
  e1RM/volume history charts, per-exercise notes and archive/favourite actions.
- Exercise animations (CC BY-SA 4.0) from Workout Guide by Bryl Lim, Everkinetic and GymMane-derived poses, with lazy thumbnails. Existing mappings cover 473 exercises using 382 SVG assets; missing or confirmed incompatible mappings use an equipment icon.
- Original exercise-specific instructions are available for all 501 built-in exercises, with 16 reviewed guides taking priority. Known mismatched generated instructions remain excluded; independent review metadata and custom authored instructions are preserved.
- Form guides are accessible from exercise details and live workouts.
- Layered Everkinetic illustrations preserve source fills, fill rules and opacity, keeping figures distinct from their backgrounds in light and dark mode. Monochrome illustrations retain theme-aware coloring.

## Progress

- Overview: streak, working sets, hours, PR count, 12-week volume/sets chart,
  30-day daily volume, recent records and muscle heat map.
- Records: searchable PR table with weight, repetitions, seconds or kilometres. Estimated 1RM appears only for applicable loaded repetition sets; heaviest-weight summaries exclude other units.
- Body: bodyweight series, goal line, measurements, add/delete entries.
- Awards: milestone badges with progress bars (streaks, sessions, sets, volume, routines).

## Nutrition

- Date navigation and per-day totals.
- Calorie ring, protein/carbs/fat/fibre/sugar targets and progress.
- Water tracker with configurable glass size.
- Four meal slots; add/delete entries.
- Searchable 561-food catalogue and 27 dishes, per-100 g macros and portion scaling.
- Custom foods with finite, nonnegative per-100 g macros; logged portions must be finite and positive.
- Food preview shortcuts select the clicked food in the portion editor.
- Editable macro/water goals.

## Journal

- Notes with title/body, type tags (note, plan, done, pain), exercise links and dates.
- Search/filter, pin/edit/delete.

## Tools (10 calculators)

- Estimated 1RM, BMI, maintenance calories/macros, US Navy body fat, FFMI,
  barbell plate maths, warm-up ramp generator, RPE target load, DOTS, Wilks.

## Settings & data

- Profile, appearance, units, week start, weekly goal.
- Rest timer, auto-rest, auto-advance and sound/vibration tests. Unsupported countdown-beep and mini-rest controls are removed.
- Bar weight and plate inventory for plate maths.
- JSON export/import; CSV workout export; durable reset; persistent-storage request.
- One version-aware parser for local/import/cloud data; replacement preview and confirmation.
- Visible persistence failures, unsaved-copy export, retry and explicit reload after cross-tab conflicts.
- Manual encrypted backup: generate/save a per-account code, upload/download/delete a snapshot,
  status and snapshot workout count.
- Install prompt and About/credits.

## PWA & platform

- Web app manifest, maskable PNG icons, Apple touch icon.
- Generated versioned precache includes the app shell and lazy route chunks; navigations are network-first with an offline fallback.
- Six themes (Obsidian, Volt OLED, Abyss, Solar, Studio and Dune) with semantic
  RGB-channel tokens, plus a responsive desktop sidebar and mobile bottom
  navigation.
- Stacked accessible dialogs trap and restore focus, dismiss only the top dialog and lock background scrolling.
- Keyboard focus indicators, reduced-motion support and responsive mobile set controls.
- No analytics, cookies or third-party pixels. Fonts are loaded from Google Fonts.

## Cloud backend (Cloudflare)

- Single Worker serves `dist/` and the SPA fallback.
- Automatic account tracking uses server sessions and owner-scoped account data with revision conflicts.
- The separate D1 table `sync_snapshots` stores only `id` (SHA-256 of the manual sync code),
  `payload` (base64 AES-GCM ciphertext), `updated_at` and `bytes`.
- `GET/PUT/DELETE /api/sync/:id`, `GET /api/health`.
- Manual snapshot payload validation, 8 MB cap and `no-store` responses; manual snapshot contents remain ciphertext. Account identity and account tracking JSON are stored separately.

## Not rebuilt (yet)

These GymMane features are intentionally out of the current scope. The core
training, routine, progress, library, nutrition, journal and backup flows above
are implemented; the following are the remaining parity gaps.

- Circuit workouts / station rotation.
- Places and equipment-aware exercise filtering (the body map picks by muscle).
- Voice-guided rest.
- Superset/circuit timing; legacy link metadata is retained in backups without active controls.
- Explicit deload-week / light-session programming flags.
- Progress photos and a photo timeline.
- Month/weekly recap story cards (session share text exists; image stories do not).
- Steps, sleep and heart-rate tracking.
- User-supplied exercise photos, GIFs or video.
- Journal photo/video attachments (journal text, tags, dates and exercise links exist).
- ZIP export; imports from Hevy, Strong, Lyfta, FitNotes or openGym
  (Gymmiie ships full JSON export/import plus a flat workout CSV export).
- Health Connect and Strava `.fit` export.
- Nutrition supplements, meal plans/meal prep and “paste an AI meal” parsing.
- 18-language localisation (English only) and home-screen widgets.

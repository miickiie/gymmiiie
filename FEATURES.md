# Gymmiie feature map

A practical inventory of what the web app does, mapped to the GymMane Android
app it was reverse-engineered from. “Done” means the flow exists and persists
locally; optional cloud pieces are marked separately.

## Onboarding & profile

- Multi-step onboarding: welcome → units → profile → weekly goal.
- Profile: name, sex, age, height, bodyweight, activity level.
- Unit system (kg/lb), theme (dark/light/system), week start, weekly workout goal.
- TDEE/macro starter targets derived from profile.

## Today / dashboard

- Greeting, weekly goal ring, streak, level/XP progress.
- This-week strip with trained/rest/check-in states; check-in and rest-day toggles.
- Today’s planned routine (from the weekly plan) with one-tap start.
- Recent workouts, quick-start tiles, bodyweight snapshot and journal shortcut.
- All-time workouts, working sets, total volume and calorie summary.

## Train

- Front/back interactive muscle map; multi-muscle focus selection.
- Suggested exercise list (up to 8) with warm-up generation.
- Empty workout, quick warm-up and cardio starts.
- Routine shortcuts and template discovery.
- Session review before starting: add/remove exercises, see matched alternatives.

## Live session

- Elapsed timer with pause/resume; session rename.
- Per-exercise cards with set rows: weight, reps, left/right reps, time/distance for
  cardio, RPE, notes and set kind (normal, warm-up, drop, failure, rest-pause, cluster).
- Complete-set toggles; working-set and volume counters; warm-ups excluded from volume.
- Automatic rest countdown with skip, ±15 s, beep countdown and vibration.
- Auto-advance to the next exercise; superset linking.
- Add/remove sets, add/remove/swap/reorder exercises.
- Last-time suggestions, best e1RM and PR context.
- Finish summary (duration, working sets, volume, exercises) and discard with confirm.
- Repeat a past workout from session detail.

## Routines & programmes

- Create/edit/delete routines; name, exercises, per-exercise sets and rest.
- Weekly plan assignment per weekday with rest/unplanned state.
- One-tap start from a weekday or routine card.
- Built-in templates: Full Body (A/B/C), Push Pull Legs, Upper/Lower, Arnold Split.
- Default rest per exercise; automatic rest follows Settings.

## History

- Chronological workout groups with search, date-range and routine filters.
- 17-week training heatmap.
- Per-workout duration, exercises, working sets, volume, PR count.
- Session detail: exercise/set breakdown, warm-up markers, PR badges, share/copy text,
  repeat workout and delete.

## Exercise library

- 466 built-in exercises extracted from GymMane, plus user-created exercises.
- Search and filters by muscle, equipment and category; favourites and archive.
- Exercise detail: muscles, equipment, instructions, cues, personal records,
  e1RM/volume history charts, per-exercise notes and archive/favourite actions.
- Animated exercise artwork (CC BY-SA 4.0) from Workout Guide by Bryl Lim,
  Everkinetic and GymMane-derived poses, with lazy still thumbnails in list rows.
- Step-by-step "How to perform it" with tips, preferentially from Everkinetic;
  a live form guide (animation + steps) is available inside workouts.

## Progress

- Overview: streak, working sets, hours, PR count, 12-week volume/sets chart,
  30-day daily volume, recent records and muscle heat map.
- Records: searchable PR table with best set, e1RM, date and links to exercise pages.
- Body: bodyweight series, goal line, measurements, add/delete entries.
- Awards: milestone badges with progress bars (streaks, sessions, sets, volume, routines).

## Nutrition

- Date navigation and per-day totals.
- Calorie ring, protein/carbs/fat/fibre/sugar targets and progress.
- Water tracker with configurable glass size.
- Four meal slots; add/delete entries.
- Searchable 561-food catalogue and 27 dishes, per-100 g macros and portion scaling.
- Custom foods with per-100 g macros.
- Editable macro/water goals.

## Journal

- Notes with title/body, type tags (note, plan, done, pain), exercise links and dates.
- Search/filter, pin/edit/delete.

## Gym pass

- Locally stored pass cards: gym name, holder, membership number, entry code, colour.
- Add, edit, delete; copy codes; card-style display.

## Tools (10 calculators)

- Estimated 1RM, BMI, maintenance calories/macros, US Navy body fat, FFMI,
  barbell plate maths, warm-up ramp generator, RPE target load, DOTS, Wilks.

## Settings & data

- Profile, appearance, units, week start, weekly goal.
- Rest timer, auto-rest, auto-advance, beep countdown, mini rest, sound/vibration tests.
- Bar weight and plate inventory for plate maths.
- JSON export/import; CSV workout export; reset all data; persistent-storage request.
- Cloud sync: generate/save code, upload/download/delete encrypted snapshot,
  status and snapshot workout count.
- Install prompt and About/credits.

## PWA & platform

- Web app manifest, maskable PNG icons, Apple touch icon.
- Service worker precaches the app shell and hashed assets; navigations are
  network-first with an offline fallback.
- Dark basalt/terracotta theme, light theme, responsive desktop sidebar and mobile
  bottom navigation.
- No analytics, cookies or third-party pixels. Fonts are loaded from Google Fonts.

## Cloud backend (Cloudflare)

- Single Worker serves `dist/` and the SPA fallback.
- D1 table `sync_snapshots` stores only `id` (SHA-256 of the sync code),
  `payload` (base64 AES-GCM ciphertext), `updated_at` and `bytes`.
- `GET/PUT/DELETE /api/sync/:id`, `GET /api/health`.
- Payload validation, 8 MB cap, `no-store` responses; no plaintext data or account
  identity exists server-side.

## Not rebuilt (yet)

These GymMane features are intentionally out of the current scope. The core
training, routine, progress, library, nutrition, journal and backup flows above
are implemented; the following are the remaining parity gaps.

- Circuit workouts / station rotation.
- Places and equipment-aware exercise filtering (the body map picks by muscle).
- RIR mode (Gymmiie logs RPE) and voice-guided rest.
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

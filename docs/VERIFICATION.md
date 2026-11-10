# Implementation verification

Verified on 10 November 2026 with Node 22 and Chromium, against the production frontend and a real local Worker/D1 runtime.

## Account implementation

- App and Worker typechecks pass, including a separate check for unused locals/parameters.
- 127 unit/runtime tests pass. They cover the existing exercise, storage and backup behavior plus identity normalization, registration gating, sessions, account ownership, SQL revisions, idempotent saves, rate limits, bounded bodies, scoped caches, durable outboxes, and request timeouts.
- 44 desktop/mobile Chromium checks pass. The new cases cover registration rejection/success, returning name/telephone lookup, fresh-browser tracking, A→B→A switching, changed shared cookies, offline edits/reconnection, explicit legacy import, invalid telephone input, session loss, and online/offline sign-out. Existing logging, dialogs, nutrition, membership-code, service-worker update and offline-route checks remain green, including real taps at 320px width.
- Online sign-out uploads the latest draft before leaving. Offline/failed sync offers an explicit choice, retains the account-scoped local copy and locks automatic reopening after sign-out.
- Local storage revisions and emergency journals remain separate from remote account revisions. The durable outbox retries uncertain requests with the same commit ID before sending newer changes. Another tab's changed account cookie cannot redirect an old account's upload.
- Older device data stays under its legacy key until a reviewed import is confirmed. The import does not delete that original device record.
- Wrangler deployment dry-run passes: Worker code is 31.68 KiB, 8.75 KiB gzip. This validates local packaging, not a real database ID, deployed secret or production service.

Named tracking is server-readable D1 data. As requested, name and telephone alone grant returning access; the registration phrase gates creation only. Sessions, origin checks and ownership checks prevent cross-account request mistakes but do not verify telephone ownership. See [Cloudflare deployment](CLOUDFLARE_DEPLOYMENT.md) for the chosen access policy and required environment setup.

The native browser harness serves built frontend assets and dispatches API requests through the real Worker and SQLite D1 binding. Static serving in that harness is a local test server, not Cloudflare's deployed ASSETS service. Production account resources and real registration secrets were not used in testing.

## Exercise audit boundaries

Every one of the 466 exercise IDs has an audit record and structural checks. Independent semantic verification remains partial: 16 instruction sets, four exact exercise/artwork mappings, 19 partially reviewed catalog entries, and 20 logging classifications have supporting review evidence. There are 129 explicitly grouped auto-suggestion candidates and 150 entries with unresolved audit flags.

The complete catalog remains selectable. Unverified bundled instructions and artwork are omitted, with an equipment fallback. Raw candidate content remains available to the tooling for further review, outside the runtime bundle. All 388 retained SVG files keep their original attribution and licenses. See [EXERCISE_REVIEW.md](EXERCISE_REVIEW.md) for sources and field-level status.

## Performance

The original clean HEAD was built in an isolated temporary checkout using the same installed Vite version, with environment-file loading disabled. The current build includes the account feature.

| Initial entry graph | Original | Current |
| --- | ---: | ---: |
| JavaScript and CSS, uncompressed | 1,158,828 bytes | 466,814 bytes |
| JavaScript and CSS, gzip | 247,882 bytes | 121,808 bytes |

This is about a 51% reduction in the compressed initial entry graph. The measurement excludes lazy route chunks; the service worker separately precaches emitted route/data chunks for offline use. It is not a claim that the complete offline installation downloads 51% less data. The earlier pre-account candidate measured 112,751 gzip bytes.

The account-aware interaction benchmark used Chromium at 1280×900, two warmups, ten measured samples per build, and alternating build order. The current app used a real local account session and D1 data; the older baseline used its device-only cache. Medians were:

| Interaction | Original | Current |
| --- | ---: | ---: |
| Search to no results | 163.05 ms | 163.00 ms |
| Clear search to results | 163.60 ms | 163.25 ms |
| Library to Train | 18.35 ms | 17.85 ms |
| Train to Library | 21.30 ms | 22.30 ms |

Search remains dominated by its existing debounce. Differences are small and descriptive; these measurements show no meaningful interaction speedup. Service workers and external fonts were disabled for the benchmark. Cold startup and throttled networks were not measured, and browser regressions ran concurrently on the same machine.

## Reproduce

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm run typecheck
npm test
npm run build
npm run test:e2e -- --workers=1
npm run audit:exercises
npm run measure:build
npm run types:worker -- --check
```

Worker/runtime tests and the browser server require permission to start local workerd processes and loopback sockets. They use a synthetic invitation phrase rather than the deployed secret.

For an ephemeral local UI/API test server after building:

```sh
npm run test:serve
```

This loopback-only test server uses temporary D1 data and test-only fixture routes. Its data is discarded on shutdown; it is not the production deployment.

To repeat the performance comparison, build a separate baseline checkout and run:

```sh
node scripts/benchmark-ui.mjs /path/to/baseline/dist dist 10
```

The benchmark starts isolated API/database instances and authenticates its current-build fixture. Build/type generation disables environment-file loading. Browser traces and screenshots are written under the ignored `test-results` directory.

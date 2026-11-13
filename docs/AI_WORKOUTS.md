# AI workout suggestions

Both features use `@cf/google/gemma-4-26b-a4b-it` through the Worker's `AI` binding. AI requests require an existing signed-in account and same-origin POST. Local/basic exercise suggestions and manual routines continue to work without inference.

## Rollout

`AI_ENABLED` is `"true"` in `wrangler.toml`, so deploying this configuration enables generation. Automated tests use fake inference; they do not verify live model quality or latency. Verify the deployed feature using the existing release workflow:

1. Deploy the change to the intended staging Worker with an AI binding and set `AI_ENABLED="true"` there.
2. Sign in and generate one muscle suggestion and one routine, testing both English and Thai. Confirm valid exercise IDs, useful explanations, editable draft review, and acceptable response times.
3. Confirm no routine is created until Save; start it and verify that weights come from the latest working sets, including an older working workout followed by a warmup-only workout.
4. Check AI usage and metadata-only logs after release. Set `AI_ENABLED` back to `"false"` through the existing configuration/release process to disable generation.

The Free plan has a shared daily Workers AI allowance; per-account application limits are five requests per minute and twenty per UTC day across both features. Requests are not automatically retried. A provider allowance/capacity failure leaves the basic picker available and leaves routine creation unsaved.

## Contract

`POST /api/ai/workout-plan` takes a `suggest` or `routine` request with expected account ID, selected muscles, language, demographic measurements, at most 32 reviewed candidates, and derived favorite/working-history summaries. The server limits the body to 64 KiB and validates both request and model output. It does not store the submitted context or model response.

Suggestions reorder the exact baseline exercise IDs. Routine generation chooses up to eight unique exercises with distinct reviewed movement groups and proposes a name, working-set counts, and rest. Manual review can add other available exercises. Weights are absent from model output and saved routine templates; the existing historical set-prefill path remains authoritative.

The model uses non-streaming JSON schema output with thinking disabled, temperature 0.2, and at most 1,500 completion tokens. Server/client deadlines are 30/35 seconds. Cancelled, superseded, or changed-account/context responses are discarded.

## Verification

Run `npm run typecheck`, `npm test`, `npm run audit:exercises`, `npm run build`, and the focused `e2e/ai-workouts.spec.ts` browser suite. Unit/integration/browser tests use fake inference and do not consume Workers AI quota. The workerd/D1 tests require permission to bind a local listener.

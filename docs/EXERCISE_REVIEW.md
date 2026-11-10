# Exercise catalog review

Review date: 2026-11-10. All 466 exercises retain their original IDs and remain searchable. Existing workouts keep their recorded values. Structural checks cover every entry; semantic review is deliberately reported separately and is incomplete.

## What is approved

| Review area | Reviewed | Remaining |
| --- | ---: | ---: |
| Complete catalog semantics | 0 | 466 |
| Catalog entries with selected fields reviewed | 19 | 447 |
| Instruction sets | 16 | 450 omitted |
| Exact exercise-to-artwork mappings | 4 | 462 omitted |
| Logging classifications checked against primary sources | 20 | 446 retain explicitly labeled legacy classification |

Selected catalog field checks cover primary muscle for 17 entries and equipment/logging mode/load meaning for 18 entries. Secondary muscle lists have not received a complete field-level review. Corrections to selected associations have source references, without implying every remaining tag is correct. Automatic suggestions use 129 explicitly assigned movement groups independently of guide approval.

Reviewed text covers the barbell bench press, barbell back/front squats, bodyweight squat, barbell deadlift, barbell bent-over row, pull-up, standing barbell military press, standing/seated dumbbell shoulder presses, dumbbell lunge, dumbbell lateral raise, cable pushdown, push-up, plank and side plank. Original bench, back-squat and pushdown descriptions omitted the return/pressing phase; their approved guides include a reviewed complete movement. Unapproved originals are not used as a fallback.

Primary references include [NASM bench press](https://www.nasm.org/resource-center/exercise-library/barbell-bench-press), [NASM deadlift](https://www.nasm.org/resource-center/exercise-library/barbell-deadlift), [NASM pull-up](https://www.nasm.org/resource-center/exercise-library/pull-up), [ACE squat variations](https://www.acefitness.org/resources/pros/expert-articles/5875/5-variations-of-the-body-weight-squat/), [NASM squat muscle comparison](https://blog.nasm.org/sports-performance/front-squat-back-squat-choose), [ACE barbell movements](https://www.acefitness.org/resources/pros/expert-articles/3802/ace-total-body-barbell-workout/), [ACE standing shoulder press](https://www.acefitness.org/resources/everyone/exercise-library/71/standing-shoulder-press/), and [NSCA strength and conditioning manual](https://www.nsca.com/contentassets/48a12160221541acbdc048498d77192d/basics_of_strength_and_conditioning_manual.pdf). Each reviewed entry records its exact verification references and date in the manifest.

Treadmill time/distance logging is checked against the [Life Fitness console reference](https://support.lifefitness.com/hc/en-us/articles/42814152246039-Life-Fitness-Atmos-Treadmill-How-to-Use-Your-SL-Console-Guided-Tour); this does not approve general treadmill form instructions. Static towel-hamstring and seated-forward-fold stretches use timed logging based on [ACE's static stretching description](https://www.acefitness.org/resources/everyone/blog/3761/how-to-improve-flexibility-and-maintain-it/).

The four approved artwork mappings are `EIeI8Vf` → flat barbell bench press, `eZyBC3j` → pronated bent-over barbell row, `lBDjFxJ` → unassisted pronated pull-up, and `Kyd9Rz5` → standing front barbell military press. All three frames of each local SVG were rendered and visually inspected for equipment, stance and grip. Approval does not extend to other IDs sharing these slugs. Source vectors retain their Workout Guide attribution and CC BY-SA license.

## Unresolved findings

The manifest lists 150 entries with unresolved flags. Categories overlap: 104 require review of shared artwork, 21 retain fuzzy-match candidates, 26 still have incompatible generated instruction candidates, four have explicit equipment/grip artwork conflicts, and three have suspicious catalog classifications. These are review flags, not a count of all possible semantic defects.

Examples still omitted include Face Pull receiving pull-up instructions, Arnold/Pallof/other presses receiving leg-press instructions, dumbbell preacher curl mapping to a machine, and wide-grip curl mapping to a close-grip illustration. The squat artwork's depth, deadlift range, lunge stepping and plank support variation remain unverified after visual inspection. No animation is shown for these uncertain matches.

## Maintaining the review

- `src/data/exercises.json` and the two `*-candidates.json` files preserve source material for tooling and review. They are excluded from runtime imports.
- `src/data/exercise-review.json` holds an explicit status for every exercise, independent instruction/art decisions, selected field checks, unresolved flags and source references. Changing a shared asset or source attribution never approves another exercise.
- `node scripts/audit-exercises.mjs` checks IDs, taxonomy, source/reference shapes, evidence and approved assets; it reports unresolved coverage separately.
- `node scripts/build-art.mjs` deterministically emits the slim runtime catalog and approved instruction/art indexes. `--check` verifies checked-in artifacts without rewriting them. The application build runs this check.
- Extraction requires review entries for the resulting catalog before replacing source data. The generator cannot approve fuzzy matches and does not need the absent upstream `.reference` checkout.

New session exercise snapshots save optional mode/load meaning. Legacy logs infer their mode from their own recorded metrics and keep unknown load classification unknown. Records use longest hold duration and longest cardio distance (or duration when no distance exists); no pace/racing comparison is inferred. Assistance is not counted as lifted tonnage, and bodyweight added load is not presented as a full-body estimated 1RM.

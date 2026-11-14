/**
 * Idempotent GymMane v2.2.0 parity migration for the built-in exercise catalog.
 *
 * Safe to run repeatedly: existing IDs are never renamed or removed, new fields
 * are only added/replaced deterministically, and new exercises are deduplicated
 * by ID and case-insensitive name before being appended.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = path.join(root, 'src/data/exercises.json');
const reviewPath = path.join(root, 'src/data/exercise-review.json');

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
const byId = new Map(catalog.map((exercise) => [exercise.id, exercise]));

const MUSCLES = [
  'quads',
  'glutes',
  'back',
  'shoulders',
  'chest',
  'abdomen',
  'triceps',
  'biceps',
  'hamstrings',
  'calves',
  'obliques',
  'trapezius',
  'forearm',
  'lowerback',
];
const EQUIPMENT = [
  'Barbell',
  'Dumbbell',
  'Cable',
  'Machine',
  'Bodyweight',
  'Weighted',
  'Band',
  'Kettlebell',
  'Rings',
  'Other',
];

if (catalog.length !== new Set(catalog.map((exercise) => exercise.id)).size)
  throw new Error('Source catalog already contains duplicate IDs.');
for (const exercise of catalog) {
  if (!MUSCLES.includes(exercise.primary))
    throw new Error(`${exercise.id}: invalid primary muscle`);
  if (!EQUIPMENT.includes(exercise.equipment))
    throw new Error(`${exercise.id}: invalid equipment`);
}

function requireExercise(id) {
  const exercise = byId.get(id);
  if (!exercise) throw new Error(`Unknown exercise ID: ${id}`);
  return exercise;
}

function setSecondary(exercise, values) {
  exercise.secondary = [...new Set(values)].filter(
    (muscle) => muscle !== exercise.primary && MUSCLES.includes(muscle),
  );
}

function addToSecondary(exercise, muscle) {
  if (muscle !== exercise.primary && !exercise.secondary.includes(muscle))
    exercise.secondary.push(muscle);
}

// ---------------------------------------------------------------------------
// Phase 1: muscle mappings, names, steps and artwork corrections
// ---------------------------------------------------------------------------
const muscleFixes = {
  CqhoytW: {
    primary: 'glutes',
    secondary: ['hamstrings', 'quads'],
  },
  SGY8Zui: {
    primary: 'shoulders',
    secondary: ['triceps', 'quads', 'glutes'],
  },
  iPm26QU: {
    primary: 'quads',
    secondary: ['glutes', 'hamstrings', 'calves'],
  },
};
for (const [id, fix] of Object.entries(muscleFixes)) {
  const exercise = requireExercise(id);
  exercise.primary = fix.primary;
  setSecondary(exercise, fix.secondary);
}

const movementQuadsFixes = [
  'qXTaZnJ',
  'zG0zs85',
  'vR1vold',
  'NNoHCEA',
  'ZuPXtCK',
  '5VCj6iH',
  'mnzcrIB',
  'wfotm7S',
  'RRWFUcw',
  'ecl28tP',
];
for (const id of movementQuadsFixes) {
  const exercise = requireExercise(id);
  exercise.primary = 'quads';
  setSecondary(exercise, [
    'glutes',
    'hamstrings',
    'calves',
    ...exercise.secondary,
  ]);
}

const cossack = requireExercise('GWoKnIm');
cossack.primary = 'glutes';
cossack.secondary = [
  'quads',
  ...cossack.secondary.filter((muscle) => muscle !== 'quads'),
];

// Every chest press, push-up and dip needs the shoulder stabilisers listed.
for (const exercise of catalog) {
  if (
    exercise.primary === 'chest' &&
    /press|push-up|push up|dip/i.test(exercise.name)
  )
    addToSecondary(exercise, 'shoulders');
}

const rollerout = requireExercise('7M66AVi');
rollerout.name = 'Barbell Rollout';
rollerout.aliases = [
  ...new Set([
    ...(rollerout.aliases ?? []),
    'Barbell Ab Rollout',
    'Barbell Rollerout',
  ]),
];

const benchPullups = requireExercise('mExgrF9');
benchPullups.name = 'Inverted Row';
benchPullups.aliases = [
  ...new Set([
    ...(benchPullups.aliases ?? []),
    'Bench Pull-ups',
    'Bodyweight Row',
  ]),
];

const scapulaDips = requireExercise('7xeukSt');
scapulaDips.steps = [
  'Set up on parallel bars or a sturdy bench with your arms straight and your feet supported.',
  'Without bending your elbows, let your shoulder blades rise toward your ears.',
  'Push down through your hands to depress and retract your shoulder blades, lifting your torso slightly.',
  'Pause at the top with your shoulders pulled away from your ears, then relax back to the start under control.',
  'Keep your elbows straight throughout and use a slow, small range of motion.',
];

requireExercise('LNE3wfo').art = 'hamstring-stretch';
requireExercise('ywaNfuh').art = 'standing-calf-raise';

// ---------------------------------------------------------------------------
// Phase 4 data: missing commercial-gym staples. Existing ID/name collisions
// are skipped below, so the list may be run more than once safely.
// ---------------------------------------------------------------------------
const newExercises = [
  {
    id: 'seated-calf-raise-machine',
    name: 'Seated Calf Raise',
    primary: 'calves',
    secondary: ['hamstrings'],
    equipment: 'Machine',
    difficulty: 'Beginner',
    art: 'seated-calf-raise',
    steps: [
      'Sit on the seated calf raise machine and place the balls of your feet on the platform with your heels hanging off.',
      'Lower the safety pad onto your thighs and release the weight.',
      'Let your heels drop until you feel a stretch through your calves.',
      'Press through the balls of your feet to raise your heels as high as possible.',
      'Pause at the top, then lower under control.',
    ],
  },
  {
    id: 'barbell-walking-lunge',
    name: 'Barbell Walking Lunge',
    primary: 'quads',
    secondary: ['glutes', 'hamstrings', 'calves'],
    equipment: 'Barbell',
    difficulty: 'Intermediate',
    art: 'walking-lunge',
    steps: [
      'Stand tall with a barbell across your upper back and brace your torso.',
      'Step forward into a lunge until both knees are bent to about 90 degrees.',
      'Drive through the front foot to stand up and bring the back foot forward into the next lunge.',
      'Continue alternating steps while keeping your torso upright and knees tracking over your toes.',
    ],
  },
  {
    id: 'sled-push',
    name: 'Sled Push',
    primary: 'quads',
    secondary: ['glutes', 'hamstrings', 'calves'],
    equipment: 'Other',
    difficulty: 'Intermediate',
    art: '',
    steps: [
      'Load the sled and grip the uprights with your arms extended.',
      'Set a low body angle with your feet under your hips and brace your core.',
      'Drive the sled forward with short, powerful steps while keeping your back flat.',
      'Push for the target distance, then walk back to recover.',
    ],
  },
  {
    id: 'sled-pull',
    name: 'Sled Pull',
    primary: 'quads',
    secondary: ['glutes', 'hamstrings', 'back'],
    equipment: 'Other',
    difficulty: 'Intermediate',
    art: '',
    steps: [
      'Attach a harness or handle to the sled and face away from it.',
      'Lean forward slightly and drive through your legs to walk the sled forward.',
      'Keep your arms relaxed and take controlled steps without jerking the load.',
      'Continue for the target distance or time.',
    ],
  },
  {
    id: 'barbell-floor-press',
    name: 'Barbell Floor Press',
    primary: 'chest',
    secondary: ['triceps', 'shoulders'],
    equipment: 'Barbell',
    difficulty: 'Intermediate',
    art: 'bench-press',
    steps: [
      'Lie on the floor with your knees bent and a barbell positioned over your chest.',
      'Grip the bar slightly wider than shoulder-width and tuck your elbows.',
      'Lower the bar until your upper arms touch the floor.',
      'Pause briefly, then press the bar back up until your arms are straight.',
    ],
  },
  {
    id: 'dumbbell-floor-press',
    name: 'Dumbbell Floor Press',
    primary: 'chest',
    secondary: ['triceps', 'shoulders'],
    equipment: 'Dumbbell',
    difficulty: 'Beginner',
    art: 'dumbbell-bench-press',
    steps: [
      'Lie on the floor with a dumbbell in each hand and your knees bent.',
      'Press the dumbbells over your chest with your palms facing forward.',
      'Lower them under control until your upper arms rest on the floor.',
      'Press back up without letting the dumbbells drift together.',
    ],
  },
  {
    id: 'low-to-high-cable-fly',
    name: 'Low-to-High Cable Fly',
    primary: 'chest',
    secondary: ['shoulders'],
    equipment: 'Cable',
    difficulty: 'Beginner',
    art: 'cable-fly',
    steps: [
      'Set both pulleys to the lowest position and grab the handles.',
      'Stand in the middle of the cables with a slight forward lean.',
      'Sweep the handles upward and inward until your hands meet in front of your upper chest.',
      'Lower under control and keep a soft bend in your elbows.',
    ],
  },
  {
    id: 'high-to-low-cable-fly',
    name: 'High-to-Low Cable Fly',
    primary: 'chest',
    secondary: ['shoulders', 'triceps'],
    equipment: 'Cable',
    difficulty: 'Intermediate',
    art: 'cable-fly',
    steps: [
      'Set both pulleys above shoulder height and grab the handles.',
      'Step forward into a split stance with your chest tall.',
      'Pull the handles down and inward until they meet in front of your lower chest.',
      'Return slowly while keeping tension on the cables.',
    ],
  },
  {
    id: 'chest-supported-t-bar-row',
    name: 'Chest-Supported T-Bar Row',
    primary: 'back',
    secondary: ['biceps', 'forearm'],
    equipment: 'Machine',
    difficulty: 'Intermediate',
    art: 'chest-supported-row',
    steps: [
      'Set the chest pad at mid-chest height and load the T-bar.',
      'Lie with your chest against the pad and grip the handles.',
      'Pull the handles toward your ribs while squeezing your shoulder blades together.',
      'Lower under control until your arms are straight.',
    ],
  },
  {
    id: 'seal-row',
    name: 'Seal Row',
    primary: 'back',
    secondary: ['biceps', 'forearm'],
    equipment: 'Barbell',
    difficulty: 'Advanced',
    art: 'chest-supported-row',
    steps: [
      'Lie face down on a bench with a barbell on the floor beneath you.',
      'Grip the bar with an overhand grip and pull it toward the bench.',
      'Squeeze your shoulder blades together at the top.',
      'Lower the bar under control without letting your chest leave the bench.',
    ],
  },
  {
    id: 'machine-pullover',
    name: 'Machine Pullover',
    primary: 'back',
    secondary: ['chest', 'triceps'],
    equipment: 'Machine',
    difficulty: 'Intermediate',
    art: 'dumbbell-pullover',
    steps: [
      'Adjust the seat and pad so the handles sit above your head.',
      'Grip the handles with your arms extended and your torso supported.',
      'Pull the handles down and back toward your waist in an arc.',
      'Return slowly until you feel a stretch through your lats.',
    ],
  },
  {
    id: 'straight-arm-lat-pulldown',
    name: 'Straight-Arm Lat Pulldown',
    primary: 'back',
    secondary: ['triceps', 'abdomen'],
    equipment: 'Cable',
    difficulty: 'Intermediate',
    art: 'straight-arm-pulldown',
    steps: [
      'Attach a straight bar or rope to a high pulley and step back.',
      'Hinge slightly at the hips with your arms extended overhead.',
      'Keep your elbows almost straight and pull the handle down to your thighs.',
      'Return slowly until your arms are overhead again.',
    ],
  },
  {
    id: 'lu-raise',
    name: 'Lu Raise',
    primary: 'shoulders',
    secondary: ['trapezius'],
    equipment: 'Dumbbell',
    difficulty: 'Intermediate',
    art: 'lateral-raise',
    steps: [
      'Stand with a dumbbell in each hand at your sides.',
      'Raise the dumbbells forward to shoulder height with your thumbs up.',
      'Continue the arc out to the sides while keeping your elbows slightly bent.',
      'Lower the dumbbells back to your sides along the same path.',
    ],
  },
  {
    id: 'z-press',
    name: 'Z Press',
    primary: 'shoulders',
    secondary: ['triceps', 'abdomen'],
    equipment: 'Barbell',
    difficulty: 'Advanced',
    art: 'overhead-press',
    steps: [
      'Sit on the floor with your legs extended and a barbell at shoulder height.',
      'Brace your torso and grip the bar just outside shoulder-width.',
      'Press the bar overhead without leaning back or using your legs.',
      'Lower the bar to your shoulders under control.',
    ],
  },
  {
    id: 'ez-bar-curl',
    name: 'EZ-Bar Curl',
    primary: 'biceps',
    secondary: ['forearm'],
    equipment: 'Barbell',
    difficulty: 'Beginner',
    art: 'ez-bar-curl',
    steps: [
      'Stand with an EZ-bar loaded and grip the angled sections with your palms up.',
      'Keep your elbows close to your sides and your torso still.',
      'Curl the bar up toward your shoulders by bending your elbows.',
      'Squeeze your biceps, then lower the bar slowly to the start.',
    ],
    aliases: ['EZ Bar Curl', 'EZ-Bar Bicep Curl'],
  },
  {
    id: 'ez-bar-skullcrusher',
    name: 'EZ-Bar Skullcrusher',
    primary: 'triceps',
    secondary: ['forearm'],
    equipment: 'Barbell',
    difficulty: 'Intermediate',
    art: 'skull-crusher',
    steps: [
      'Lie on a bench holding an EZ-bar over your chest with your arms straight.',
      'Bend your elbows to lower the bar toward your forehead.',
      'Keep your upper arms still and your elbows pointed toward the ceiling.',
      'Extend your elbows to press the bar back up.',
    ],
    aliases: ['EZ Bar Skullcrusher', 'Skullcrusher (EZ-Bar)'],
  },
  {
    id: 'ez-bar-preacher-curl',
    name: 'EZ-Bar Preacher Curl',
    primary: 'biceps',
    secondary: ['forearm'],
    equipment: 'Barbell',
    difficulty: 'Beginner',
    art: 'preacher-curl',
    steps: [
      'Set your upper arms against the preacher pad and grip an EZ-bar.',
      'Curl the bar up while keeping your upper arms in contact with the pad.',
      'Squeeze at the top without letting your shoulders roll forward.',
      'Lower the bar slowly until your arms are almost straight.',
    ],
    aliases: ['EZ Bar Preacher Curl'],
  },
  {
    id: 'machine-preacher-curl',
    name: 'Machine Preacher Curl',
    primary: 'biceps',
    secondary: ['forearm'],
    equipment: 'Machine',
    difficulty: 'Beginner',
    art: 'preacher-curl',
    steps: [
      'Adjust the seat so your upper arms rest on the pad.',
      'Grip the handles with your palms facing up and keep your back against the support.',
      'Curl the handles toward your shoulders.',
      'Lower under control until your arms are almost straight.',
    ],
  },
  {
    id: 'bayesian-cable-curl',
    name: 'Bayesian Cable Curl',
    primary: 'biceps',
    secondary: ['forearm'],
    equipment: 'Cable',
    difficulty: 'Intermediate',
    art: 'cable-curl',
    steps: [
      'Set a single pulley to the lowest position and attach a handle.',
      'Face away from the machine and step forward with your arm extended behind you.',
      'Curl the handle toward your shoulder while keeping your elbow still.',
      'Lower slowly and repeat with the same arm before switching sides.',
    ],
  },
  {
    id: 'crossbody-cable-triceps-extension',
    name: 'Crossbody Cable Triceps Extension',
    primary: 'triceps',
    secondary: ['shoulders'],
    equipment: 'Cable',
    difficulty: 'Intermediate',
    art: 'single-arm-cable-pushdown',
    steps: [
      'Set a single pulley at upper-chest height and grab the handle.',
      'Turn your body slightly and bring your working arm across your chest.',
      'Extend your elbow until your arm is straight while keeping your upper arm still.',
      'Bend your elbow slowly and repeat before switching sides.',
    ],
  },
  {
    id: 'ab-wheel-rollout',
    name: 'Ab Wheel Rollout',
    primary: 'abdomen',
    secondary: ['lowerback', 'back', 'shoulders'],
    equipment: 'Other',
    difficulty: 'Advanced',
    art: 'ab-wheel',
    steps: [
      'Kneel on a pad and grip the ab wheel handles beneath your shoulders.',
      'Brace your core and slowly roll the wheel forward.',
      'Extend as far as you can while keeping your lower back from sagging.',
      'Pull the wheel back toward your knees using your abs.',
    ],
  },
  {
    id: 'toes-to-bar',
    name: 'Toes-to-Bar',
    primary: 'abdomen',
    secondary: ['forearm', 'back'],
    equipment: 'Bodyweight',
    difficulty: 'Advanced',
    art: 'hanging-leg-raise',
    steps: [
      'Hang from a pull-up bar with an overhand grip and your legs together.',
      'Brace your core and raise your legs while keeping them straight.',
      'Bring your toes toward the bar without swinging.',
      'Lower your legs under control to a dead hang.',
    ],
  },
  {
    id: 'dumbbell-farmers-walk',
    name: 'Dumbbell Farmers Walk',
    primary: 'forearm',
    secondary: ['abdomen', 'trapezius', 'quads'],
    equipment: 'Dumbbell',
    difficulty: 'Beginner',
    art: 'farmer-carry',
    steps: [
      'Stand between two dumbbells and hinge to pick them up with a flat back.',
      'Stand tall with your shoulders back and core braced.',
      'Walk with short, controlled steps while keeping the weights from swinging.',
      'Continue for the target time or distance.',
    ],
    aliases: ["Farmer's Walk", 'Farmers Carry', 'Dumbbell Farmer Carry'],
  },
  {
    id: 'suitcase-carry',
    name: 'Suitcase Carry',
    primary: 'obliques',
    secondary: ['forearm', 'glutes', 'quads'],
    equipment: 'Dumbbell',
    difficulty: 'Beginner',
    art: 'farmer-carry',
    steps: [
      'Pick up a single dumbbell with one hand and stand tall.',
      'Keep your shoulders level and resist leaning toward the weight.',
      'Walk with controlled steps while bracing your obliques.',
      'Switch hands after the target time or distance.',
    ],
  },
  {
    id: 'power-clean',
    name: 'Power Clean',
    primary: 'quads',
    secondary: ['glutes', 'hamstrings', 'back', 'shoulders', 'trapezius'],
    equipment: 'Barbell',
    difficulty: 'Advanced',
    art: '',
    steps: [
      'Stand with the bar over mid-foot and hinge to grip it just outside your shins.',
      'Drive through your legs and extend your hips explosively.',
      'Pull yourself under the bar and catch it on your front shoulders.',
      'Stand up, then lower the bar to the floor under control.',
    ],
  },
  {
    id: 'barbell-clean-and-jerk',
    name: 'Barbell Clean and Jerk',
    primary: 'quads',
    secondary: [
      'glutes',
      'hamstrings',
      'shoulders',
      'triceps',
      'trapezius',
    ],
    equipment: 'Barbell',
    difficulty: 'Advanced',
    art: '',
    steps: [
      'Set up over the bar with your back flat and grip just outside your shins.',
      'Clean the bar to your front shoulders and stand up.',
      'Dip slightly, then drive the bar overhead into a split or push jerk.',
      'Recover to standing, then lower the bar safely.',
    ],
  },
  {
    id: 'barbell-snatch',
    name: 'Barbell Snatch',
    primary: 'quads',
    secondary: ['glutes', 'hamstrings', 'back', 'shoulders', 'trapezius'],
    equipment: 'Barbell',
    difficulty: 'Advanced',
    art: '',
    steps: [
      'Stand over the bar with a wide grip and your shins close to it.',
      'Drive through your legs and extend your hips to accelerate the bar.',
      'Pull yourself under the bar and catch it overhead with locked arms.',
      'Stand up fully, then lower the bar under control.',
    ],
  },
  {
    id: 'barbell-thruster',
    name: 'Barbell Thruster',
    primary: 'quads',
    secondary: ['shoulders', 'glutes', 'triceps'],
    equipment: 'Barbell',
    difficulty: 'Intermediate',
    art: 'push-press',
    steps: [
      'Hold a barbell on your front shoulders with your elbows high.',
      'Squat down until your thighs are near parallel.',
      'Drive up explosively and use the momentum to press the bar overhead.',
      'Lower the bar back to your shoulders and repeat.',
    ],
  },
  {
    id: 'dumbbell-thruster',
    name: 'Dumbbell Thruster',
    primary: 'quads',
    secondary: ['shoulders', 'glutes', 'triceps'],
    equipment: 'Dumbbell',
    difficulty: 'Beginner',
    art: 'push-press',
    steps: [
      'Hold a dumbbell at each shoulder with your elbows bent.',
      'Squat down while keeping your chest tall.',
      'Drive up and press the dumbbells overhead in one smooth motion.',
      'Lower the dumbbells to your shoulders and repeat.',
    ],
  },
  {
    id: 'turkish-get-up',
    name: 'Turkish Get-Up',
    primary: 'shoulders',
    secondary: ['abdomen', 'glutes', 'quads', 'hamstrings'],
    equipment: 'Kettlebell',
    difficulty: 'Advanced',
    art: '',
    steps: [
      'Lie on your back and press a kettlebell overhead with one arm.',
      'Bend the same-side knee and roll onto your opposite elbow.',
      'Keep the kettlebell stacked over your shoulder as you move to a kneeling position.',
      'Stand up, reverse the sequence, and switch sides.',
    ],
  },
  {
    id: 'box-jump',
    name: 'Box Jump',
    primary: 'quads',
    secondary: ['glutes', 'hamstrings', 'calves'],
    equipment: 'Bodyweight',
    difficulty: 'Intermediate',
    art: 'jump-squat',
    steps: [
      'Stand in front of a sturdy box with your feet hip-width apart.',
      'Hinge and swing your arms back, then jump onto the box.',
      'Land softly with your knees bent and your chest up.',
      'Step down and reset before the next jump.',
    ],
  },
  {
    id: 'wall-ball',
    name: 'Wall Ball',
    primary: 'quads',
    secondary: ['shoulders', 'glutes', 'calves'],
    equipment: 'Other',
    difficulty: 'Intermediate',
    art: '',
    steps: [
      'Hold a medicine ball at your chest and stand facing a wall.',
      'Squat down while keeping the ball close to your body.',
      'Drive up and throw the ball to a target on the wall.',
      'Catch the ball and flow into the next squat.',
    ],
  },
  {
    id: 'barbell-hip-thrust',
    name: 'Barbell Hip Thrust',
    primary: 'glutes',
    secondary: ['hamstrings', 'quads'],
    equipment: 'Barbell',
    difficulty: 'Intermediate',
    art: 'hip-thrust',
    steps: [
      'Sit on the floor with your upper back against a bench and a padded barbell over your hips.',
      'Plant your feet flat and brace your core.',
      'Drive through your heels to lift your hips until your body is straight.',
      'Squeeze your glutes at the top, then lower under control.',
    ],
  },
  {
    id: 'incline-cable-fly',
    name: 'Incline Cable Fly',
    primary: 'chest',
    secondary: ['shoulders'],
    equipment: 'Cable',
    difficulty: 'Intermediate',
    art: 'incline-cable-fly',
    steps: [
      'Set the pulleys low and position an incline bench between them.',
      'Lie back on the bench and grab the handles with your arms out.',
      'Bring the handles together over your upper chest in a wide arc.',
      'Lower slowly until you feel a stretch across your chest.',
    ],
  },
  {
    id: 'v-bar-pushdown',
    name: 'V-Bar Pushdown',
    primary: 'triceps',
    secondary: ['forearm'],
    equipment: 'Cable',
    difficulty: 'Beginner',
    art: 'v-bar-pushdown',
    steps: [
      'Attach a V-bar to a high pulley and grip it with your palms facing down.',
      'Keep your elbows tucked at your sides and your torso upright.',
      'Push the handle down until your arms are straight.',
      'Let your elbows bend slowly to return to the start.',
    ],
  },
  {
    id: 'chest-supported-dumbbell-row',
    name: 'Chest-Supported Dumbbell Row',
    primary: 'back',
    secondary: ['biceps', 'forearm'],
    equipment: 'Dumbbell',
    difficulty: 'Intermediate',
    art: 'chest-supported-row',
    steps: [
      'Set an incline bench to about 45 degrees and lie chest down.',
      'Hold a dumbbell in each hand with your arms hanging straight down.',
      'Row the dumbbells toward your hips while squeezing your shoulder blades.',
      'Lower them slowly until your arms are extended.',
    ],
  },
];

const existingNames = new Set(
  catalog.map((exercise) => exercise.name.trim().toLowerCase()),
);
for (const exercise of newExercises) {
  if (
    byId.has(exercise.id) ||
    existingNames.has(exercise.name.trim().toLowerCase())
  )
    continue;
  const entry = {
    id: exercise.id,
    name: exercise.name,
    primary: exercise.primary,
    secondary: [...new Set(exercise.secondary)],
    equipment: exercise.equipment,
    difficulty: exercise.difficulty,
    art: exercise.art,
    steps: exercise.steps,
    mode: '',
    aliases: [...new Set(exercise.aliases ?? [])],
    kind: '',
  };
  catalog.push(entry);
  byId.set(entry.id, entry);
  existingNames.add(entry.name.trim().toLowerCase());
}

// ---------------------------------------------------------------------------
// Phase 2: kind, mode, unilateral and sub-equipment
// ---------------------------------------------------------------------------
const CARDIO_IDS = new Set([
  'rowing',
  'skierg',
  'swimming',
  'battle-ropes',
  'running',
  'walking',
  'treadmill-incline-walk',
  'hiking',
  'cycling',
  'assault-bike',
  'elliptical',
  'stair-climber',
  'jump-rope',
  'outdoor-run',
  'outdoor-cycling',
  'outdoor-walk',
  'outdoor-hike',
  'swim',
  'mweqJin',
]);
const MOBILITY_IDS = new Set([
  'childs-pose',
  'yuris-shoulder-band-warmup',
  'wrist-prep',
  'leg-swings-stretch',
]);
const DISTANCE_DURATION_IDS = new Set([
  'running',
  'walking',
  'treadmill-incline-walk',
  'hiking',
  'cycling',
  'assault-bike',
  'elliptical',
  'rowing',
  'skierg',
  'swimming',
  'stair-climber',
  'outdoor-run',
  'outdoor-cycling',
  'outdoor-walk',
  'outdoor-hike',
  'swim',
]);
const DURATION_HOLD_IDS = new Set([
  'active-hang',
  'superman-hold',
  'hollow-body-hold',
  'bear-plank',
  'l-sit-hold',
  'rNGclsi',
  'rNGdsup',
  'wall-sit',
  'plank-hold',
  'side-plank-hold',
  'dead-hang-hold',
  'arch-hang',
  'parallel-bar-support-hold',
]);
const WEIGHT_DURATION_IDS = new Set([
  'VBAWRPG',
  'cable-pallof-hold',
  'kettlebell-farmer-carry',
  'dumbbell-farmers-walk',
  'suitcase-carry',
]);
const ASSISTED_IDS = new Set([
  'kiJ4Z2K',
  '7OeHptV',
  'PAgTVaK',
  'assisted-pistol-squat',
  'assisted-squat',
]);

function kindFor(exercise) {
  if (exercise.kind === 'sport') return 'sport';
  if (CARDIO_IDS.has(exercise.id)) return 'cardio';
  if (
    MOBILITY_IDS.has(exercise.id) ||
    /stretch/i.test(`${exercise.name} ${exercise.id}`)
  )
    return 'mobility';
  return 'strength';
}

function modeForKind(exercise, kind) {
  if (ASSISTED_IDS.has(exercise.id)) return 'assisted_bodyweight';
  if (DISTANCE_DURATION_IDS.has(exercise.id)) return 'distance_duration';
  if (kind === 'sport' || kind === 'mobility') return 'duration';
  if (
    exercise.id === 'battle-ropes' ||
    exercise.id === 'jump-rope' ||
    exercise.id === 'mweqJin'
  )
    return 'duration';
  if (DURATION_HOLD_IDS.has(exercise.id)) return 'duration';
  if (WEIGHT_DURATION_IDS.has(exercise.id)) return 'weight_duration';
  if (exercise.id === 'ab-wheel-rollout') return 'bodyweight_reps';
  if (['Bodyweight', 'Rings'].includes(exercise.equipment))
    return 'bodyweight_reps';
  return 'weight_reps';
}

const UNILATERAL_PATTERN =
  /single[- ]?(arm|leg)|one[- ]?(arm|leg)|unilateral|split squat|lunge|step-up|step-down|pistol|shrimp|skater squat|concentration|side plank|side bend|side[- ]lying|contralateral|woodchop|archer|kickback/i;

for (const exercise of catalog) {
  exercise.kind = kindFor(exercise);
  exercise.mode = modeForKind(exercise, exercise.kind);
  exercise.unilateral = UNILATERAL_PATTERN.test(
    `${exercise.name} ${exercise.id}`,
  );
  const name = exercise.name.toLowerCase();
  if (exercise.equipment === 'Machine' && name.startsWith('smith '))
    exercise.sub_equipment = 'Smith Machine';
  else if (exercise.id === 'trap-bar-deadlift')
    exercise.sub_equipment = 'Trap Bar';
  else if (/(^|\s)ez[- ]?bar(\s|$)/i.test(exercise.name))
    exercise.sub_equipment = 'EZ-Bar';
  else exercise.sub_equipment = null;
}

// ---------------------------------------------------------------------------
// Phase 3: aliases and similar movements
// ---------------------------------------------------------------------------
const explicitAliases = {
  qXTaZnJ: ['Back Squat', 'Barbell Squat', 'Squat (Barbell)'],
  Kyd9Rz5: [
    'Overhead Press',
    'OHP',
    'Military Press',
    'Overhead Press (Barbell)',
  ],
  RVwzP10: [
    'Lat Pulldown',
    'Lat Pulldown (Cable)',
    'Wide-Grip Lat Pulldown',
  ],
  iZop9xO: [
    'Skullcrusher',
    'Skull Crusher',
    'Skullcrusher (Barbell)',
    'French Press',
  ],
  WLvTAv5: ['Spider Curl', 'Spider Curl (Barbell)'],
  myfUsKf: ['Reverse Pec Deck', 'Rear Delt Fly (Machine)'],
  '0CXGHya': ['Cable Fly', 'Cable Chest Fly'],
  '7vG5o25': ['Chest-Supported Dumbbell Row', 'Chest-Supported Row'],
  x6KpKpq: ['Diamond Push-up', 'Triangle Push-up'],
  VO2qeJg: ['Copenhagen Plank'],
  qx4fgX7: [
    'Dumbbell Bulgarian Split Squat',
    'Bulgarian Split Squat (Dumbbell)',
  ],
  '3ZflifB': ['Triceps Pushdown', 'Tricep Pushdown (Cable)'],
  ila4NZS: ['Deadlift', 'Deadlift (Barbell)', 'Conventional Deadlift'],
  wQ2c4XD: ['Romanian Deadlift', 'RDL', 'Romanian Deadlift (Barbell)'],
  lBDjFxJ: ['Pull Up', 'Pull-Up'],
  T2mxWqc: ['Chin Up', 'Chin-Up'],
  DsgkuIt: ['Lateral Raise', 'Side Lateral Raise', 'Lateral Raise (Dumbbell)'],
  NbVPDMW: ['Bicep Curl', 'Biceps Curl', 'Bicep Curl (Dumbbell)'],
  C5jncD2: ['Leg Curl', 'Lying Leg Curl (Machine)'],
  '8ozhUIZ': ['Calf Raise', 'Standing Calf Raise'],
  ezbar: ['EZ Bar Curl'],
};

function cleanAliases(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const alias = String(value ?? '').trim();
    const key = alias.toLowerCase();
    if (!alias || seen.has(key)) continue;
    seen.add(key);
    out.push(alias);
  }
  return out;
}

function titleCase(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const EQUIPMENT_PREFIXES = [
  'Barbell',
  'Dumbbell',
  'Cable',
  'Machine',
  'Kettlebell',
  'Band',
];

for (const exercise of catalog) {
  const aliases = [...(exercise.aliases ?? [])];
  for (const alias of explicitAliases[exercise.id] ?? []) aliases.push(alias);

  const match = exercise.name.match(
    /^(Barbell|Dumbbell|Cable|Machine|Kettlebell|Band)\s+(.+)$/,
  );
  if (match && EQUIPMENT_PREFIXES.includes(match[1]))
    aliases.push(`${match[2]} (${match[1]})`);

  if (exercise.art) {
    const artName = titleCase(exercise.art);
    const normalize = (value) =>
      value.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (normalize(artName) !== normalize(exercise.name)) aliases.push(artName);
  }

  const canonical = cleanAliases([
    ...aliases.filter(
      (alias) => alias.toLowerCase() !== exercise.name.toLowerCase(),
    ),
  ]);
  exercise.aliases = canonical;

  const candidate = similarCandidates(exercise);
  exercise.similar_ids = candidate;
}

function similarCandidates(exercise) {
  const normalized = (value) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const scored = [];
  for (const other of catalog) {
    if (other.id === exercise.id) continue;
    let score = 0;
    if (exercise.art && other.art === exercise.art) score += 1000;
    if (other.primary === exercise.primary && other.kind === exercise.kind) {
      score += 100;
      score +=
        10 *
        other.secondary.filter((muscle) => exercise.secondary.includes(muscle))
          .length;
      if (other.equipment !== exercise.equipment) score += 5;
    } else if (other.primary === exercise.primary) {
      score += 50;
      score +=
        5 *
        other.secondary.filter((muscle) => exercise.secondary.includes(muscle))
          .length;
    } else if (
      other.kind === exercise.kind &&
      other.secondary.includes(exercise.primary)
    ) {
      score += 20;
    }
    if (!score) continue;
    if (normalized(other.name) === normalized(exercise.name)) continue;
    scored.push({ id: other.id, score, name: other.name });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 6)
    .map((entry) => entry.id);
}

// ---------------------------------------------------------------------------
// Review manifest: keep every new catalog entry auditable and correct any
// reviewed overrides that would otherwise undo the source data fixes.
// ---------------------------------------------------------------------------
const reviewTemplate = () => ({
  catalog: {
    status: 'unverified',
    flags: [],
    reviewedFields: [],
  },
  instructions: { status: 'unverified' },
  art: { status: 'unverified' },
  logging: {
    mode: '',
    basis: 'gymmane-v2.2.0-taxonomy-migration',
    loadKind: 'external',
    status: 'legacy',
  },
});
for (const exercise of catalog) {
  if (!review.exercises[exercise.id])
    review.exercises[exercise.id] = reviewTemplate();
}

const overrideFixes = {
  CqhoytW: { primary: 'glutes', secondary: ['hamstrings', 'quads'] },
  qXTaZnJ: { primary: 'quads', secondary: ['glutes', 'hamstrings', 'calves'] },
  zG0zs85: { primary: 'quads', secondary: ['glutes', 'hamstrings', 'calves'] },
};
for (const [id, override] of Object.entries(overrideFixes)) {
  const entry = review.exercises[id];
  entry.catalog.overrides = { ...(entry.catalog.overrides ?? {}), ...override };
}
// EIeI8Vf's reviewed override already matches the new source data.
if (review.exercises.EIeI8Vf?.catalog?.overrides)
  review.exercises.EIeI8Vf.catalog.overrides.secondary = [
    'triceps',
    'shoulders',
  ];

function loadKindForExercise(exercise) {
  if (exercise.mode === 'assisted_bodyweight') return 'assistance';
  if (exercise.mode === 'bodyweight_reps') return 'added';
  if (exercise.mode === 'distance_duration') return 'none';
  if (exercise.mode === 'weight_duration') return 'external';
  if (exercise.mode === 'weight_reps') return 'external';
  if (exercise.mode === 'duration') {
    if (
      exercise.kind === 'strength' &&
      ['Bodyweight', 'Rings'].includes(exercise.equipment)
    )
      return 'added';
    return 'none';
  }
  return 'external';
}
for (const exercise of catalog) {
  const logging = review.exercises[exercise.id].logging;
  logging.loadKind = loadKindForExercise(exercise);
  if (!logging.basis)
    logging.basis = 'existing-id-mode-list-and-declared-equipment';
  if (!['reviewed', 'legacy'].includes(logging.status))
    logging.status = 'legacy';
}

review.structuralAudit = `All ${catalog.length} IDs and source/reference shapes checked by scripts/audit-exercises.mjs. Original 466 IDs are preserved by scripts/patch-exercises.mjs. No statement of complete semantic or professional verification.`;

// ---------------------------------------------------------------------------
// Write files
// ---------------------------------------------------------------------------
fs.writeFileSync(catalogPath, JSON.stringify(catalog));
fs.writeFileSync(reviewPath, JSON.stringify(review, null, 1));

const counts = {
  total: catalog.length,
  added: catalog.length - 466,
  kinds: {},
  modes: {},
  unilateral: catalog.filter((exercise) => exercise.unilateral).length,
  withArt: catalog.filter((exercise) => exercise.art).length,
};
for (const exercise of catalog) {
  counts.kinds[exercise.kind] = (counts.kinds[exercise.kind] ?? 0) + 1;
  counts.modes[exercise.mode] = (counts.modes[exercise.mode] ?? 0) + 1;
}
console.log(JSON.stringify(counts, null, 2));

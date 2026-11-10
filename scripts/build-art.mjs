/**
 * Build exercise animation assets for Gymmiie.
 *
 * Sources (CC BY-SA 4.0, see NOTICE.md):
 *  - Workout Guide by Bryl Lim (bryllim/workout-guide): 302 exercises × 3 normalized 512×512 frames
 *  - Everkinetic (everkinetic/data): 2-frame SVGs + canonical step-by-step instructions
 *  - GymMane assets/art (InlitX, Everkinetic-derived): frame path data used as a last-resort fallback
 *
 * Produces:
 *  - public/art/<art-slug>.svg        one compact SVG per exercise motion, all frames inline
 *  - src/data/art.json                per-slug animation index (frame count, provenance)
 *  - src/data/instructions.json       Everkinetic step-by-step instructions keyed by exercise id
 *  - public/art/ATTRIBUTION.md        per-slug provenance report
 */
import fs from 'node:fs';
import path from 'node:path';
import svgPathBounds from 'svg-path-bounds';

const ROOT = process.cwd();
const WG = path.join(ROOT, '.reference/workout-guide/packages/workout-guide');
const EK = path.join(ROOT, '.reference/everkinetic');
const GG = path.join(ROOT, '.reference/gymmane/assets/art');
const OUT_SVG = path.join(ROOT, 'public/art');
const OUT_DATA = path.join(ROOT, 'src/data');

// ---------------------------------------------------------------------------
// SVG path bounds (conservative: includes control points, good enough for
// computing a stable viewBox shared by every frame of a motion).
// ---------------------------------------------------------------------------
function parseArgs(d) {
  const tokens = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:[eE][+-]?\d+)?)/g;
  let m;
  while ((m = re.exec(d))) tokens.push(m[1] ? { c: m[1] } : { n: parseFloat(m[2]) });
  return tokens;
}

function pathBounds(d) {
  const toks = parseArgs(d);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let cx = 0, cy = 0, sx = 0, sy = 0, i = 0;
  const push = (x, y) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  const nextN = () => {
    while (i < toks.length && toks[i].n === undefined) i++;
    if (i >= toks.length) return NaN;
    return toks[i++].n;
  };
  const lastC = { c: '' };
  while (i < toks.length) {
    const t = toks[i++];
    if (t.c === undefined) continue;
    switch (t.c) {
      case 'M': {
        cx = nextN(); cy = nextN();
        sx = cx; sy = cy; push(cx, cy);
        lastC.c = 'M';
        // implicit lineto pairs
        while (i < toks.length && toks[i].n !== undefined) { cx = nextN(); cy = nextN(); push(cx, cy); }
        break;
      }
      case 'm': {
        cx += nextN(); cy += nextN();
        sx = cx; sy = cy; push(cx, cy);
        lastC.c = 'm';
        while (i < toks.length && toks[i].n !== undefined) { cx += nextN(); cy += nextN(); push(cx, cy); }
        break;
      }
      case 'L': {
        while (i < toks.length && toks[i].n !== undefined) { cx = nextN(); cy = nextN(); push(cx, cy); }
        lastC.c = 'L'; break;
      }
      case 'l': {
        while (i < toks.length && toks[i].n !== undefined) { cx += nextN(); cy += nextN(); push(cx, cy); }
        lastC.c = 'l'; break;
      }
      case 'H': { while (i < toks.length && toks[i].n !== undefined) { cx = nextN(); push(cx, cy); } lastC.c = 'H'; break; }
      case 'h': { while (i < toks.length && toks[i].n !== undefined) { cx += nextN(); push(cx, cy); } lastC.c = 'h'; break; }
      case 'V': { while (i < toks.length && toks[i].n !== undefined) { cy = nextN(); push(cx, cy); } lastC.c = 'V'; break; }
      case 'v': { while (i < toks.length && toks[i].n !== undefined) { cy += nextN(); push(cx, cy); } lastC.c = 'v'; break; }
      case 'C': while (i < toks.length && toks[i].n !== undefined) { push(nextN(), nextN()); push(nextN(), nextN()); cx = nextN(); cy = nextN(); push(cx, cy); } lastC.c = 'C'; break;
      case 'c': while (i < toks.length && toks[i].n !== undefined) { push(cx + nextN(), cy + nextN()); push(cx + nextN(), cy + nextN()); cx += nextN(); cy += nextN(); push(cx, cy); } lastC.c = 'c'; break;
      case 'S':
      case 'Q':
        while (i < toks.length && toks[i].n !== undefined) { push(nextN(), nextN()); cx = nextN(); cy = nextN(); push(cx, cy); }
        lastC.c = t.c; break;
      case 's':
      case 'q':
        while (i < toks.length && toks[i].n !== undefined) { push(cx + nextN(), cy + nextN()); cx += nextN(); cy += nextN(); push(cx, cy); }
        lastC.c = t.c; break;
      case 'T':
      case 't':
        while (i < toks.length && toks[i].n !== undefined) { cx = nextN(); cy = nextN(); push(cx, cy); }
        lastC.c = t.c; break;
      case 'A':
      case 'a': {
        while (i < toks.length && toks[i].n !== undefined) {
          const rx = nextN(), ry = nextN(); nextN(); nextN(); nextN(); nextN();
          const x = nextN(), y = nextN();
          if (t.c === 'A') { push(cx + (rx ? x : 0), cy + (ry ? y : 0)); cx = x; cy = y; }
          else { push(cx + (rx ? x : 0), cy + (ry ? y : 0)); cx += x; cy += y; }
          push(cx - (rx || 0), cy - (ry || 0)); push(cx + (rx || 0), cy + (ry || 0));
          push(cx, cy - (ry || 0)); push(cx, cy + (ry || 0));
        }
        lastC.c = t.c; break;
      }
      case 'Z': case 'z': cx = sx; cy = sy; break;
      default: break;
    }
  }
  if (minX === Infinity) return null;
  return { minX, minY, maxX, maxY };
}

// ---------------------------------------------------------------------------
// SVG parsing
// ---------------------------------------------------------------------------
function dsFromSvg(svg, filename) {
  const ds = [...svg.matchAll(/\bd="([^"]+)"/g)].map((m) => m[1]).filter((x) => x.trim());
  if (!ds.length) throw new Error(`no paths in ${filename}`);
  return ds;
}
function viewBoxOf(svg) {
  const m = svg.match(/viewBox="([^"]+)"/);
  if (!m) return null;
  const n = m[1].trim().split(/[\s,]+/).map(Number);
  if (n.length !== 4 || n.some((v) => !Number.isFinite(v)) || n[2] <= 0 || n[3] <= 0) return null;
  return n; // [minX, minY, width, height]
}
/** Union of declared viewBoxes; null unless every frame declares one. */
function unionViewBox(boxes) {
  if (!boxes.length || boxes.some((b) => !b)) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y, w, h] of boxes) {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h);
  }
  return [minX, minY, maxX - minX, maxY - minY];
}
function stripD(d) {
  // Emit path data verbatim. Compact-rounding is unsafe here: SVG arc commands
  // (`a`) allow run-together boolean flags ("…0 01-3.36…" = rot 0, flags 0,1)
  // and adjacent decimal tokens ("8.002.392"), which any numeric reformatting
  // can re-tokenize differently (dropping a flag or merging two numbers).
  return d;
}
function svgContent(files, declaredBox) {
  // files: [{ds:[], viewBox?}] — returns frames: Array<Array<d>>, viewBox.
  // Prefer the source document's declared viewBox (frame-perfect scale); fall
  // back to computed path bounds only when no frame declares one.
  const frames = [];
  for (const f of files) frames.push(f.ds.map(stripD));

  let viewBox = null;
  if (declaredBox) {
    viewBox = declaredBox;
  } else {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const ds of frames) {
      for (const d of ds) {
        const b = pathBounds(d);
        if (!b) continue;
        minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY);
        maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY);
      }
    }
    if (minX === Infinity) return null;
    // small pad so strokes/edges never clip
    const pad = Math.max(maxX - minX, maxY - minY) * 0.01;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    viewBox = [minX, minY, maxX - minX, maxY - minY];
  }
  const fmt = (n) => String(Math.round(n * 100) / 100);
  return { frames, viewBox: viewBox.map(fmt).join(' ') };
}

function writeMotion(slug, motion, source, srcUrl, credit) {
  const header = `<!-- gymmiie exercise art: ${slug} | source: ${source}${srcUrl ? ` (${srcUrl})` : ''} | CC BY-SA 4.0 -->`;
  const groups = motion.frames.map((ds, i) =>
    `<g data-frame="${i + 1}">${ds.map((d) => `<path fill-rule="evenodd" d="${d}"/>`).join('')}</g>`,
  );
  fs.writeFileSync(path.join(OUT_SVG, `${slug}.svg`), `${header}\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${motion.viewBox}">${groups.join('')}</svg>`);
  return { n: motion.frames.length, src: source, url: srcUrl, credit, frames: motion.viewBox };
}

// ---------------------------------------------------------------------------
// Load sources
// ---------------------------------------------------------------------------
const gym = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/exercises.json'), 'utf8'));
const wgManifest = JSON.parse(fs.readFileSync(path.join(WG, 'manifest.json'), 'utf8'));
const wgBySlug = new Map(wgManifest.map((x) => [x.slug, x]));
const ekData = JSON.parse(fs.readFileSync(path.join(EK, 'exercises.json'), 'utf8'));
const ekByName = new Map(ekData.map((x) => [x.name, x]));

// EK exercise for a WG slug via recorded attribution (exact provenance)
const wgSlugToEk = new Map();
for (const w of wgManifest) {
  const m = (w.attribution?.source?.url || '').match(/svg\/([0-9a-f]{4})-tension\.svg/);
  if (m) {
    // id_num -> EK name via exercises.json
    const ek = ekData.find((x) => x.id_num === m[1]);
    if (ek) wgSlugToEk.set(w.slug, ek.name);
  }
}

const STOP = new Set(['with', 'and', 'the', 'on', 'a', 'to', 'using', 'rounded', 'at', 'of']);
const stem = (w) => (w.endsWith('s') && w.length > 3 ? w.slice(0, -1) : w);
const toks = (s) => s.split(/[^a-z0-9]+/).map(stem).filter((w) => w && !STOP.has(w));
const jaccard = (a, b) => {
  const sa = new Set(a), sb = new Set(b);
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  return inter / (sa.size + sb.size - inter);
};

// equipment wording conflicts → treat lines as visibly different motions
const EQUIP = ['band', 'barbell', 'dumbbell', 'dumbbells', 'cable', 'machine', 'smith', 'kettlebell', 'plate', 'bodyweight'];
function equipConflict(gymSlug, ekName) {
  const g = toks(gymSlug).filter((t) => EQUIP.includes(t));
  const e = toks(ekName).filter((t) => EQUIP.includes(t));
  const has = (list, w) => list.some((t) => t.startsWith(w));
  const hasAny = (list, words) => list.some((t) => words.some((w) => t.startsWith(w)));
  if (has(g, 'band') && !has(e, 'band')) return true;
  if (has(e, 'band') && !has(g, 'band')) return true;
  if (has(g, 'barbell') && hasAny(e, ['dumbbell', 'kettlebell'])) return true;
  if (has(g, 'kettlebell') && !has(e, 'kettlebell')) return true;
  if (hasAny(g, ['dumbbell']) && has(e, 'barbell')) return true;
  if (hasAny(g, ['ball', 'stability']) !== hasAny(e, ['ball', 'stability'])) return true;
  if (hasAny(g, ['cable', 'machine']) && hasAny(e, ['barbell', 'dumbbell', 'kettlebell'])) return true;
  if (hasAny(e, ['cable', 'machine']) && hasAny(g, ['barbell', 'dumbbell', 'kettlebell'])) return true;
  if (has(g, 'smith') !== has(e, 'smith')) return true;
  return false;
}
// tokens meaningful apart from equipment (for scoring quality)
const NON_EQ = (s) => toks(s).filter((t) => !EQUIP.some((w) => t.startsWith(w)) && !['incline', 'decline', 'seated', 'standing', 'lying', 'wide', 'close', 'grip', 'flat', 'one', 'single', 'arm', 'leg'].includes(t));

const ALIAS = {
  // art slug -> Everkinetic exercise name (hand-checked equivalents)
  'ball-curl-leg-raised': 'biceps-curl-on-stability-ball-with-leg-raised',
  'ball-side-bend': 'weighted-ball-side-bend',
  'band-chest-fly': 'crossover-bands',
  'barbell-bench-front-squat': 'front-squat-with-barbell',
  'barbell-close-grip-curl': 'close-grip-ez-bar-curl-with-barbell',
  'barbell-concentration-curl': 'seated-close-grip-concentration-curls-with-barbell',
  'barbell-decline-wide-grip-press': 'decline-barbell-bench-press',
  'barbell-decline-wide-grip-pullover': 'wide-grip-decline-barbell-pullover',
  'barbell-front-raise-and-pullover': 'barbell-front-raise-pullover',
  'barbell-hack-squat': 'hack-squat-with-barbell',
  'barbell-lunge': 'barbell-lunges',
  'barbell-one-arm-snatch': 'one-arm-snatch-with-barbell',
  'barbell-rear-delt-row': 'rear-deltoid-row-barbell',
  'barbell-reverse-lunge': 'rear-lunges-with-barbell',
  'barbell-seated-overhead-press': 'seated-military-press',
  'barbell-seated-overhead-triceps-extension': 'seated-overhead-triceps-extension-with-barbell',
  'barbell-step-up': 'step-ups-with-barbell',
  'barbell-wide-bench-press': 'wide-grip-bench-press',
  'bench-leg-raise': 'flat-bench-leg-raises',
  'cable-bent-over-rear-delt-raise': 'bent-over-rear-deltoid-raise-with-head-on-bench',
  'cable-internal-rotation': 'internal-cable-rotation',
  'cable-kneeling-concentration-extension': 'kneeling-triceps-extension-with-cable',
  'cable-lying-close-grip-curl': 'lying-bicep-cable-curl',
  'cable-lying-curl': 'lying-bicep-cable-curl',
  'cable-lying-triceps-extension': 'lying-triceps-extension-with-cable',
  'cable-preacher-curl': 'preacher-curl-with-cable',
  'cable-shrug': 'cable-shoulder-shrugs',
  'cable-upright-row': 'upright-cable-row',
  'cross-body-crunch': 'cross-body-crunch',
  'cross-body-hammer-curl': 'cross-body-hammer-curl-with-dumbbell',
  'decline-chest-press-machine': 'decline-chest-press',
  'decline-close-grip-skull-press': 'decline-close-grip-bench-to-skull-crusher',
  'dumbbell-decline-fly': 'decline-dumbbell-flys',
  'dumbbell-hammer-preacher-curl': 'preacher-hammer-curl-with-dumbbell',
  'dumbbell-one-arm-preacher-curl': 'preacher-curl-with-machine',
  'dumbbell-pullover': 'straight-arm-dumbbell-pullover',
  'dumbbell-reverse-curl': 'biceps-curl-reverse-with-dumbbells',
  'flat-bench-cable-fly': 'flat-bench-cable-flys',
  'incline-chest-press-machine': 'incline-chest-press',
  'incline-dumbbell-fly': 'incline-dumbbell-flys',
  'incline-dumbbell-hammer-press': 'hammer-grip-incline-bench-press',
  'jm-press': 'jm-press',
  'machine-biceps-curl': 'standing-biceps-curl-with-cable',
  'machine-triceps-extension': 'standing-triceps-extension',
  'reverse-grip-bench-press': 'reverse-triceps-bench-press-with-barbell',
  'reverse-grip-lat-pulldown': 'underhand-pull-down',
  'reverse-grip-triceps-pushdown': 'reverse-grip-triceps-pushdown',
  'rocking-calf-raise': 'rocking-standing-calf-raise-with-barbell',
  'smith-close-grip-bench-press': 'smith-machine-close-grip-bench-press',
  'smith-good-morning': 'smith-machine-good-mornings',
  'smith-hack-squat': 'smith-machine-hack-squat',
  'smith-incline-bench-press': 'smith-machine-incline-bench-press',
  'smith-rear-delt-row': 'smith-machine-rear-deltoid-row',
  'smith-shrug': 'smith-machine-shoulder-shrugs',
  'overhead-squat': 'overhead-squat-with-barbell',
  'weighted-sissy-squat': 'weighted-sissy-squat-with-weight-plate',
  'single-arm-cable-curl': 'standing-one-arm-biceps-curl-with-cable',
  'single-arm-dumbbell-shoulder-press': 'one-arm-dumbbell-shoulder-press',
  'tate-press': 'tate-press',
  'v-bar-pushdown': 'triceps-pushdown-with-v-bar-and-cable',
  'wide-grip-barbell-curl': 'close-grip-standing-biceps-curls-with-barbell',
};

// Verified later steps — remove aliases that don't resolve.
const resolveAlias = (slug) => {
  const name = ALIAS[slug];
  return name && ekByName.has(name) ? name : null;
};

// EK SVGs actually available on disk
const ekAvailable = new Map();
for (const x of ekData) {
  const r = path.join(EK, 'dist/svg', `${x.id_num}-relaxation.svg`);
  const t = path.join(EK, 'dist/svg', `${x.id_num}-tension.svg`);
  if (fs.existsSync(r) && fs.existsSync(t)) ekAvailable.set(x.name, [r, t]);
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------
fs.rmSync(OUT_SVG, { recursive: true, force: true });
fs.mkdirSync(OUT_SVG, { recursive: true });
fs.mkdirSync(OUT_DATA, { recursive: true });

const artIndex = {};
const instructions = {};
const attribution = [];
const report = { wg: 0, ek: 0, gg: 0, none: 0, detail: [] };

function motionFromWG(slug) {
  const w = wgBySlug.get(slug);
  if (!w) return null;
  try {
    const files = w.frames.map((f) => {
      const svg = fs.readFileSync(path.join(WG, f.path), 'utf8');
      return { ds: dsFromSvg(svg, f.path), viewBox: viewBoxOf(svg) };
    });
    const motion = svgContent(files, unionViewBox(files.map((f) => f.viewBox)));
    if (!motion) return null;
    const ekName = wgSlugToEk.get(slug);
    return { motion, source: 'workout-guide', url: 'https://github.com/bryllim/workout-guide — assets/' + slug + '/frame-{1..3}.svg', credit: 'Workout Guide by Bryl Lim (first pose derived from Everkinetic)' };
  } catch (e) {
    console.error('WG fail', slug, e.message);
    return null;
  }
}
function motionFromEK(ekName) {
  const files2 = ekAvailable.get(ekName);
  if (!files2) return null;
  try {
    const localDs = files2.map((p) => {
      const svg = fs.readFileSync(p, 'utf8');
      return { ds: dsFromSvg(svg, p), viewBox: viewBoxOf(svg) };
    });
    const motion = svgContent(localDs, unionViewBox(localDs.map((f) => f.viewBox)));
    if (!motion) return null;
    const ex = ekByName.get(ekName);
    return { motion, source: 'everkinetic', url: `https://github.com/everkinetic/data — dist/svg/${ex.id_num}.svg (relaxation + tension)`, credit: 'Everkinetic' };
  } catch {
    return null;
  }
}
function motionFromGG(slug) {
  const p = path.join(GG, `${slug}.txt`);
  if (!fs.existsSync(p)) return null;
  const lines = fs.readFileSync(p, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  // GymMane art has no declared viewBox; fit all frames using a real path
  // parser (svg-path-bounds) so arcs/curves can't inflate the bounds.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const d of lines) {
    try {
      const b = svgPathBounds(d);
      if (b && b.every(Number.isFinite)) {
        minX = Math.min(minX, b[0]); minY = Math.min(minY, b[1]);
        maxX = Math.max(maxX, b[2]); maxY = Math.max(maxY, b[3]);
      }
    } catch {
      /* skip unparsable line */
    }
  }
  if (minX === Infinity) return null;
  const ownsBox = [minX, minY, maxX - minX, maxY - minY];
  const motion = svgContent(lines.map((d) => ({ ds: [d] })), ownsBox);
  if (!motion) return null;
  return { motion, source: 'gymmane', url: 'https://github.com/InlitX/gymmane — assets/art (Everkinetic-derived)', credit: 'GymMane by InlitX (Everkinetic-derived, CC BY-SA 4.0)' };
}

const ekCandidates = ekData.map((x) => ({ name: x.name, toks: toks(x.name), body: NON_EQ(x.name) }));

const fuzzyMatch = (slug) => {
  const gToks = toks(slug);
  const gBody = NON_EQ(slug);
  let best = null;
  for (const c of ekCandidates) {
    if (!ekAvailable.has(c.name)) continue;
    const j = jaccard(gToks, c.toks);
    const jb = jaccard(gBody, c.body);
    const score = jb >= 0.5 ? j + jb : j * 0.25 + jb; // require real name-body overlap
    if (equipConflict(slug, c.name)) continue;
    if (!best || score > best.score) best = { score, name: c.name };
  }
  return best && (best.score >= 0.55 || (jbCheck(best) && best.score >= 0.4)) ? best : null;
  function jbCheck(x) { return x.score >= 0.4 && x.score < 1; }
};

// Motions neither WG nor EK depict faithfully (equipment/hand-count differs
// visibly) — keep the GymMane art, which matches the intended exercise exactly.
const GG_ONLY = new Set([
  'zercher-squat', 'ball-seated-curl', 'seated-dumbbell-curl', 'incline-chest-press-machine',
  'single-arm-cable-pushdown', 'single-arm-dumbbell-bench-press', 'band-biceps-curl',
]);

const gymSlugs = [...new Set(gym.map((g) => g.art).filter(Boolean))];

for (const slug of gymSlugs) {
  // frame provenance
  let viaALIAS = null;
  let result = motionFromWG(slug);
  let via = result ? 'workout-guide' : null;
  if (!result) {
    viaALIAS = resolveAlias(slug);
    if (process.env.ARTDBG) console.error('DBG', slug, 'alias:', viaALIAS);
    if (viaALIAS) result = motionFromEK(viaALIAS);
    if (result) via = 'everkinetic-alias';
  }
  if (!result && !GG_ONLY.has(slug)) {
    const f = fuzzyMatch(slug);
    if (f) {
      result = motionFromEK(f.name);
      if (result) { viaALIAS = f.name; via = 'everkinetic-fuzzy'; }
    }
  }
  if (!result) {
    result = motionFromGG(slug);
    if (result) { via = 'gymmane'; viaALIAS = null; }
  }
  if (!result) { report.none++; report.detail.push(`MISSING ${slug}`); continue; }

  artIndex[slug] = { n: result.motion?.frames.length ?? 0, src: via, url: result.url };
  report[via === 'workout-guide' ? 'wg' : via?.startsWith('everkinetic') ? 'ek' : 'gg']++;
  attribution.push({ slug, via, ek: viaALIAS ?? undefined, ...result });
  report.detail.push(`${via.padEnd(20)} ${slug}${viaALIAS ? `  →  ${viaALIAS}` : ''}`);

  // instructions: EK steps for this motion (applied below per exercise id)
  const slugCandidate =
    via?.startsWith('everkinetic') ? viaALIAS
      : via === 'workout-guide' ? (wgSlugToEk.get(slug) || fuzzyMatch(slug)?.name || null)
      : fuzzyMatch(slug)?.name || null;
  const ekName = slugCandidate && ekByName.has(slugCandidate) ? slugCandidate : null;
  const ekEx = ekName ? ekByName.get(ekName) : null;
  if (ekEx && (ekEx.steps?.length || ekEx.tips?.length)) {
    for (const gex of gym.filter((g) => g.art === slug)) {
      if (instructions[gex.id]) continue;
      if (ekEx.steps.length) instructions[gex.id] = { steps: ekEx.steps, source: 'everkinetic', url: `https://db.everkinetic.com/exercise/${ekEx.name}` };
      else if (ekEx.tips?.length) instructions[gex.id] = { steps: gex.steps, tips: ekEx.tips, source: 'everkinetic', url: `https://db.everkinetic.com/exercise/${ekEx.name}` };
      else if (!instructions[gex.id]) instructions[gex.id] = { steps: gex.steps, source: 'gymmane' };
    }
  }
}

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------
const written = [];
for (const a of attribution) {
  try {
    written.push(writeMotion(a.slug, a.motion, a.via, a.url, a.credit));
  } catch (e) {
    report.detail.push(`EMIT-FAIL ${a.slug}: ${e.message}`);
  }
}

fs.writeFileSync(path.join(OUT_DATA, 'art.json'), JSON.stringify(artIndex, null, 0));
fs.writeFileSync(path.join(OUT_DATA, 'instructions.json'), JSON.stringify(instructions, null, 1));

// compact per-slug svg provenance for the attribution doc + runtime index
const urlBySlug = {};
for (const a of attribution) urlBySlug[a.slug] = { source: a.via, url: a.url, ek: a.ek ?? null };

const ATTR = `# Exercise artwork & instructions — attribution

All exercise animation artwork in this directory is licensed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

## Sources

1. **Workout Guide by Bryl Lim** — <https://github.com/bryllim/workout-guide>
   Thirty exercises × normalized 3-frame animations (512×512, vector format).
   Frames are Bryl Lim's own work; first poses of Everkinetic-derived artwork are
   recorded upstream in \`packages/workout-guide/manifest.json\`.
2. **Everkinetic** — <https://github.com/everkinetic/data>
   Two-frame (relaxation → tension) poses, plus the canonical step-by-step
   instructions shown in the app's exercise pages.
   Database: <https://db.everkinetic.com>
3. **GymMane by InlitX** — <https://github.com/InlitX/gymmane>
   Everkinetic-derived pose data, used only for exercises neither Workout Guide
   nor Everkinetic cover.

## Per-slug provenance

| art slug | source | Everkinetic mapping |
| --- | --- | --- |
${Object.entries(urlBySlug).map(([slug, v]) => `| \`${slug}\` | ${v.source} | ${v.ek ?? '—'} |`).join('\n')}

## Changes

Frames were re-emitted as compact multi-frame SVGs with \`fill="currentColor"\`
and a shared viewBox so every frame of a motion animates in place. No shapes
were redrawn. Instructions are verbatim Everkinetic "Steps"/"Tips" where
matched, otherwise GymMane catalog text.
`;
fs.writeFileSync(path.join(OUT_SVG, 'ATTRIBUTION.md'), ATTR);
fs.writeFileSync(path.join(OUT_SVG, 'LICENSE-ART'), fs.readFileSync(path.join(WG, 'LICENSE-ASSETS'), 'utf8'));

console.log(`WG: ${report.wg}  EK: ${report.ek}  GG: ${report.gg}  none: ${report.none}/${gymSlugs.length}`);
console.log(`svg written: ${written.length}`);
fs.writeFileSync('/tmp/gymmiie-art-report.txt', report.detail.join('\n'));

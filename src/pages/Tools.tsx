import { useState } from 'react';
import {
  Activity, Calculator, Flame, Medal, Percent, Scale, Target, TrendingUp, Trophy, Weight, Zap,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { bmi, bmr, calculatePlates, dotsScore, tdee, targetWeightForRpe, warmupRamp } from '../lib/exercises';
import { fromDisplayWeight, oneRm, toDisplayWeight, KG_PER_LB } from '../lib/stats';
import { Btn, Card, Field, NumField, PageHeader, SectionHeader, Sheet } from '../components/ui';

type ToolId = 'rm' | 'bmi' | 'cal' | 'bf' | 'ffmi' | 'plate' | 'warmup' | 'rpe' | 'dots' | 'wilks';

const TOOLS: { id: ToolId; name: string; desc: string; icon: React.ReactNode }[] = [
  { id: 'rm', name: '1RM', desc: 'Estimated one-rep max', icon: <TrendingUp size={20} /> },
  { id: 'bmi', name: 'BMI', desc: 'Body mass index', icon: <Scale size={20} /> },
  { id: 'cal', name: 'Calories', desc: 'Maintenance & macros', icon: <Flame size={20} /> },
  { id: 'bf', name: 'Body fat', desc: 'US Navy estimate', icon: <Percent size={20} /> },
  { id: 'ffmi', name: 'FFMI', desc: 'Fat-free mass index', icon: <Activity size={20} /> },
  { id: 'plate', name: 'Plates', desc: 'Barbell plate math', icon: <Weight size={20} /> },
  { id: 'warmup', name: 'Warm-up', desc: 'Ramp-up sets', icon: <Zap size={20} /> },
  { id: 'rpe', name: 'RPE load', desc: 'Weight for target effort', icon: <Target size={20} /> },
  { id: 'dots', name: 'DOTS', desc: 'Strength for bodyweight', icon: <Trophy size={20} /> },
  { id: 'wilks', name: 'Wilks', desc: 'Classic powerlifting score', icon: <Medal size={20} /> },
];

export default function Tools() {
  const [tool, setTool] = useState<ToolId | null>(null);
  return (
    <div className="page-enter">
      <PageHeader eyebrow="Tools" title="Take the guesswork out" subtitle={`${TOOLS.length} calculators for loading, body metrics and strength standards`} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {TOOLS.map((t) => (
          <button key={t.id} onClick={() => setTool(t.id)} className="card p-4 text-left transition hover:border-strong active:scale-[.98]">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">{t.icon}</span>
            <p className="mt-3 text-sm font-black">{t.name}</p>
            <p className="mt-0.5 text-[11px] font-semibold leading-tight text-mute">{t.desc}</p>
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="label">Loading</p><p className="mt-1 text-sm font-black">Plates & RPE</p><p className="mt-1 text-[11px] font-semibold text-mute">Know exactly what goes on the bar before your next set.</p></Card>
        <Card className="p-4"><p className="label">Body</p><p className="mt-1 text-sm font-black">BMI, BF% & FFMI</p><p className="mt-1 text-[11px] font-semibold text-mute">Estimates only. Trends matter more than single readings.</p></Card>
        <Card className="p-4"><p className="label">Strength</p><p className="mt-1 text-sm font-black">DOTS & Wilks</p><p className="mt-1 text-[11px] font-semibold text-mute">Compare lifts fairly across bodyweights.</p></Card>
      </div>

      <ToolSheet tool={tool} onClose={() => setTool(null)} />
    </div>
  );
}

function ToolSheet({ tool, onClose }: { tool: ToolId | null; onClose: () => void }) {
  const meta = TOOLS.find((t) => t.id === tool);
  return (
    <Sheet open={!!tool} onClose={onClose} title={meta ? `${meta.name} calculator` : 'Calculator'}>
      {tool === 'rm' && <OneRm />}
      {tool === 'bmi' && <Bmi />}
      {tool === 'cal' && <Calories />}
      {tool === 'bf' && <BodyFat />}
      {tool === 'ffmi' && <Ffmi />}
      {tool === 'plate' && <Plates />}
      {tool === 'warmup' && <Warmup />}
      {tool === 'rpe' && <RpeLoad />}
      {tool === 'dots' && <Dots />}
      {tool === 'wilks' && <Wilks />}
    </Sheet>
  );
}

function Result({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl bg-[var(--surface-2)] p-4 text-center">
      <p className="label">{label}</p>
      <p className={`num mt-1 text-3xl font-black ${accent ? 'text-[var(--accent)]' : ''}`}>{value}</p>
      {sub && <p className="mt-1 text-[11px] font-bold text-mute">{sub}</p>}
    </div>
  );
}

function OneRm() {
  const unit = useStore((s) => s.data.settings.unit);
  const [weight, setWeight] = useState(100);
  const [reps, setReps] = useState(5);
  const [rpe, setRpe] = useState(8);
  const max = oneRm(weight, reps, rpe);
  const table = [1, 2, 3, 5, 8, 10, 12].map((r) => ({ reps: r, pct: Math.round((oneRm(weight, reps, rpe) ? (weight * (1 + r / 30)) / max : 0) * 100) }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Weight lifted"><NumField value={weight} onChange={setWeight} unit={unit} step={2.5} /></Field>
        <Field label="Reps"><NumField value={reps} onChange={(v) => setReps(Math.max(1, Math.min(20, v)))} unit="reps" /></Field>
      </div>
      <Field label="RPE at the end of the set" hint="Optional. Leave high if you stopped well short of failure.">
        <select className="input" value={rpe} onChange={(e) => setRpe(Number(e.target.value))}>
          {[10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6].map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </Field>
      <Result label="Estimated 1RM" value={`${max.toFixed(1)} ${unit}`} sub="Epley / RPE-adjusted" accent />
      <div className="rounded-2xl border border-line">
        <div className="border-b border-line px-3 py-2 text-[10px] font-black uppercase text-mute">Rep targets at this 1RM</div>
        {table.map((t) => (
          <div key={t.reps} className="flex items-center justify-between px-3 py-1.5 text-xs font-bold">
            <span className="text-dim">{t.reps} rep{t.reps > 1 ? 's' : ''}</span>
            <span className="num text-mute">{Math.round(max * (1 / (1 + t.reps / 30)))} {unit}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] font-semibold text-mute">Estimates are most accurate between 1–10 reps at RPE 7–10.</p>
    </div>
  );
}

function Bmi() {
  const data = useStore((s) => s.data);
  const unit = data.settings.unit;
  const [weight, setWeight] = useState(Math.round(toDisplayWeight(data.profile.weightKg, unit)));
  const [height, setHeight] = useState(data.profile.heightCm);
  const kg = fromDisplayWeight(weight, unit);
  const value = bmi(kg, height);
  const category = value < 18.5 ? 'Underweight' : value < 25 ? 'Normal' : value < 30 ? 'Overweight' : 'Obese';
  const tone = value < 18.5 ? 'var(--warn)' : value < 25 ? 'var(--good)' : value < 30 ? 'var(--warn)' : 'var(--bad)';
  const idealLow = 18.5 * (height / 100) ** 2;
  const idealHigh = 24.9 * (height / 100) ** 2;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Weight"><NumField value={weight} onChange={setWeight} unit={unit} step={0.5} /></Field>
        <Field label="Height"><NumField value={height} onChange={setHeight} unit="cm" /></Field>
      </div>
      <Result label="BMI" value={value.toFixed(1)} sub={category} accent />
      <div className="rounded-2xl border border-line p-3">
        <div className="flex h-2 overflow-hidden rounded-full">
          <span className="flex-[18.5] bg-[var(--warn)]/50" /><span className="flex-[6.5] bg-[var(--good)]" /><span className="flex-[5] bg-[var(--warn)]/70" /><span className="flex-[10] bg-[var(--bad)]/70" />
        </div>
        <div className="mt-2 flex justify-between text-[9px] font-black text-mute"><span>18.5</span><span>25</span><span>30</span></div>
        <p className="mt-2 text-[11px] font-semibold text-mute">Healthy BMI range for your height: {toDisplayWeight(idealLow, unit).toFixed(1)}–{toDisplayWeight(idealHigh, unit).toFixed(1)} {unit}.</p>
      </div>
      <p className="text-[10px] font-semibold text-mute">BMI ignores muscle mass. Pair it with waist measurements and progress photos.</p>
    </div>
  );
}

function Calories() {
  const data = useStore((s) => s.data);
  const unit = data.settings.unit;
  const [weight, setWeight] = useState(Math.round(toDisplayWeight(data.profile.weightKg, unit)));
  const [height, setHeight] = useState(data.profile.heightCm);
  const [age, setAge] = useState(data.profile.age);
  const [sex, setSex] = useState(data.profile.sex);
  const [activity, setActivity] = useState(data.profile.activity);
  const profile = { sex, age, heightCm: height, weightKg: fromDisplayWeight(weight, unit), activity };
  const b = bmr(profile);
  const t = tdee(profile);
  const protein = Math.round(profile.weightKg * 2);
  const fat = Math.round(profile.weightKg * 0.9);
  const carbs = Math.max(0, Math.round((t - protein * 4 - fat * 9) / 4));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Weight"><NumField value={weight} onChange={setWeight} unit={unit} step={0.5} /></Field>
        <Field label="Height"><NumField value={height} onChange={setHeight} unit="cm" /></Field>
        <Field label="Age"><NumField value={age} onChange={setAge} unit="yrs" /></Field>
        <Field label="Sex"><select className="input" value={sex} onChange={(e) => setSex(e.target.value as typeof sex)}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></Field>
      </div>
      <Field label="Activity">
        <select className="input" value={activity} onChange={(e) => setActivity(Number(e.target.value))}>
          <option value={1.2}>Sedentary</option><option value={1.375}>Light (1–2 sessions)</option><option value={1.55}>Moderate (3–4)</option><option value={1.725}>Active (5–6)</option><option value={1.9}>Very active</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Result label="BMR" value={Math.round(b)} sub="at rest" />
        <Result label="Maintenance" value={Math.round(t)} sub="TDEE" accent />
      </div>
      <div className="rounded-2xl border border-line">
        <div className="border-b border-line px-3 py-2 text-[10px] font-black uppercase text-mute">Suggested split</div>
        {[{ label: 'Protein', value: protein, unit: 'g' }, { label: 'Carbs', value: carbs, unit: 'g' }, { label: 'Fat', value: fat, unit: 'g' }].map((m) => (
          <div key={m.label} className="flex items-center justify-between border-b border-line px-3 py-1.5 text-xs font-bold last:border-0"><span className="text-dim">{m.label}</span><span className="num">{m.value} {m.unit}</span></div>
        ))}
      </div>
      <p className="text-[10px] font-semibold text-mute">Mifflin–St Jeor estimate. Adjust by ±200–300 kcal based on real weight trends.</p>
    </div>
  );
}

function BodyFat() {
  const data = useStore((s) => s.data);
  const [sex, setSex] = useState(data.profile.sex);
  const [height, setHeight] = useState(data.profile.heightCm);
  const [neck, setNeck] = useState(40);
  const [waist, setWaist] = useState(85);
  const [hip, setHip] = useState(95);
  const log = Math.log10;
  const value = sex === 'female'
    ? 495 / (1.29579 - 0.35004 * log(waist + hip - neck) + 0.221 * log(height)) - 450
    : 495 / (1.0324 - 0.19077 * log(waist - neck) + 0.15456 * log(height)) - 450;
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(70, value)) : 0;
  const cat = safe < 6 ? 'Essential' : sex === 'female' ? safe < 14 ? 'Athletic' : safe < 21 ? 'Fitness' : safe < 25 ? 'Average' : 'High' : safe < 10 ? 'Athletic' : safe < 14 ? 'Fitness' : safe < 18 ? 'Average' : 'High';
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sex"><select className="input" value={sex} onChange={(e) => setSex(e.target.value as typeof sex)}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></Field>
        <Field label="Height"><NumField value={height} onChange={setHeight} unit="cm" /></Field>
        <Field label="Neck"><NumField value={neck} onChange={setNeck} unit="cm" step={0.5} /></Field>
        <Field label="Waist"><NumField value={waist} onChange={setWaist} unit="cm" step={0.5} /></Field>
        {sex === 'female' && <Field label="Hip"><NumField value={hip} onChange={setHip} unit="cm" step={0.5} /></Field>}
      </div>
      <Result label="Body fat" value={`${safe.toFixed(1)}%`} sub={cat} accent />
      <p className="text-[10px] font-semibold text-mute">US Navy circumference method. Best used as a trend, not an absolute truth.</p>
    </div>
  );
}

function Ffmi() {
  const data = useStore((s) => s.data);
  const unit = data.settings.unit;
  const [weight, setWeight] = useState(Math.round(toDisplayWeight(data.profile.weightKg, unit)));
  const [height, setHeight] = useState(data.profile.heightCm);
  const [bf, setBf] = useState(15);
  const kg = fromDisplayWeight(weight, unit);
  const lean = kg * (1 - bf / 100);
  const heightM = height / 100;
  const ffmi = lean / (heightM * heightM);
  const normalized = ffmi + 6.1 * (1.8 - heightM);
  const cat = normalized < 18 ? 'Below average' : normalized < 20 ? 'Average' : normalized < 22 ? 'Above average' : normalized < 24 ? 'Excellent' : 'Elite';
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Weight"><NumField value={weight} onChange={setWeight} unit={unit} step={0.5} /></Field>
        <Field label="Height"><NumField value={height} onChange={setHeight} unit="cm" /></Field>
      </div>
      <Field label="Body fat %"><NumField value={bf} onChange={(v) => setBf(Math.max(2, Math.min(60, v)))} unit="%" step={0.5} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Result label="Lean mass" value={`${toDisplayWeight(lean, unit).toFixed(1)}`} sub={unit} />
        <Result label="FFMI" value={normalized.toFixed(1)} sub={cat} accent />
      </div>
      <p className="text-[10px] font-semibold text-mute">Normalized to 1.8 m. FFMI above 25 is rare without exceptional genetics or pharmaceutical assistance.</p>
    </div>
  );
}

function Plates() {
  const data = useStore((s) => s.data);
  const unit = data.settings.unit;
  const [target, setTarget] = useState(100);
  const [bar, setBar] = useState(Math.round(toDisplayWeight(data.settings.barWeight, unit)));
  const result = calculatePlates(fromDisplayWeight(target, unit), fromDisplayWeight(bar, unit), data.settings.plates, unit);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Target weight"><NumField value={target} onChange={setTarget} unit={unit} step={2.5} /></Field>
        <Field label="Bar weight"><NumField value={bar} onChange={setBar} unit={unit} step={2.5} /></Field>
      </div>
      <Result label="Per side" value={result.perSide.length ? result.perSide.map((p) => `${p.plate}×${p.count}`).join('  ') : 'Just the bar'} sub={`${result.perSide.reduce((n, p) => n + p.plate * p.count, 0)} ${unit} each side`} accent />
      <div className="rounded-2xl border border-line p-3">
        <p className="text-[10px] font-black uppercase text-mute">Loadout</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          <span className="rounded-lg bg-[var(--surface-3)] px-2.5 py-3 text-[10px] font-black text-dim">{bar} {unit} bar</span>
          <span className="text-mute">|</span>
          {result.perSide.length ? result.perSide.map((p) => (
            <span key={p.plate} className="rounded-lg bg-[var(--accent)]/20 px-2 py-3 text-[10px] font-black text-[var(--accent)]">{p.plate} ×{p.count}</span>
          )) : <span className="text-[11px] font-bold text-mute">no plates</span>}
        </div>
      </div>
      <p className="text-[10px] font-semibold text-mute">Achieved load: {toDisplayWeight(result.achieved, unit).toFixed(1)} {unit}{result.leftover > 0.01 ? ` · ${toDisplayWeight(result.leftover, unit).toFixed(1)} ${unit} short` : ' · exact'}. Edit your plate inventory in Settings.</p>
    </div>
  );
}

function Warmup() {
  const unit = useStore((s) => s.data.settings.unit);
  const [work, setWork] = useState(100);
  const ramp = warmupRamp(fromDisplayWeight(work, unit), unit);
  return (
    <div className="space-y-4">
      <Field label="Working weight"><NumField value={work} onChange={setWork} unit={unit} step={2.5} /></Field>
      <div className="rounded-2xl border border-line">
        {ramp.map((r, i) => (
          <div key={i} className={`flex items-center justify-between px-3 py-2.5 text-xs font-bold ${i === ramp.length - 1 ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : ''}`}>
            <span>{Math.round(r.pct * 100)}%</span>
            <span className="num">{toDisplayWeight(r.kg, unit).toFixed(1)} {unit}</span>
            <span className="text-mute">{r.reps} reps</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] font-semibold text-mute">Ramp sets are for preparation, not fatigue. Rest 60–90s between them.</p>
    </div>
  );
}

function RpeLoad() {
  const unit = useStore((s) => s.data.settings.unit);
  const [max, setMax] = useState(100);
  const [reps, setReps] = useState(5);
  const [rpe, setRpe] = useState(8);
  const target = targetWeightForRpe(fromDisplayWeight(max, unit), reps, rpe);
  return (
    <div className="space-y-4">
      <Field label="Estimated 1RM"><NumField value={max} onChange={setMax} unit={unit} step={2.5} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Target reps"><NumField value={reps} onChange={(v) => setReps(Math.max(1, Math.min(12, v)))} unit="reps" /></Field>
        <Field label="Target RPE"><select className="input" value={rpe} onChange={(e) => setRpe(Number(e.target.value))}>{[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((r) => <option key={r} value={r}>{r}</option>)}</select></Field>
      </div>
      <Result label="Work weight" value={target ? `${toDisplayWeight(target, unit).toFixed(1)} ${unit}` : '—'} sub={target ? `for ${reps} reps @ RPE ${rpe}` : 'Enter valid values'} accent />
      <p className="text-[10px] font-semibold text-mute">RPE 10 means no reps left. RPE 8 means about two reps in reserve.</p>
    </div>
  );
}

function Dots() {
  const data = useStore((s) => s.data);
  const unit = data.settings.unit;
  const [total, setTotal] = useState(400);
  const [body, setBody] = useState(Math.round(toDisplayWeight(data.profile.weightKg, unit)));
  const [sex, setSex] = useState(data.profile.sex === 'female' ? 'female' : 'male');
  const score = dotsScore(fromDisplayWeight(total, unit), fromDisplayWeight(body, unit), sex);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Total (S+B+D)"><NumField value={total} onChange={setTotal} unit={unit} step={2.5} /></Field>
        <Field label="Bodyweight"><NumField value={body} onChange={setBody} unit={unit} step={0.5} /></Field>
      </div>
      <Field label="Sex"><select className="input" value={sex} onChange={(e) => setSex(e.target.value as typeof sex)}><option value="male">Male</option><option value="female">Female</option></select></Field>
      <Result label="DOTS score" value={score.toFixed(1)} sub={score > 400 ? 'Strong' : score > 300 ? 'Solid' : 'Building'} accent />
      <p className="text-[10px] font-semibold text-mute">DOTS compares powerlifting totals across bodyweights. Higher is better; elite scores sit above 400.</p>
    </div>
  );
}

function Wilks() {
  const data = useStore((s) => s.data);
  const unit = data.settings.unit;
  const [total, setTotal] = useState(400);
  const [body, setBody] = useState(Math.round(toDisplayWeight(data.profile.weightKg, unit)));
  const [sex, setSex] = useState(data.profile.sex === 'female' ? 'female' : 'male');
  const kg = fromDisplayWeight(total, unit);
  const bw = fromDisplayWeight(body, unit);
  const c = sex === 'female'
    ? [594.31747775582, -27.23842536447, 0.82112226871, -0.00930733913, 0.00004731582, -0.00000009054]
    : [-216.0475144, 16.2606339, -0.002388645, -0.00113732, 7.01863e-6, -1.291e-8];
  const denom = c[0] + c[1] * bw + c[2] * bw ** 2 + c[3] * bw ** 3 + c[4] * bw ** 4 + c[5] * bw ** 5;
  const score = denom > 0 ? (kg * 500) / denom : 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Total (S+B+D)"><NumField value={total} onChange={setTotal} unit={unit} step={2.5} /></Field>
        <Field label="Bodyweight"><NumField value={body} onChange={setBody} unit={unit} step={0.5} /></Field>
      </div>
      <Field label="Sex"><select className="input" value={sex} onChange={(e) => setSex(e.target.value as typeof sex)}><option value="male">Male</option><option value="female">Female</option></select></Field>
      <Result label="Wilks score" value={score.toFixed(1)} sub="classic formula" accent />
      <p className="text-[10px] font-semibold text-mute">Wilks is the traditional powerlifting coefficient. DOTS is the newer alternative.</p>
    </div>
  );
}

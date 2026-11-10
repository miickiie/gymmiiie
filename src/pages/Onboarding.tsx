import {
  ArrowLeft,
  ArrowRight,
  Check,
  Dumbbell,
  Flame,
  HeartPulse,
  Ruler,
  Scale,
  Sparkles,
  Target,
  User,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Btn, Field, NumField, Segmented, Stepper } from '../components/ui';
import { fromDisplayWeight, toDisplayWeight } from '../lib/stats';
import { useStore } from '../lib/store';
import { useAccount } from '../components/AccountGate';
import type { Unit } from '../types';

const ACTIVITIES = [
  { value: 1.2, label: 'Sedentary', hint: 'Desk job, little movement' },
  { value: 1.375, label: 'Light', hint: '1–2 sessions a week' },
  { value: 1.55, label: 'Moderate', hint: '3–4 sessions a week' },
  { value: 1.725, label: 'Active', hint: '5–6 hard sessions' },
  { value: 1.9, label: 'Very active', hint: 'Physical job or athlete' },
];

export default function Onboarding() {
  const { account, signOut } = useAccount();
  const navigate = useNavigate();
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const setSettings = useStore((s) => s.setSettings);
  const defaultProfile = useStore((s) => s.data.profile);
  const [step, setStep] = useState(0);
  const [unit, setUnit] = useState<Unit>('kg');
  const [name, setName] = useState(defaultProfile.name || account.name);
  const [sex, setSex] = useState<'male' | 'female' | 'other'>(
    defaultProfile.sex ?? 'male',
  );
  const [age, setAge] = useState(defaultProfile.age ?? 28);
  const [height, setHeight] = useState(defaultProfile.heightCm ?? 175);
  const [weight, setWeight] = useState(
    Math.round(toDisplayWeight(defaultProfile.weightKg ?? 75, unit) * 10) / 10,
  );
  const [goal, setGoal] = useState(4);
  const [activity, setActivity] = useState(1.55);

  const steps = ['Welcome', 'Units', 'You', 'Goal'];
  const last = step === steps.length - 1;

  const changeUnit = (u: Unit) => {
    const kg = fromDisplayWeight(weight, unit);
    setUnit(u);
    setWeight(Math.round(toDisplayWeight(kg, u) * 10) / 10);
  };

  const finish = () => {
    completeOnboarding({
      name: name.trim() || 'Athlete',
      sex,
      age,
      heightCm: height,
      weightKg: fromDisplayWeight(weight, unit),
      activity,
    });
    setSettings({ unit, weeklyGoal: goal });
    navigate('/', { replace: true });
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden px-5 pb-8 pt-6 sm:px-8">
      <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[var(--accent)] opacity-[0.12] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-[var(--accent-strong)] opacity-[0.08] blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-lg flex-1 flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] text-lg font-black text-[#1a0d07] shadow-glow">
              G
            </div>
            <div>
              <p className="text-base font-black leading-none">Gymmiie</p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.2em] text-mute">
                Lift · log · grow
              </p>
            </div>
          </div>
          <div className="flex gap-1.5">
            {steps.map((s, i) => (
              <span
                key={s}
                className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-[var(--accent)]' : i < step ? 'w-1.5 bg-[var(--accent)]/50' : 'w-1.5 bg-[var(--surface-3)]'}`}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-dim">
          <p>Signed in as {account.name}</p>
          <Btn size="sm" variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Btn>
        </div>
        <div className="flex flex-1 flex-col justify-center py-8">
          {step === 0 && (
            <div className="animate-fadeUp text-center">
              <div className="mx-auto mb-6 grid h-24 w-24 place-items-center rounded-[2rem] bg-[var(--accent-soft)] text-[var(--accent)] shadow-glow">
                <Dumbbell size={48} strokeWidth={1.8} />
              </div>
              <p className="label mb-2">Offline-first gym log</p>
              <h1 className="text-3xl font-black leading-[1.05] tracking-tight sm:text-4xl">
                Your training.
                <br />
                <span className="text-accent">Your account.</span> Anywhere.
              </h1>
              <p className="mx-auto mt-4 max-w-sm text-sm font-semibold leading-relaxed text-dim">
                Tap the muscles you want to train, log every set, and watch your
                strength climb. Your account keeps the log together across
                devices.
              </p>
              <div className="mx-auto mt-7 grid max-w-sm grid-cols-3 gap-2 text-left">
                {[
                  { icon: <Sparkles size={16} />, t: 'Smart picks' },
                  { icon: <Flame size={16} />, t: 'Live rest' },
                  { icon: <Target size={16} />, t: 'PR tracking' },
                ].map((x) => (
                  <div
                    key={x.t}
                    className="rounded-2xl border border-line bg-[var(--surface)] px-3 py-3"
                  >
                    <span className="text-[var(--accent)]">{x.icon}</span>
                    <p className="mt-2 text-[11px] font-extrabold leading-tight">
                      {x.t}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="animate-fadeUp">
              <p className="label mb-2">Step 1 · Units</p>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                How do you lift?
              </h1>
              <p className="mt-2 text-sm font-semibold text-dim">
                This sets weight units. Heights and distances stay in cm and km.
                Change the setting anytime.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {(['kg', 'lb'] as const).map((u) => (
                  <button
                    key={u}
                    onClick={() => changeUnit(u)}
                    className={`rounded-3xl border p-5 text-left transition ${unit === u ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]' : 'border-line bg-[var(--surface)] hover:border-strong'}`}
                  >
                    <Scale
                      size={22}
                      className={
                        unit === u ? 'text-[var(--accent)]' : 'text-mute'
                      }
                    />
                    <p className="mt-4 text-2xl font-black">
                      {u === 'kg' ? 'Kilograms' : 'Pounds'}
                    </p>
                    <p className="mt-1 text-xs font-bold text-mute">
                      {u === 'kg'
                        ? 'Metric plates · 2.5 kg steps'
                        : 'Imperial plates · 5 lb steps'}
                    </p>
                    {unit === u && (
                      <span className="mt-4 inline-flex items-center gap-1 text-[11px] font-black text-[var(--accent)]">
                        <Check size={13} /> Selected
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fadeUp">
              <p className="label mb-2">Step 2 · Your profile</p>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                A little about you
              </h1>
              <p className="mt-2 text-sm font-semibold text-dim">
                This powers calorie estimates and strength scores. It is saved
                with your account and cached on this device for offline logging.
              </p>
              <div className="mt-5 space-y-4">
                <Field label="Display name">
                  <input
                    className="input"
                    placeholder="What should we call you?"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Sex">
                    <Segmented
                      value={sex}
                      options={[
                        { value: 'male', label: 'Male' },
                        { value: 'female', label: 'Female' },
                        { value: 'other', label: 'Other' },
                      ]}
                      onChange={setSex}
                    />
                  </Field>
                  <Field label="Age">
                    <NumField
                      value={age}
                      onChange={(v) =>
                        setAge(Math.max(13, Math.min(100, Math.round(v))))
                      }
                      unit="yrs"
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Height">
                    <NumField
                      value={height}
                      onChange={(v) =>
                        setHeight(Math.max(100, Math.min(250, v)))
                      }
                      unit="cm"
                    />
                  </Field>
                  <Field label="Weight">
                    <NumField
                      value={weight}
                      onChange={(v) => setWeight(Math.max(20, v))}
                      unit={unit}
                      step={unit === 'lb' ? 1 : 0.5}
                    />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fadeUp">
              <p className="label mb-2">Step 3 · Your goal</p>
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                Set the pace
              </h1>
              <p className="mt-2 text-sm font-semibold text-dim">
                Pick a weekly target and how active you are outside the gym.
              </p>
              <div className="mt-5 rounded-3xl border border-line bg-[var(--surface)] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-extrabold">Workouts per week</p>
                    <p className="mt-0.5 text-xs font-semibold text-mute">
                      Consistency beats intensity.
                    </p>
                  </div>
                  <Stepper
                    value={goal}
                    onChange={setGoal}
                    min={1}
                    max={7}
                    unit="×"
                  />
                </div>
                <div className="mt-4 flex gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <span
                      key={n}
                      className={`h-2 flex-1 rounded-full ${n <= goal ? 'bg-[var(--accent)]' : 'bg-[var(--surface-3)]'}`}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <p className="label">Daily activity</p>
                {ACTIVITIES.map((a) => (
                  <button
                    key={a.value}
                    onClick={() => setActivity(a.value)}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${activity === a.value ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]' : 'border-line bg-[var(--surface)] hover:border-strong'}`}
                  >
                    <span
                      className={`grid h-9 w-9 place-items-center rounded-xl ${activity === a.value ? 'bg-[var(--accent)] text-[#1a0d07]' : 'bg-[var(--surface-2)] text-mute'}`}
                    >
                      {a.value >= 1.7 ? (
                        <HeartPulse size={16} />
                      ) : a.value <= 1.3 ? (
                        <User size={16} />
                      ) : (
                        <Ruler size={16} />
                      )}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-extrabold">
                        {a.label}
                      </span>
                      <span className="block text-[11px] font-semibold text-mute">
                        {a.hint}
                      </span>
                    </span>
                    {activity === a.value && (
                      <Check size={17} className="text-[var(--accent)]" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative flex items-center gap-2">
          {step === 0 && (
            <Btn variant="ghost" onClick={finish}>
              Set up later
            </Btn>
          )}
          {step > 0 && (
            <Btn
              variant="ghost"
              onClick={() => setStep(step - 1)}
              icon={<ArrowLeft size={16} />}
            >
              Back
            </Btn>
          )}
          <Btn
            variant="primary"
            size="lg"
            className="ml-auto flex-1 sm:flex-none sm:min-w-[190px]"
            onClick={() => (last ? finish() : setStep(step + 1))}
            trailing={<ArrowRight size={17} />}
          >
            {step === 0 ? 'Get started' : last ? 'Enter Gymmiie' : 'Continue'}
          </Btn>
        </div>

        <p className="mt-4 text-center text-[10px] font-bold text-mute">
          Based on GymMane by InlitX · GPL-3.0 · Offline logging with account
          sync
        </p>
      </div>
    </div>
  );
}

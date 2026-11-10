import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  Activity,
  Check,
  ChevronRight,
  Cloud,
  Download,
  Info,
  Palette,
  Ruler,
  Shield,
  Smartphone,
  Sparkles,
  Target,
  Timer,
  Trash2,
  Upload,
  User,
  Volume2,
  Vibrate,
  Weight,
  Zap,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { manualSyncStorageKey } from '../lib/accounts';
import {
  DARK_THEMES,
  LIGHT_THEMES,
  themeMeta,
  type ThemeOption,
} from '../lib/theme';
import { useAccount } from '../components/AccountGate';
import { AccountSettingsCard } from '../components/AccountStatus';
import { fromDisplayWeight, toDisplayWeight } from '../lib/stats';
import { downloadFile } from '../lib/db';
import { parseBackup } from '../lib/backup';
import {
  deleteSync,
  downloadSync,
  getSyncInfo,
  uploadSync,
  type SyncInfo,
  type SyncNamespace,
} from '../lib/cloud';
import { beep, vibrate } from '../lib/audio';
import type { AppData, ThemePref } from '../types';
import {
  Btn,
  Card,
  Confirm,
  Field,
  NumField,
  NumericInput,
  PageHeader,
  SectionHeader,
  Segmented,
  Sheet,
  Stepper,
  Toggle,
  useToast,
} from '../components/ui';

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

interface SettingsSnapshot {
  settings: AppData['settings'];
  profile: AppData['profile'];
}

interface SettingReaction {
  key: string;
  message: string;
}

/** Mochi narrates every settings/profile change so the bubble stays lively. */
function settingMessages(
  prev: SettingsSnapshot,
  next: SettingsSnapshot,
): SettingReaction[] {
  const reactions: SettingReaction[] = [];
  const add = (key: string, message: string) =>
    reactions.push({ key, message });
  const was = prev.settings;
  const now = next.settings;
  if (was.theme !== now.theme)
    add('theme', `Switched to ${themeMeta(now.theme).label} theme! ✨`);
  if (was.unit !== now.unit)
    add('unit', `Units set to ${now.unit === 'kg' ? 'kilograms' : 'pounds'}! ⚖️`);
  if (was.weekStart !== now.weekStart)
    add('weekStart', `Week starts on ${WEEKDAYS[now.weekStart]}! 📅`);
  if (was.effort !== now.effort)
    add(
      'effort',
      now.effort === 'off'
        ? 'Effort tracking turned off! 🎯'
        : `Effort tracking set to ${now.effort.toUpperCase()}! 🎯`,
    );
  if (was.weeklyGoal !== now.weeklyGoal)
    add('weeklyGoal', `Weekly goal set to ${now.weeklyGoal}×! 🎯`);
  if (was.autoRest !== now.autoRest)
    add('autoRest', `Auto rest timer ${now.autoRest ? 'on' : 'off'}! ⏱️`);
  if (was.autoAdvance !== now.autoAdvance)
    add('autoAdvance', `Auto advance ${now.autoAdvance ? 'on' : 'off'}! ⏭️`);
  if (was.restSec !== now.restSec)
    add('restSec', `Default rest set to ${now.restSec}s! ⏱️`);
  if (was.sound !== now.sound)
    add('sound', `Sound ${now.sound ? 'on' : 'off'}! 🔊`);
  if (was.vibrate !== now.vibrate)
    add('vibrate', `Vibration ${now.vibrate ? 'on' : 'off'}! 📳`);
  if (was.barWeight !== now.barWeight)
    add('barWeight', 'Bar weight updated! 🏋️');
  if (
    was.plates.length !== now.plates.length ||
    was.plates.some((plate, i) => plate !== now.plates[i])
  )
    add('plates', 'Plate inventory updated! 🏋️');

  const before = prev.profile;
  const after = next.profile;
  if (before.name !== after.name) {
    const name = after.name.trim();
    add('name', name ? `Name saved as ${name}! 🐾` : 'Name cleared! 🐾');
  }
  if (before.weightKg !== after.weightKg)
    add('weightKg', 'Bodyweight updated! ⚖️');
  if (before.sex !== after.sex) add('sex', `Sex set to ${after.sex}. 🐾`);
  if (before.age !== after.age) add('age', `Age set to ${after.age}. 🐾`);
  if (before.heightCm !== after.heightCm)
    add('heightCm', `Height set to ${after.heightCm} cm. 📏`);
  if (before.activity !== after.activity)
    add('activity', 'Activity level updated! 🏃');
  return reactions;
}

/** Debounced so typing in a number/name field produces one spoken update. */
function useCatSettingReactions(data: AppData) {
  const { push, clear } = useToast();
  const previous = useRef<SettingsSnapshot>();
  const pending = useRef(new Map<string, string>());
  useEffect(() => {
    const snapshot: SettingsSnapshot = {
      settings: data.settings,
      profile: data.profile,
    };
    const before = previous.current;
    previous.current = snapshot;
    if (before) {
      for (const reaction of settingMessages(before, snapshot))
        pending.current.set(reaction.key, reaction.message);
    }
    if (!pending.current.size) return;
    const timeout = window.setTimeout(() => {
      const messages = [...pending.current.values()];
      pending.current.clear();
      clear();
      push(messages.join(' '), 'good');
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [data.settings, data.profile, push, clear]);
}

export default function SettingsPage() {
  const { account } = useAccount();
  const toast = useToast();
  const data = useStore((s) => s.data);
  useCatSettingReactions(data);
  const setProfile = useStore((s) => s.setProfile);
  const setSettings = useStore((s) => s.setSettings);
  const replaceData = useStore((s) => s.replaceData);
  const resetAll = useStore((s) => s.resetAll);
  const unit = data.settings.unit;
  const profile = data.profile;
  const [resetOpen, setResetOpen] = useState(false);
  const [newPlate, setNewPlate] = useState('');
  const [importing, setImporting] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    data: AppData;
    name: string;
  } | null>(null);
  const isCommitting = useStore((s) => s.isCommitting);
  const installReadyInit = !!(window as unknown as { __installPrompt?: Event })
    .__installPrompt;
  const [installReady, setInstallReady] = useState(installReadyInit);
  useEffect(() => {
    const onReady = () => setInstallReady(true);
    const onInstalled = () => setInstallReady(false);
    window.addEventListener('gymmiie:installready', onReady);
    window.addEventListener('gymmiie:installed', onInstalled);
    return () => {
      window.removeEventListener('gymmiie:installready', onReady);
      window.removeEventListener('gymmiie:installed', onInstalled);
    };
  }, []);
  const fileRef = useRef<HTMLInputElement>(null);
  const prompt = (
    window as unknown as {
      __installPrompt?: Event & { prompt?: () => Promise<void> };
    }
  ).__installPrompt;
  const weightDisplay =
    Math.round(toDisplayWeight(profile.weightKg, unit) * 10) / 10;

  const exportData = () => {
    downloadFile(
      `gymmiie-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(data, null, 2),
    );
    toast.push('Backup downloaded', 'good');
  };

  const exportCsv = () => {
    const cell = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows: (string | number)[][] = [
      [
        'date',
        'session',
        'duration_sec',
        'exercise',
        'set_index',
        'kind',
        'weight_kg',
        'reps',
        'reps_left',
        'reps_right',
        'rpe',
        'distance_km',
        'seconds',
        'notes',
      ],
    ];
    for (const s of data.sessions) {
      for (const ex of s.exercises) {
        ex.sets.forEach((set, i) => {
          rows.push([
            s.date,
            s.name || '',
            s.durationSec,
            ex.name,
            i + 1,
            set.kind,
            set.weight,
            set.reps,
            set.left ?? '',
            set.right ?? '',
            set.rpe ?? '',
            set.km ?? '',
            set.sec ?? '',
            set.note ?? '',
          ]);
        });
      }
    }
    downloadFile(
      `gymmiie-workouts-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map((r) => r.map(cell).join(',')).join('\n'),
    );
    toast.push('Workout CSV downloaded', 'good');
  };

  const importData = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = parseBackup(JSON.parse(text));
      setPendingImport({ data: parsed, name: file.name });
    } catch (error) {
      toast.push(
        error instanceof Error ? error.message : 'Could not read that backup',
        'bad',
      );
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const install = async () => {
    if (prompt?.prompt) {
      await prompt.prompt();
      setInstallReady(false);
    } else {
      toast.push('Use your browser menu → Add to Home Screen');
    }
  };

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="Settings"
        title="Make it yours"
        subtitle="Your account log saves on this device and syncs when connected. Manual encrypted backups are optional."
      />

      <AccountSettingsCard />
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <SectionHeader
            title="Profile"
            subtitle="Used for calorie and strength estimates"
          />
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] text-xl font-black text-[#1a0d07]">
                {(profile.name || 'G')
                  .trim()
                  .split(/\s+/)
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <input
                  className="input !border-0 !bg-transparent !p-0 text-lg font-black"
                  value={profile.name}
                  aria-label="Training display name"
                  placeholder="Display name"
                  onChange={(e) => setProfile({ name: e.target.value })}
                />
                <p className="text-[10px] font-bold text-mute">
                  Member since{' '}
                  {profile.since
                    ? new Date(profile.since).getFullYear()
                    : new Date().getFullYear()}{' '}
                  · {data.sessions.length} workouts
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Sex">
                <select
                  className="input"
                  value={profile.sex}
                  onChange={(e) =>
                    setProfile({ sex: e.target.value as typeof profile.sex })
                  }
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="Age">
                <NumField
                  value={profile.age}
                  onChange={(v) => setProfile({ age: v })}
                  unit="yrs"
                  min={13}
                  max={100}
                />
              </Field>
              <Field label="Height">
                <NumField
                  value={profile.heightCm}
                  onChange={(v) => setProfile({ heightCm: v })}
                  unit="cm"
                  min={100}
                  max={250}
                />
              </Field>
              <Field label="Weight">
                <NumField
                  value={weightDisplay}
                  onChange={(v) =>
                    setProfile({ weightKg: fromDisplayWeight(v, unit) })
                  }
                  unit={unit}
                  step={0.5}
                />
              </Field>
            </div>
            <Field label="Activity">
              <select
                className="input"
                value={profile.activity}
                onChange={(e) =>
                  setProfile({ activity: Number(e.target.value) })
                }
              >
                <option value={1.2}>Sedentary</option>
                <option value={1.375}>Light (1–2 sessions)</option>
                <option value={1.55}>Moderate (3–4)</option>
                <option value={1.725}>Active (5–6)</option>
                <option value={1.9}>Very active</option>
              </select>
            </Field>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                to="/progress"
                className="flex items-center gap-2 rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs font-extrabold"
              >
                <Ruler size={14} className="text-mute" /> Measurements{' '}
                <ChevronRight size={12} className="ml-auto text-mute" />
              </Link>
              <Link
                to="/nutrition"
                className="flex items-center gap-2 rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs font-extrabold"
              >
                <Target size={14} className="text-mute" /> Macro goals{' '}
                <ChevronRight size={12} className="ml-auto text-mute" />
              </Link>
            </div>
          </Card>

          <SectionHeader title="Appearance" />
          <Card className="space-y-4 p-4">
            <div>
              <p className="label mb-2">Theme</p>
              <ThemePicker
                value={data.settings.theme}
                onChange={(v) => setSettings({ theme: v })}
              />
            </div>
            <div>
              <p className="label mb-1.5">Units</p>
              <Segmented
                value={unit}
                onChange={(v) => setSettings({ unit: v })}
                options={[
                  { value: 'kg', label: 'Kilograms' },
                  { value: 'lb', label: 'Pounds' },
                ]}
              />
            </div>
            <div>
              <p className="label mb-1.5">Week starts on</p>
              <Segmented
                value={String(data.settings.weekStart)}
                onChange={(v) =>
                  setSettings({ weekStart: Number(v) as 0 | 1 | 6 })
                }
                options={[
                  { value: '1', label: 'Monday' },
                  { value: '0', label: 'Sunday' },
                  { value: '6', label: 'Saturday' },
                ]}
              />
            </div>
            <div>
              <p className="label mb-1.5">Effort tracking</p>
              <Segmented
                value={data.settings.effort}
                onChange={(v) => setSettings({ effort: v })}
                options={[
                  { value: 'off', label: 'Off' },
                  { value: 'rpe', label: 'RPE' },
                  { value: 'rir', label: 'RIR' },
                ]}
              />
            </div>
          </Card>
        </div>

        <div>
          <SectionHeader title="Training" />
          <Card className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-extrabold">Weekly goal</p>
                <p className="text-[10px] font-semibold text-mute">
                  Workouts per week
                </p>
              </div>
              <Stepper
                value={data.settings.weeklyGoal}
                onChange={(v) => setSettings({ weeklyGoal: v })}
                min={1}
                max={7}
                unit="×"
              />
            </div>
            <div className="h-px bg-[var(--line)]" />
            <Toggle
              on={data.settings.autoRest}
              onChange={(v) => setSettings({ autoRest: v })}
              label="Auto rest timer"
              hint="Start countdown when a set is completed"
            />
            <Toggle
              on={data.settings.autoAdvance}
              onChange={(v) => setSettings({ autoAdvance: v })}
              label="Auto advance"
              hint="Move to the next exercise after the last set"
            />
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-extrabold">Default rest</p>
                <p className="text-[10px] font-semibold text-mute">
                  Seconds after a working set
                </p>
              </div>
              <Stepper
                value={data.settings.restSec}
                onChange={(v) => setSettings({ restSec: v })}
                min={0}
                max={600}
                step={15}
                unit="s"
              />
            </div>
          </Card>

          <SectionHeader title="Feedback" />
          <Card className="space-y-3 p-4">
            <Toggle
              on={data.settings.sound}
              onChange={(v) => setSettings({ sound: v })}
              label="Sound"
              hint="Rest timer beeps"
            />
            <Toggle
              on={data.settings.vibrate}
              onChange={(v) => setSettings({ vibrate: v })}
              label="Vibration"
              hint="Where supported by your device"
            />
            <div className="flex gap-2 pt-1">
              <Btn
                size="sm"
                onClick={() => {
                  beep(2);
                  toast.push('Beep test');
                }}
                icon={<Volume2 size={14} />}
              >
                Test beep
              </Btn>
              <Btn
                size="sm"
                onClick={() => {
                  vibrate();
                  toast.push('Vibration test');
                }}
                icon={<Vibrate size={14} />}
              >
                Test buzz
              </Btn>
            </div>
          </Card>

          <SectionHeader title="Barbell & plates" />
          <Card className="p-4">
            <Field label="Bar weight">
              <NumField
                value={
                  Math.round(
                    toDisplayWeight(data.settings.barWeight, unit) * 10,
                  ) / 10
                }
                onChange={(v) =>
                  setSettings({ barWeight: fromDisplayWeight(v, unit) })
                }
                unit={unit}
                step={0.5}
              />
            </Field>
            <p className="label mb-1.5 mt-3">Plate inventory ({unit})</p>
            <div className="flex flex-wrap gap-1.5">
              {data.settings.plates.map((p) => (
                <button
                  key={p}
                  onClick={() =>
                    setSettings({
                      plates: data.settings.plates.filter((x) => x !== p),
                    })
                  }
                  className="chip"
                  title="Remove plate"
                >
                  {p} <Trash2 size={10} />
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <NumericInput
                className="input !py-1.5 text-sm"
                placeholder="Add plate"
                value={newPlate}
                onValueChange={setNewPlate}
              />
              <Btn
                size="sm"
                onClick={() => {
                  const v = Number(newPlate);
                  if (!Number.isFinite(v) || v <= 0) {
                    toast.push('Enter a positive finite plate weight', 'bad');
                    return;
                  }
                  if (!data.settings.plates.includes(v)) {
                    setSettings({
                      plates: [...data.settings.plates, v].sort(
                        (a, b) => b - a,
                      ),
                    });
                    setNewPlate('');
                  }
                }}
              >
                Add
              </Btn>
            </div>
            <p className="mt-2 text-[10px] font-semibold text-mute">
              Used by the plate calculator. Values are per side.
            </p>
          </Card>
        </div>
      </div>

      <SectionHeader
        title="Manual encrypted backup"
        subtitle="Optional code-protected backup, separate from account sync"
      />
      <CloudSyncCard />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <SectionHeader title="Data" />
          <Card className="space-y-3 p-4">
            <div className="flex flex-wrap gap-2">
              <Btn onClick={exportData} icon={<Download size={15} />}>
                Export backup
              </Btn>
              <Btn onClick={exportCsv} icon={<Download size={15} />}>
                Export CSV
              </Btn>
              <Btn
                disabled={importing || isCommitting}
                onClick={() => fileRef.current?.click()}
                icon={<Upload size={15} />}
              >
                {importing ? 'Importing…' : 'Import backup'}
              </Btn>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importData(f);
                }}
              />
            </div>
            <div className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-[11px] font-semibold text-mute">
              {data.sessions.length} workouts · {data.notes.length} notes ·{' '}
              {data.routines.length} routines · {data.customExercises.length}{' '}
              custom exercises
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[var(--bad)]/25 bg-[var(--bad-soft)] px-3 py-2">
              <div>
                <p className="text-xs font-black text-[var(--bad)]">
                  Reset all data
                </p>
                <p className="text-[10px] font-semibold text-[var(--bad)]/80">
                  Clears this account’s tracking data
                </p>
              </div>
              <Btn
                size="sm"
                variant="danger"
                onClick={() => setResetOpen(true)}
                icon={<Trash2 size={13} />}
              >
                Reset
              </Btn>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] px-3 py-2">
              <div>
                <p className="text-xs font-black">Persistent storage</p>
                <p className="text-[10px] font-semibold text-mute">
                  Ask the browser to keep your log
                </p>
              </div>
              <Btn
                size="sm"
                onClick={async () => {
                  if (navigator.storage?.persist) {
                    const ok = await navigator.storage.persist();
                    toast.push(
                      ok ? 'Storage protected' : 'Browser declined',
                      ok ? 'good' : 'bad',
                    );
                  } else toast.push('Not supported');
                }}
              >
                Request
              </Btn>
            </div>
          </Card>
        </div>

        <div>
          <SectionHeader title="App" />
          <Card className="space-y-2 p-4">
            {installReady && (
              <button
                onClick={install}
                className="flex w-full items-center gap-3 rounded-xl bg-[var(--accent-soft)] px-3 py-2.5 text-left"
              >
                <Smartphone size={17} className="text-[var(--accent)]" />
                <span className="flex-1">
                  <span className="block text-sm font-extrabold">
                    Install Gymmiie
                  </span>
                  <span className="block text-[10px] font-semibold text-mute">
                    Add to home screen, works offline
                  </span>
                </span>
                <ChevronRight size={15} className="text-mute" />
              </button>
            )}
            <Link
              to="/about"
              className="flex items-center gap-3 rounded-xl bg-[var(--surface-2)] px-3 py-2.5"
            >
              <Info size={17} className="text-mute" />
              <span className="flex-1 text-sm font-extrabold">
                About & credits
              </span>
              <ChevronRight size={15} className="text-mute" />
            </Link>
            <Link
              to="/tools"
              className="flex items-center gap-3 rounded-xl bg-[var(--surface-2)] px-3 py-2.5"
            >
              <Sparkles size={17} className="text-mute" />
              <span className="flex-1 text-sm font-extrabold">Calculators</span>
              <ChevronRight size={15} className="text-mute" />
            </Link>
            <div className="flex items-center gap-2 px-1 pt-1 text-[10px] font-bold text-mute">
              <Shield size={12} /> Offline logging · account sync when connected
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-[10px] font-bold text-mute">
        <span className="flex items-center gap-1">
          <Palette size={12} /> {themeMeta(data.settings.theme).label} theme
        </span>
        <span className="flex items-center gap-1">
          <Weight size={12} /> {unit}
        </span>
        <span className="flex items-center gap-1">
          <Timer size={12} /> {data.settings.restSec}s rest
        </span>
        <span className="flex items-center gap-1">
          <Activity size={12} /> {data.settings.weeklyGoal}× / week
        </span>
      </div>

      <Sheet
        open={!!pendingImport}
        onClose={() => {
          if (!isCommitting) setPendingImport(null);
        }}
        title="Replace local log?"
        footer={
          <div className="flex gap-2">
            <Btn
              className="flex-1"
              disabled={isCommitting}
              onClick={() => setPendingImport(null)}
            >
              Cancel
            </Btn>
            <Btn
              className="flex-1"
              variant="danger"
              disabled={isCommitting}
              onClick={async () => {
                if (!pendingImport) return;
                try {
                  await replaceData(pendingImport.data);
                  setPendingImport(null);
                  toast.push('Backup imported', 'good');
                } catch (error) {
                  toast.push(
                    error instanceof Error ? error.message : 'Import failed',
                    'bad',
                  );
                }
              }}
            >
              {isCommitting ? 'Saving…' : 'Replace local log'}
            </Btn>
          </div>
        }
      >
        {pendingImport && (
          <>
            <p className="mb-3 text-sm font-semibold">
              Import {pendingImport.name}
            </p>
            <BackupSummary data={pendingImport.data} />
            <p className="mt-3 text-sm text-mute">
              Replaces this account’s tracking data, including an active
              workout. Export the current log first to keep both copies.
            </p>
          </>
        )}
      </Sheet>

      <Confirm
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={async () => {
          try {
            await resetAll();
            try {
              localStorage.removeItem(manualSyncStorageKey(account.id, 'code'));
              localStorage.removeItem(
                manualSyncStorageKey(account.id, 'status'),
              );
            } catch {
              /* Optional local preferences may be blocked. */
            }
            toast.push('All data reset', 'good');
          } catch (error) {
            toast.push(
              error instanceof Error ? error.message : 'Reset failed',
              'bad',
            );
            throw error;
          }
        }}
        title="Reset everything?"
        body={`This clears ${account.name}’s workouts, routines, notes, nutrition logs and training settings. The cleared log will sync to this account. Export a backup first to keep a copy. Your account identity remains available.`}
        confirmLabel="Delete everything"
      />
    </div>
  );
}

function BackupSummary({ data }: { data: AppData }) {
  return (
    <div className="rounded-xl bg-[var(--surface-2)] p-3 text-sm font-semibold">
      {data.sessions.length} workouts · {data.routines.length} routines ·{' '}
      {data.notes.length} notes · {data.nutrition.entries.length} meals
      {data.active ? ' · active workout' : ''}
    </div>
  );
}

function ThemePicker({
  value,
  onChange,
}: {
  value: ThemePref;
  onChange: (value: ThemePref) => void;
}) {
  const groups: { label: string; options: readonly ThemeOption[] }[] = [
    { label: 'Dark tones', options: DARK_THEMES },
    { label: 'Light tones', options: LIGHT_THEMES },
  ];
  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-mute">
            {group.label}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {group.options.map((theme) => {
              const active = value === theme.value;
              return (
                <button
                  key={theme.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange(theme.value)}
                  className={clsx(
                    'flex flex-col gap-2 rounded-xl border p-2 text-left transition',
                    active
                      ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]'
                      : 'border-line bg-[var(--surface-2)] hover:border-strong',
                  )}
                >
                  <span
                    className="flex h-8 items-center gap-1 rounded-lg p-1.5"
                    style={{ background: theme.swatch.bg }}
                    aria-hidden="true"
                  >
                    <span
                      className="h-5 w-5 rounded-md"
                      style={{ background: theme.swatch.surface }}
                    />
                    <span
                      className="h-5 flex-1 rounded-md"
                      style={{ background: theme.swatch.accent }}
                    />
                  </span>
                  <span className="flex items-center justify-between gap-1 text-[11px] font-extrabold">
                    {theme.label}
                    {active && (
                      <Check size={12} className="shrink-0 text-accent" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function readLocal(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}
function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Cloud operations still work when optional local preferences are unavailable. */
  }
}

type CloudAction =
  | { kind: 'upload'; code: string; data: AppData; info: SyncInfo }
  | {
      kind: 'restore';
      code: string;
      data: AppData;
      info: { updatedAt: string; namespace: SyncNamespace };
    }
  | { kind: 'delete'; code: string; info: SyncInfo };

function CloudSyncCard() {
  const { account } = useAccount();
  const toast = useToast();
  const data = useStore((s) => s.data);
  const replaceData = useStore((s) => s.replaceData);
  const isCommitting = useStore((s) => s.isCommitting);
  const [code, setCode] = useState(() =>
    readLocal(manualSyncStorageKey(account.id, 'code')),
  );
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState('');
  const [status, setStatus] = useState(() =>
    readLocal(manualSyncStorageKey(account.id, 'status')),
  );
  const [deleteTarget, setDeleteTarget] = useState<SyncNamespace>('v2');
  const [pending, setPending] = useState<CloudAction | null>(null);
  const blocked = !!busy || isCommitting;

  const savedStatus = (message: string, exactCode: string) => {
    setStatus(message);
    remember(manualSyncStorageKey(account.id, 'status'), message);
    remember(manualSyncStorageKey(account.id, 'code'), exactCode);
  };
  const execute = async (action: CloudAction) => {
    setBusy(action.kind);
    try {
      if (action.kind === 'upload') {
        const info = await uploadSync(action.code, action.data);
        savedStatus(
          `Uploaded current copy · ${new Date(info.updatedAt).toLocaleString()}`,
          action.code,
        );
        toast.push('Encrypted snapshot uploaded', 'good');
      } else if (action.kind === 'restore') {
        await replaceData(action.data);
        savedStatus(
          `Restored ${action.info.namespace === 'legacy' ? 'legacy' : 'current'} copy · ${new Date(action.info.updatedAt).toLocaleString()}`,
          action.code,
        );
        toast.push('Snapshot restored', 'good');
      } else {
        await deleteSync(action.code, action.info.namespace);
        savedStatus(
          `${action.info.namespace === 'legacy' ? 'Legacy' : 'Current'} cloud copy deleted`,
          action.code,
        );
        toast.push('Cloud snapshot deleted', 'good');
      }
      setPending(null);
    } catch (error) {
      toast.push(
        error instanceof Error ? error.message : 'Cloud operation failed',
        'bad',
      );
    } finally {
      setBusy('');
    }
  };

  const prepare = async (kind: 'upload' | 'download' | 'delete') => {
    const exactCode = code.trim();
    if (!exactCode) {
      toast.push('Enter a sync code first', 'bad');
      return;
    }
    setBusy(kind);
    try {
      if (kind === 'download') {
        const result = await downloadSync(exactCode);
        if (!result) {
          toast.push('No snapshot found for that code', 'bad');
          return;
        }
        setPending({
          kind: 'restore',
          code: exactCode,
          data: result.data,
          info: result,
        });
      } else {
        const info = await getSyncInfo(
          exactCode,
          kind === 'upload' ? 'v2' : deleteTarget,
        );
        if (kind === 'delete') {
          if (!info) {
            toast.push(
              `No ${deleteTarget === 'legacy' ? 'legacy' : 'current'} cloud copy found`,
              'bad',
            );
            return;
          }
          setPending({ kind: 'delete', code: exactCode, info });
        } else if (info)
          setPending({ kind: 'upload', code: exactCode, data, info });
        else {
          const uploaded = await uploadSync(exactCode, data);
          savedStatus(
            `Uploaded current copy · ${new Date(uploaded.updatedAt).toLocaleString()}`,
            exactCode,
          );
          toast.push('Encrypted snapshot uploaded', 'good');
        }
      }
    } catch (error) {
      toast.push(
        error instanceof Error
          ? error.message
          : 'Could not read the cloud copy',
        'bad',
      );
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <Card className="mt-1 p-4">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Cloud size={18} />
              </div>
              <div>
                <p className="text-sm font-black">Encrypted snapshot</p>
                <p className="text-[10px] font-semibold text-mute">
                  Optional code-protected backup
                </p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <div className="relative flex-1">
                <input
                  aria-label="Secret sync code"
                  disabled={blocked}
                  className="input pr-16 font-mono"
                  type={show ? 'text' : 'password'}
                  placeholder="Your secret sync code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-mute"
                >
                  {show ? 'HIDE' : 'SHOW'}
                </button>
              </div>
              <Btn
                size="sm"
                variant="soft"
                disabled={blocked}
                onClick={() => {
                  if (!code.trim()) {
                    toast.push('Enter a sync code', 'bad');
                    return;
                  }
                  try {
                    localStorage.setItem(
                      manualSyncStorageKey(account.id, 'code'),
                      code.trim(),
                    );
                    toast.push('Sync code saved', 'good');
                  } catch {
                    toast.push(
                      'Browser could not remember the code. Keep a separate copy.',
                      'bad',
                    );
                  }
                }}
              >
                Save
              </Btn>
            </div>
            <p className="mt-1.5 text-[10px] font-semibold text-mute">
              Codes are case-sensitive. Use the exact same code on another
              device. There is no reset link.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn
                size="sm"
                variant="primary"
                onClick={() => prepare('upload')}
                disabled={blocked}
                icon={<Upload size={13} />}
              >
                {busy === 'upload' ? 'Uploading…' : 'Upload'}
              </Btn>
              <Btn
                size="sm"
                onClick={() => prepare('download')}
                disabled={blocked}
                icon={<Download size={13} />}
              >
                {busy === 'download' ? 'Downloading…' : 'Download'}
              </Btn>
              <Btn
                size="sm"
                variant="ghost"
                disabled={blocked}
                onClick={() => {
                  const random = crypto.getRandomValues(new Uint32Array(3));
                  setCode(
                    `rep-${Array.from(random, (n) => n.toString(36).padStart(7, '0')).join('-')}`,
                  );
                  setShow(true);
                  toast.push('New code generated — keep a copy, then upload');
                }}
                icon={<Sparkles size={13} />}
              >
                Generate code
              </Btn>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label
                className="text-[11px] font-bold"
                htmlFor="cloud-delete-target"
              >
                Cloud copy to delete
              </label>
              <select
                id="cloud-delete-target"
                className="input !w-auto !py-1 text-xs"
                disabled={blocked}
                value={deleteTarget}
                onChange={(e) =>
                  setDeleteTarget(e.target.value as SyncNamespace)
                }
              >
                <option value="v2">Current</option>
                <option value="legacy">Legacy</option>
              </select>
              <Btn
                size="sm"
                variant="ghost"
                onClick={() => prepare('delete')}
                disabled={blocked}
                icon={<Trash2 size={13} />}
              >
                Delete cloud copy
              </Btn>
            </div>
            {status && (
              <p className="mt-2 flex items-center gap-1 text-[10px] font-bold text-[var(--good)]">
                <Check size={11} /> {status}
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-line bg-[var(--surface-2)] p-3 text-[11px] font-semibold leading-relaxed text-mute">
            <p className="mb-1 flex items-center gap-1 font-black text-dim">
              <Shield size={12} /> Privacy by design
            </p>
            <p>
              Your browser encrypts the backup with your code. Only ciphertext
              is uploaded. Download previews a snapshot before replacing your
              local log.
            </p>
            <p className="mt-2">
              Older snapshots remain available with the original code. Upload
              creates a current copy and keeps the legacy copy until it is
              explicitly deleted.
            </p>
            <p className="mt-2 flex items-center gap-1">
              <User size={11} /> {data.sessions.length} workouts in this
              snapshot
            </p>
            <p className="flex items-center gap-1">
              <Zap size={11} /> Upload after adding new workouts
            </p>
          </div>
        </div>
      </Card>
      <Sheet
        open={!!pending}
        onClose={() => {
          if (!blocked) setPending(null);
        }}
        title={
          pending?.kind === 'restore'
            ? 'Replace local log?'
            : pending?.kind === 'delete'
              ? 'Delete cloud copy?'
              : 'Overwrite cloud copy?'
        }
        footer={
          <div className="flex gap-2">
            <Btn
              className="flex-1"
              disabled={blocked}
              onClick={() => setPending(null)}
            >
              Cancel
            </Btn>
            <Btn
              className="flex-1"
              variant="danger"
              disabled={blocked}
              onClick={() => {
                if (pending) void execute(pending);
              }}
            >
              {blocked
                ? 'Working…'
                : pending?.kind === 'restore'
                  ? 'Replace local log'
                  : pending?.kind === 'delete'
                    ? 'Delete cloud copy'
                    : 'Overwrite cloud copy'}
            </Btn>
          </div>
        }
      >
        {pending && (
          <div className="space-y-3 text-sm font-semibold">
            <p>
              {pending.info.namespace === 'legacy' ? 'Legacy' : 'Current'} cloud
              copy · {new Date(pending.info.updatedAt).toLocaleString()}
            </p>
            {pending.kind !== 'delete' && <BackupSummary data={pending.data} />}
            <p className="text-mute">
              {pending.kind === 'restore'
                ? 'This replaces this account’s tracking data, including an active workout. Export the current account log first to keep both copies.'
                : pending.kind === 'delete'
                  ? 'Only this selected cloud copy is deleted. Your local log and other cloud copies are kept.'
                  : 'This replaces the selected manual encrypted snapshot with the current account log shown above. The prior snapshot cannot be recovered afterward.'}
            </p>
          </div>
        )}
      </Sheet>
    </>
  );
}

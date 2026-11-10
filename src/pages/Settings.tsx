import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, Check, ChevronRight, Cloud, Download, Info, Palette, Ruler, Shield, Smartphone,
  Sparkles, Target, Timer, Trash2, Upload, User, Volume2, Vibrate, Weight, Zap,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { fromDisplayWeight, toDisplayWeight } from '../lib/stats';
import { downloadFile, clearPersisted } from '../lib/db';
import { deleteSync, downloadSync, uploadSync } from '../lib/cloud';
import { beep, vibrate } from '../lib/audio';
import type { AppData, ThemePref } from '../types';
import {
  Btn, Card, Confirm, Field, NumField, PageHeader, SectionHeader, Segmented, Stepper, Toggle, useToast,
} from '../components/ui';

export default function SettingsPage() {
  const toast = useToast();
  const data = useStore((s) => s.data);
  const setProfile = useStore((s) => s.setProfile);
  const setSettings = useStore((s) => s.setSettings);
  const replaceData = useStore((s) => s.replaceData);
  const resetAll = useStore((s) => s.resetAll);
  const unit = data.settings.unit;
  const profile = data.profile;
  const [resetOpen, setResetOpen] = useState(false);
  const [newPlate, setNewPlate] = useState('');
  const [importing, setImporting] = useState(false);
  const installReadyInit = !!(window as unknown as { __installPrompt?: Event }).__installPrompt;
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
  const prompt = (window as unknown as { __installPrompt?: Event & { prompt?: () => Promise<void> } }).__installPrompt;
  const weightDisplay = Math.round(toDisplayWeight(profile.weightKg, unit) * 10) / 10;

  const exportData = () => {
    downloadFile(`gymmiie-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2));
    toast.push('Backup downloaded', 'good');
  };

  const exportCsv = () => {
    const cell = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows: (string | number)[][] = [[
      'date', 'session', 'duration_sec', 'exercise', 'set_index', 'kind',
      'weight_kg', 'reps', 'reps_left', 'reps_right', 'rpe', 'distance_km', 'seconds', 'notes',
    ]];
    for (const s of data.sessions) {
      for (const ex of s.exercises) {
        ex.sets.forEach((set, i) => {
          rows.push([
            s.date, s.name || '', s.durationSec, ex.name, i + 1, set.kind,
            set.weight, set.reps, set.left ?? '', set.right ?? '', set.rpe ?? '',
            set.km ?? '', set.sec ?? '', set.note ?? '',
          ]);
        });
      }
    }
    downloadFile(`gymmiie-workouts-${new Date().toISOString().slice(0, 10)}.csv`, rows.map((r) => r.map(cell).join(',')).join('\n'));
    toast.push('Workout CSV downloaded', 'good');
  };

  const importData = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as AppData;
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.sessions) || !Array.isArray(parsed.routines)) {
        throw new Error('Not a Gymmiie backup');
      }
      replaceData({ ...parsed, version: 1 });
      toast.push('Backup imported', 'good');
    } catch {
      toast.push('Could not read that backup', 'bad');
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
      <PageHeader eyebrow="Settings" title="Make it yours" subtitle="Everything is stored locally. Cloud sync is optional and end-to-end encrypted." />

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <SectionHeader title="Profile" subtitle="Used for calorie and strength estimates" />
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] text-xl font-black text-[#1a0d07]">
                {(profile.name || 'G').trim().split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <input className="input !border-0 !bg-transparent !p-0 text-lg font-black" value={profile.name} placeholder="Your name" onChange={(e) => setProfile({ name: e.target.value })} />
                <p className="text-[10px] font-bold text-mute">Member since {profile.since ? new Date(profile.since).getFullYear() : new Date().getFullYear()} · {data.sessions.length} workouts</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Sex">
                <select className="input" value={profile.sex} onChange={(e) => setProfile({ sex: e.target.value as typeof profile.sex })}>
                  <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                </select>
              </Field>
              <Field label="Age"><NumField value={profile.age} onChange={(v) => setProfile({ age: Math.max(13, Math.min(100, v)) })} unit="yrs" /></Field>
              <Field label="Height"><NumField value={profile.heightCm} onChange={(v) => setProfile({ heightCm: Math.max(100, Math.min(250, v)) })} unit="cm" /></Field>
              <Field label="Weight"><NumField value={weightDisplay} onChange={(v) => setProfile({ weightKg: fromDisplayWeight(v, unit) })} unit={unit} step={0.5} /></Field>
            </div>
            <Field label="Activity">
              <select className="input" value={profile.activity} onChange={(e) => setProfile({ activity: Number(e.target.value) })}>
                <option value={1.2}>Sedentary</option><option value={1.375}>Light (1–2 sessions)</option><option value={1.55}>Moderate (3–4)</option><option value={1.725}>Active (5–6)</option><option value={1.9}>Very active</option>
              </select>
            </Field>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link to="/progress" className="flex items-center gap-2 rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs font-extrabold"><Ruler size={14} className="text-mute" /> Measurements <ChevronRight size={12} className="ml-auto text-mute" /></Link>
              <Link to="/nutrition" className="flex items-center gap-2 rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs font-extrabold"><Target size={14} className="text-mute" /> Macro goals <ChevronRight size={12} className="ml-auto text-mute" /></Link>
            </div>
          </Card>

          <SectionHeader title="Appearance" />
          <Card className="space-y-4 p-4">
            <div>
              <p className="label mb-2">Theme</p>
              <Segmented value={data.settings.theme} onChange={(v) => setSettings({ theme: v })} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }, { value: 'system', label: 'System' }]} />
            </div>
            <div>
              <p className="label mb-1.5">Units</p>
              <Segmented value={unit} onChange={(v) => setSettings({ unit: v })} options={[{ value: 'kg', label: 'Kilograms' }, { value: 'lb', label: 'Pounds' }]} />
            </div>
            <div>
              <p className="label mb-1.5">Week starts on</p>
              <Segmented value={String(data.settings.weekStart)} onChange={(v) => setSettings({ weekStart: Number(v) as 0 | 1 | 6 })} options={[{ value: '1', label: 'Monday' }, { value: '0', label: 'Sunday' }, { value: '6', label: 'Saturday' }]} />
            </div>
            <div>
              <p className="label mb-1.5">Effort tracking</p>
              <Segmented value={data.settings.effort} onChange={(v) => setSettings({ effort: v })} options={[{ value: 'off', label: 'Off' }, { value: 'rpe', label: 'RPE' }, { value: 'rir', label: 'RIR' }]} />
            </div>
          </Card>
        </div>

        <div>
          <SectionHeader title="Training" />
          <Card className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-extrabold">Weekly goal</p>
                <p className="text-[10px] font-semibold text-mute">Workouts per week</p>
              </div>
              <Stepper value={data.settings.weeklyGoal} onChange={(v) => setSettings({ weeklyGoal: v })} min={1} max={7} unit="×" />
            </div>
            <div className="h-px bg-[var(--line)]" />
            <Toggle on={data.settings.autoRest} onChange={(v) => setSettings({ autoRest: v })} label="Auto rest timer" hint="Start countdown when a set is completed" />
            <Toggle on={data.settings.autoAdvance} onChange={(v) => setSettings({ autoAdvance: v })} label="Auto advance" hint="Move to the next exercise after the last set" />
            <Toggle on={data.settings.countdown} onChange={(v) => setSettings({ countdown: v })} label="Beep countdown" hint="Audible 3-2-1 before rest ends" />
            <div className="flex items-center justify-between gap-2">
              <div><p className="text-sm font-extrabold">Default rest</p><p className="text-[10px] font-semibold text-mute">Seconds after a working set</p></div>
              <Stepper value={data.settings.restSec} onChange={(v) => setSettings({ restSec: v })} min={0} max={600} step={15} unit="s" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <div><p className="text-sm font-extrabold">Mini rest</p><p className="text-[10px] font-semibold text-mute">For drop sets and finishers</p></div>
              <Stepper value={data.settings.miniRestSec} onChange={(v) => setSettings({ miniRestSec: v })} min={0} max={180} step={5} unit="s" />
            </div>
          </Card>

          <SectionHeader title="Feedback" />
          <Card className="space-y-3 p-4">
            <Toggle on={data.settings.sound} onChange={(v) => setSettings({ sound: v })} label="Sound" hint="Rest timer beeps" />
            <Toggle on={data.settings.vibrate} onChange={(v) => setSettings({ vibrate: v })} label="Vibration" hint="Where supported by your device" />
            <div className="flex gap-2 pt-1">
              <Btn size="sm" onClick={() => { beep(2); toast.push('Beep test'); }} icon={<Volume2 size={14} />}>Test beep</Btn>
              <Btn size="sm" onClick={() => { vibrate(); toast.push('Vibration test'); }} icon={<Vibrate size={14} />}>Test buzz</Btn>
            </div>
          </Card>

          <SectionHeader title="Barbell & plates" />
          <Card className="p-4">
            <Field label="Bar weight">
              <NumField value={Math.round(toDisplayWeight(data.settings.barWeight, unit) * 10) / 10} onChange={(v) => setSettings({ barWeight: fromDisplayWeight(v, unit) })} unit={unit} step={0.5} />
            </Field>
            <p className="label mb-1.5 mt-3">Plate inventory ({unit})</p>
            <div className="flex flex-wrap gap-1.5">
              {data.settings.plates.map((p) => (
                <button key={p} onClick={() => setSettings({ plates: data.settings.plates.filter((x) => x !== p) })} className="chip" title="Remove plate">{p} <Trash2 size={10} /></button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input className="input !py-1.5 text-sm" type="number" placeholder="Add plate" value={newPlate} onChange={(e) => setNewPlate(e.target.value)} />
              <Btn size="sm" onClick={() => { const v = Number(newPlate); if (v > 0 && !data.settings.plates.includes(v)) { setSettings({ plates: [...data.settings.plates, v].sort((a, b) => b - a) }); setNewPlate(''); } }}>Add</Btn>
            </div>
            <p className="mt-2 text-[10px] font-semibold text-mute">Used by the plate calculator. Values are per side.</p>
          </Card>
        </div>
      </div>

      <SectionHeader title="Cloud sync" subtitle="Optional encrypted backup · no account required" />
      <CloudSyncCard />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <SectionHeader title="Data" />
          <Card className="space-y-3 p-4">
            <div className="flex flex-wrap gap-2">
              <Btn onClick={exportData} icon={<Download size={15} />}>Export backup</Btn>
              <Btn onClick={exportCsv} icon={<Download size={15} />}>Export CSV</Btn>
              <Btn onClick={() => fileRef.current?.click()} icon={<Upload size={15} />}>{importing ? 'Importing…' : 'Import backup'}</Btn>
              <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importData(f); }} />
            </div>
            <div className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-[11px] font-semibold text-mute">
              {data.sessions.length} workouts · {data.notes.length} notes · {data.routines.length} routines · {data.customExercises.length} custom exercises
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[var(--bad)]/25 bg-[var(--bad-soft)] px-3 py-2">
              <div>
                <p className="text-xs font-black text-[var(--bad)]">Reset all data</p>
                <p className="text-[10px] font-semibold text-[var(--bad)]/80">Deletes everything on this device</p>
              </div>
              <Btn size="sm" variant="danger" onClick={() => setResetOpen(true)} icon={<Trash2 size={13} />}>Reset</Btn>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] px-3 py-2">
              <div>
                <p className="text-xs font-black">Persistent storage</p>
                <p className="text-[10px] font-semibold text-mute">Ask the browser to keep your log</p>
              </div>
              <Btn size="sm" onClick={async () => { if (navigator.storage?.persist) { const ok = await navigator.storage.persist(); toast.push(ok ? 'Storage protected' : 'Browser declined', ok ? 'good' : 'bad'); } else toast.push('Not supported'); }}>Request</Btn>
            </div>
          </Card>
        </div>

        <div>
          <SectionHeader title="App" />
          <Card className="space-y-2 p-4">
            {installReady && (
              <button onClick={install} className="flex w-full items-center gap-3 rounded-xl bg-[var(--accent-soft)] px-3 py-2.5 text-left">
                <Smartphone size={17} className="text-[var(--accent)]" />
                <span className="flex-1"><span className="block text-sm font-extrabold">Install Gymmiie</span><span className="block text-[10px] font-semibold text-mute">Add to home screen, works offline</span></span>
                <ChevronRight size={15} className="text-mute" />
              </button>
            )}
            <Link to="/about" className="flex items-center gap-3 rounded-xl bg-[var(--surface-2)] px-3 py-2.5">
              <Info size={17} className="text-mute" /><span className="flex-1 text-sm font-extrabold">About & credits</span><ChevronRight size={15} className="text-mute" />
            </Link>
            <Link to="/tools" className="flex items-center gap-3 rounded-xl bg-[var(--surface-2)] px-3 py-2.5">
              <Sparkles size={17} className="text-mute" /><span className="flex-1 text-sm font-extrabold">Calculators</span><ChevronRight size={15} className="text-mute" />
            </Link>
            <div className="flex items-center gap-2 px-1 pt-1 text-[10px] font-bold text-mute"><Shield size={12} /> Offline-first · data never leaves this device unless you sync</div>
          </Card>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-[10px] font-bold text-mute">
        <span className="flex items-center gap-1"><Palette size={12} /> {data.settings.theme} theme</span>
        <span className="flex items-center gap-1"><Weight size={12} /> {unit}</span>
        <span className="flex items-center gap-1"><Timer size={12} /> {data.settings.restSec}s rest</span>
        <span className="flex items-center gap-1"><Activity size={12} /> {data.settings.weeklyGoal}× / week</span>
      </div>

      <Confirm
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={async () => { resetAll(); await clearPersisted(); toast.push('All data reset'); }}
        title="Reset everything?"
        body="This deletes all workouts, routines, notes, nutrition logs and settings on this device. Export a backup first if you might want it back."
        confirmLabel="Delete everything"
      />
    </div>
  );
}

function CloudSyncCard() {
  const toast = useToast();
  const data = useStore((s) => s.data);
  const replaceData = useStore((s) => s.replaceData);
  const [code, setCode] = useState(() => localStorage.getItem('gymmiie:sync-code') ?? '');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState('');
  const [status, setStatus] = useState(() => localStorage.getItem('gymmiie:sync-status') ?? '');

  const saveCode = () => {
    if (!code.trim()) { toast.push('Enter a sync code', 'bad'); return; }
    localStorage.setItem('gymmiie:sync-code', code.trim());
    toast.push('Sync code saved on this device', 'good');
  };

  const generate = () => {
    const words = ['iron', 'ember', 'basalt', 'anvil', 'forge', 'chalk', 'plate', 'rep', 'bar', 'grip'];
    const code2 = `${words[Math.floor(Math.random() * words.length)]}-${words[Math.floor(Math.random() * words.length)]}-${Math.random().toString(36).slice(2, 8)}`;
    setCode(code2);
    setShow(true);
    toast.push('New code generated — save and upload', 'good');
  };

  const run = async (kind: 'upload' | 'download' | 'delete') => {
    if (!code.trim()) { toast.push('Enter a sync code first', 'bad'); return; }
    setBusy(kind);
    try {
      if (kind === 'upload') {
        const info = await uploadSync(code.trim(), data);
        const msg = `Uploaded · ${new Date(info.updatedAt).toLocaleString()}`;
        setStatus(msg); localStorage.setItem('gymmiie:sync-status', msg); localStorage.setItem('gymmiie:sync-code', code.trim());
        toast.push('Encrypted snapshot uploaded', 'good');
      } else if (kind === 'download') {
        const result = await downloadSync(code.trim());
        if (!result) { toast.push('No snapshot found for that code', 'bad'); return; }
        replaceData({ ...(result.data as AppData), version: 1 });
        const msg = `Downloaded · ${new Date(result.updatedAt).toLocaleString()}`;
        setStatus(msg); localStorage.setItem('gymmiie:sync-status', msg);
        toast.push('Snapshot restored', 'good');
      } else {
        await deleteSync(code.trim());
        const msg = 'Snapshot deleted from cloud';
        setStatus(msg); localStorage.setItem('gymmiie:sync-status', msg);
        toast.push('Cloud snapshot deleted');
      }
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Sync failed', 'bad');
    } finally {
      setBusy('');
    }
  };

  return (
    <Card className="mt-1 p-4">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Cloud size={18} /></div>
            <div>
              <p className="text-sm font-black">Encrypted snapshot</p>
              <p className="text-[10px] font-semibold text-mute">AES-GCM · PBKDF2 · the server never sees plaintext</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <div className="relative flex-1">
              <input
                className="input pr-16 font-mono"
                type={show ? 'text' : 'password'}
                placeholder="Your secret sync code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <button onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-mute">{show ? 'HIDE' : 'SHOW'}</button>
            </div>
            <Btn size="sm" variant="soft" onClick={saveCode}>Save</Btn>
          </div>
          <p className="mt-1.5 text-[10px] font-semibold text-mute">Use the same code on another device to pull your log. Lose the code and the snapshot cannot be decrypted — there is no reset link.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn size="sm" variant="primary" onClick={() => run('upload')} disabled={!!busy} icon={<Upload size={13} />}>{busy === 'upload' ? 'Uploading…' : 'Upload'}</Btn>
            <Btn size="sm" onClick={() => run('download')} disabled={!!busy} icon={<Download size={13} />}>{busy === 'download' ? 'Downloading…' : 'Download'}</Btn>
            <Btn size="sm" variant="ghost" onClick={() => run('delete')} disabled={!!busy} icon={<Trash2 size={13} />}>Delete cloud copy</Btn>
            <Btn size="sm" variant="ghost" onClick={generate} icon={<Sparkles size={13} />}>Generate code</Btn>
          </div>
          {status && <p className="mt-2 flex items-center gap-1 text-[10px] font-bold text-[var(--good)]"><Check size={11} /> {status}</p>}
        </div>
        <div className="rounded-2xl border border-line bg-[var(--surface-2)] p-3 text-[11px] font-semibold leading-relaxed text-mute">
          <p className="mb-1 flex items-center gap-1 font-black text-dim"><Shield size={12} /> Privacy by design</p>
          <p>Your browser encrypts the backup with a key derived from your code. Only ciphertext is uploaded to Cloudflare D1. No email, no account, no tracking.</p>
          <p className="mt-2 flex items-center gap-1"><User size={11} /> {data.sessions.length} workouts in this snapshot</p>
          <p className="flex items-center gap-1"><Zap size={11} /> Upload after adding new workouts</p>
        </div>
      </div>
    </Card>
  );
}

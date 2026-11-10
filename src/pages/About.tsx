import { Link } from 'react-router-dom';
import {
  Activity, BookOpen, Cloud, Code2, Dumbbell, Github, Heart, Lock, Salad, Shield, Sparkles,
  Timer, Trophy, WifiOff, Wrench,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { Card, PageHeader } from '../components/ui';

const FEATURES = [
  { icon: <Dumbbell size={18} />, title: 'Muscle-first training', body: 'Tap a body map, get a balanced session with warm-ups and last-time loads.' },
  { icon: <Timer size={18} />, title: 'Live set logging', body: 'Rest countdown, supersets, drop sets, RPE, cardio distance and hold timers.' },
  { icon: <BookOpen size={18} />, title: '466 exercises', body: 'Search by muscle, equipment or name, with step-by-step form notes.' },
  { icon: <Trophy size={18} />, title: 'Progress that sticks', body: 'Estimated 1RM, PRs, weekly volume, muscle heatmaps and 15 awards.' },
  { icon: <Salad size={18} />, title: 'Nutrition log', body: '561 foods and 27 dishes with macros, water tracking and daily goals.' },
  { icon: <Wrench size={18} />, title: 'Ten calculators', body: '1RM, BMI, calories, body fat, FFMI, plates, warm-ups, RPE, DOTS and Wilks.' },
  { icon: <Activity size={18} />, title: 'Body tracking', body: 'Bodyweight trends, tape measurements, goals and progress photos-ready notes.' },
  { icon: <WifiOff size={18} />, title: 'Works offline', body: 'Installable PWA. Your log opens instantly in the gym basement with no signal.' },
];

export default function About() {
  const data = useStore((s) => s.data);
  return (
    <div className="page-enter">
      <PageHeader eyebrow="About" title="Built for the long haul" subtitle="A GymMane-inspired training log for the open web." />

      <Card className="relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[var(--accent)] opacity-[0.1] blur-3xl" />
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] text-3xl font-black text-[#1a0d07] shadow-glow">G</div>
          <div>
            <h2 className="text-2xl font-black tracking-tight">Gymmiie</h2>
            <p className="text-sm font-semibold text-dim">Lift. Log it. Grow.</p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-mute">Version 1.0.0 · web edition</p>
          </div>
          <div className="ml-auto grid grid-cols-3 gap-4 text-center">
            <div><p className="num text-xl font-black">{data.sessions.length}</p><p className="text-[9px] font-black uppercase text-mute">workouts</p></div>
            <div><p className="num text-xl font-black">{data.routines.length}</p><p className="text-[9px] font-black uppercase text-mute">routines</p></div>
            <div><p className="num text-xl font-black">{data.notes.length}</p><p className="text-[9px] font-black uppercase text-mute">notes</p></div>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-sm font-semibold leading-relaxed text-dim">
          Gymmiie is an offline-first gym log that runs entirely in your browser. No account, no ads, no subscription. Your training stays on your device, and optional cloud sync is end-to-end encrypted so the server only ever holds ciphertext.
        </p>
      </Card>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {FEATURES.map((f) => (
          <Card key={f.title} className="p-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">{f.icon}</span>
            <p className="mt-3 text-sm font-black">{f.title}</p>
            <p className="mt-1 text-[11px] font-semibold leading-relaxed text-mute">{f.body}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Heart size={18} className="text-[var(--accent)]" />
            <h3 className="text-base font-black">Based on GymMane</h3>
          </div>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-dim">
            Gymmiie is a web reimplementation inspired by <strong>GymMane</strong> by <strong>InlitX</strong>. The exercise catalog, food database and core training concepts were reverse-engineered from the open-source Android app.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href="https://github.com/InlitX/GymMane" target="_blank" rel="noreferrer" className="btn btn-soft px-3 py-2 text-xs"><Github size={14} /> InlitX/GymMane</a>
            <span className="rounded-full border border-line px-3 py-2 text-xs font-black text-mute">GPL-3.0</span>
          </div>
          <p className="mt-3 text-[11px] font-semibold leading-relaxed text-mute">
            Gymmiie is distributed under the GNU General Public License v3.0, matching the upstream project. Exercise animations are bundled under CC BY-SA 4.0 from <strong>Workout Guide</strong> by Bryl Lim, <strong>Everkinetic</strong> (incl. the step-by-step instructions) and GymMane's derived pose data — per-exercise provenance is published in <code>public/art/ATTRIBUTION.md</code>. These remain the property of their creators under their respective licences.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href="https://github.com/bryllim/workout-guide" target="_blank" rel="noreferrer" className="btn btn-soft px-3 py-2 text-xs">bryllim/workout-guide</a>
            <a href="https://github.com/everkinetic/data" target="_blank" rel="noreferrer" className="btn btn-soft px-3 py-2 text-xs">everkinetic/data</a>
            <span className="rounded-full border border-line px-3 py-2 text-xs font-black text-mute">CC BY-SA 4.0</span>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-[var(--good)]" />
            <h3 className="text-base font-black">Privacy</h3>
          </div>
          <div className="mt-3 space-y-2.5 text-xs font-semibold leading-relaxed text-dim">
            <p className="flex gap-2"><Lock size={14} className="mt-0.5 shrink-0 text-mute" /> All workouts, notes, nutrition and passes live in IndexedDB on this device.</p>
            <p className="flex gap-2"><Cloud size={14} className="mt-0.5 shrink-0 text-mute" /> Cloud sync is opt-in. Snapshots are encrypted in your browser with AES-GCM and a PBKDF2-derived key.</p>
            <p className="flex gap-2"><WifiOff size={14} className="mt-0.5 shrink-0 text-mute" /> There are no analytics, trackers or third-party pixels. The app works fully offline.</p>
            <p className="flex gap-2"><Sparkles size={14} className="mt-0.5 shrink-0 text-mute" /> Export a JSON backup any time from Settings. You own the data.</p>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Code2 size={18} className="text-[var(--accent)]" />
            <h3 className="text-base font-black">Under the hood</h3>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-bold text-dim">
            {['React 18', 'TypeScript', 'Vite', 'Tailwind CSS', 'Zustand + Immer', 'IndexedDB', 'Cloudflare Workers', 'Cloudflare D1'].map((t) => (
              <span key={t} className="rounded-lg bg-[var(--surface-2)] px-2.5 py-1.5">{t}</span>
            ))}
          </div>
          <p className="mt-3 text-[11px] font-semibold leading-relaxed text-mute">
            The frontend is a single-page PWA. A Cloudflare Worker serves the static build and exposes a small optional sync API backed by D1.
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-[var(--accent)]" />
            <h3 className="text-base font-black">Credits & data</h3>
          </div>
          <div className="mt-3 space-y-2 text-xs font-semibold leading-relaxed text-dim">
            <p><strong>GymMane</strong> by InlitX — original app, exercise catalog, foods and program concepts.</p>
            <p><strong>Lucide</strong> — open-source icon set used for exercise and UI icons.</p>
            <p><strong>Nunito</strong> — typeface by Vernon Adams, via Google Fonts.</p>
            <p><strong>OpenPowerlifting</strong> — DOTS scoring coefficients.</p>
            <p className="text-mute">Nutrition values are approximate and compiled from common food databases. Not medical advice.</p>
          </div>
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-[var(--surface)] px-4 py-4">
        <div>
          <p className="text-sm font-black">Train hard. Log honestly. Recover well.</p>
          <p className="mt-0.5 text-[11px] font-semibold text-mute">If Gymmiie helps you, share it with a training partner.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/train" className="btn btn-primary px-4 py-2.5 text-sm">Start a workout</Link>
          <Link to="/settings" className="btn btn-soft px-4 py-2.5 text-sm">Settings</Link>
        </div>
      </div>

      <p className="mt-5 text-center text-[10px] font-bold text-mute">
        Gymmiie · GPL-3.0 · Based on GymMane by InlitX · Not affiliated with InlitX
      </p>
    </div>
  );
}

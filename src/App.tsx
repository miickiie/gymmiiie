import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useStore } from './lib/store';
import Layout from './components/Layout';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Train from './pages/Train';
import Session from './pages/Session';
import History from './pages/History';
import SessionDetail from './pages/SessionDetail';
import Library from './pages/Library';
import ExerciseDetail from './pages/ExerciseDetail';
import Routines from './pages/Routines';
import RoutineEditor from './pages/RoutineEditor';
import Progress from './pages/Progress';
import Nutrition from './pages/Nutrition';
import Notes from './pages/Notes';
import Tools from './pages/Tools';
import Settings from './pages/Settings';
import About from './pages/About';
import PassPage from './pages/Pass';

export default function App() {
  const hydrated = useStore((s) => s.hydrated);
  const theme = useStore((s) => s.data.settings.theme);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const light = theme === 'light' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('light', light);
      document.documentElement.classList.toggle('dark', !light);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', light ? '#f6f1e9' : '#0b0a09');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  const onboarded = useStore((s) => s.data.onboarded);

  if (!hydrated) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="flex flex-col items-center gap-4">
          <div className="grid h-16 w-16 animate-pulseSoft place-items-center rounded-3xl bg-[var(--accent)] text-3xl font-black text-[#1a0d07]">G</div>
          <p className="label">Loading your log</p>
        </div>
      </div>
    );
  }

  if (!onboarded) return <Onboarding />;

  return (
    <Layout>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/train" element={<Train />} />
        <Route path="/session" element={<Session />} />
        <Route path="/history" element={<History />} />
        <Route path="/history/:id" element={<SessionDetail />} />
        <Route path="/library" element={<Library />} />
        <Route path="/library/:id" element={<ExerciseDetail />} />
        <Route path="/routines" element={<Routines />} />
        <Route path="/routines/:id" element={<RoutineEditor />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/nutrition" element={<Nutrition />} />
        <Route path="/notes" element={<Notes />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/pass" element={<PassPage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}

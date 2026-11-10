import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigationType,
  useNavigate,
} from 'react-router-dom';
import { useStore } from './lib/store';
import { getLibraryView } from './lib/libraryView';
import Layout from './components/Layout';
import { Btn, Confirm } from './components/ui';
import { LegacyDeviceNotice } from './components/AccountGate';
import { AccountSyncNotice } from './components/AccountStatus';

const Onboarding = lazy(() => import('./pages/Onboarding'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Train = lazy(() => import('./pages/Train'));
const Session = lazy(() => import('./pages/Session'));
const History = lazy(() => import('./pages/History'));
const SessionDetail = lazy(() => import('./pages/SessionDetail'));
const Library = lazy(() => import('./pages/Library'));
const ExerciseDetail = lazy(() => import('./pages/ExerciseDetail'));
const Routines = lazy(() => import('./pages/Routines'));
const RoutineEditor = lazy(() => import('./pages/RoutineEditor'));
const Progress = lazy(() => import('./pages/Progress'));
const Nutrition = lazy(() => import('./pages/Nutrition'));
const Notes = lazy(() => import('./pages/Notes'));
const Tools = lazy(() => import('./pages/Tools'));
const Settings = lazy(() => import('./pages/Settings'));
const About = lazy(() => import('./pages/About'));
const PassPage = lazy(() => import('./pages/Pass'));

function Loading({ label = 'Loading your log' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-label={label === 'Opening screen' ? 'Loading page' : label}
      className="grid min-h-[45vh] place-items-center"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="grid h-16 w-16 animate-pulseSoft place-items-center rounded-3xl bg-[var(--accent)] text-3xl font-black text-[#1a0d07]">
          G
        </div>
        <p className="label">{label}</p>
      </div>
    </div>
  );
}

function StorageRecovery({ blocking = false }: { blocking?: boolean }) {
  const status = useStore((s) => s.persistenceStatus);
  const message = useStore((s) => s.persistenceError);
  const committing = useStore((s) => s.isCommitting);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(false);
  if (status !== 'error' && status !== 'conflict') return null;
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Recovery failed. The current copy has been kept.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={blocking ? 'mx-auto max-w-xl px-5 py-16' : 'mb-5'}>
      <section
        role="alert"
        className="rounded-2xl border border-[var(--bad)]/40 bg-[var(--bad-soft)] p-4"
      >
        <h1 className="text-base font-black">
          {blocking
            ? 'Your saved log could not be opened'
            : status === 'conflict'
              ? 'Another tab saved a newer log'
              : 'Changes have not been saved'}
        </h1>
        <p className="mt-2 text-sm font-semibold text-dim">
          {message ||
            'Your current copy is kept. Export a backup before reloading.'}
        </p>
        <p className="mt-2 text-xs font-semibold text-dim">
          {blocking
            ? 'Retry opening storage or export the stored backup for recovery. Existing data will not be replaced with a new profile.'
            : 'Editing is paused until storage is available. Export this copy before loading the latest saved log.'}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn
            disabled={busy || committing}
            onClick={() => void run(() => useStore.getState().recoveryExport())}
          >
            {blocking ? 'Export stored backup' : 'Export unsaved copy'}
          </Btn>
          {status === 'error' && (
            <Btn
              variant="primary"
              disabled={busy || committing}
              onClick={() =>
                void run(() => useStore.getState().retryPersistence())
              }
            >
              {busy ? 'Working…' : 'Retry'}
            </Btn>
          )}
          {!blocking && (
            <Btn disabled={busy || committing} onClick={() => setReload(true)}>
              Reload latest…
            </Btn>
          )}
        </div>
        {error && (
          <p className="mt-3 text-sm font-bold text-[var(--bad)]">{error}</p>
        )}
      </section>
      <Confirm
        open={reload}
        onClose={() => setReload(false)}
        title="Load the latest saved log?"
        body="This replaces this tab’s unsaved changes with the latest stored copy. Export the unsaved copy first if those changes should be kept."
        confirmLabel="Reload latest"
        onConfirm={() => useStore.getState().reloadPersisted()}
      />
    </div>
  );
}

function RouteError() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  return (
    <div role="alert" className="card p-5">
      <h1 className="text-lg font-black">This screen could not be loaded</h1>
      <p className="mt-2 text-sm text-dim">
        Reconnect and retry. The saved log is still on this device.
      </p>
      <div className="mt-4 flex gap-2">
        <Btn onClick={() => navigate('/')}>Return to Today</Btn>
        <Btn
          onClick={() =>
            void useStore
              .getState()
              .flushPersistence()
              .then(() => window.location.reload())
              .catch(() =>
                setError('Save or export the current log before reloading.'),
              )
          }
        >
          Reload app
        </Btn>
      </div>
      {error && <p className="mt-3 text-sm text-[var(--bad)]">{error}</p>}
    </div>
  );
}
class ScreenBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <RouteError /> : this.props.children;
  }
}

export default function App() {
  const hydrated = useStore((s) => s.hydrated);
  const status = useStore((s) => s.persistenceStatus);
  const theme = useStore((s) => s.data.settings.theme);
  const onboarded = useStore((s) => s.data.onboarded);
  const { pathname, key: routeKey } = useLocation();
  useEffect(() => {
    document.documentElement.classList.toggle(
      'session-route',
      pathname === '/session',
    );
    return () => document.documentElement.classList.remove('session-route');
  }, [pathname]);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const light = theme === 'light' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('light', light);
      document.documentElement.classList.toggle('dark', !light);
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', light ? '#f6f1e9' : '#0b0a09');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
  if (!hydrated)
    return status === 'error' ? <StorageRecovery blocking /> : <Loading />;
  if (!onboarded)
    return (
      <>
        <StorageRecovery />
        <ScreenBoundary key="onboarding">
          <Suspense fallback={<Loading label="Opening profile setup" />}>
            <Onboarding />
          </Suspense>
        </ScreenBoundary>
      </>
    );
  return (
    <Layout>
      <StorageRecovery />
      <AccountSyncNotice />
      <LegacyDeviceNotice />
      <ScrollToTop />
      <ScreenBoundary key={pathname}>
        <Suspense fallback={<Loading label="Opening screen" />}>
          <section aria-label="Page content" data-route={pathname}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/train" element={<Train />} />
              <Route path="/session" element={<Session />} />
              <Route path="/history" element={<History />} />
              <Route path="/history/:id" element={<SessionDetail />} />
              <Route path="/library" element={<Library key={routeKey} />} />
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
          </section>
        </Suspense>
      </ScreenBoundary>
    </Layout>
  );
}
function ScrollToTop() {
  const { pathname, key } = useLocation();
  const navigationType = useNavigationType();
  const accountId = useStore((s) => s.account?.id);
  useEffect(() => {
    if (navigationType === 'POP' && pathname === '/library' && getLibraryView(key, accountId)) return;
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, key, accountId, navigationType]);
  return null;
}

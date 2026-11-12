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
import { isLightTheme, themeMeta } from './lib/theme';
import { setLanguage, useI18n } from './lib/i18n';
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

const TH = {
  'Loading your log': 'กำลังโหลดบันทึกของคุณ',
  'Opening profile setup': 'กำลังเปิดหน้าตั้งค่าโปรไฟล์',
  'Opening screen': 'กำลังเปิดหน้าจอ',
  'Loading page': 'กำลังโหลดหน้า',
  'Page content': 'เนื้อหาหน้า',
  'Recovery failed. The current copy has been kept.':
    'กู้คืนไม่สำเร็จ ข้อมูลปัจจุบันยังอยู่',
  'Your saved log could not be opened': 'เปิดข้อมูลที่บันทึกไว้ไม่ได้',
  'Another tab saved a newer log': 'แท็บอื่นบันทึกข้อมูลใหม่กว่า',
  'Changes have not been saved': 'ยังบันทึกการเปลี่ยนแปลงไม่สำเร็จ',
  'Your current copy is kept. Export a backup before reloading.':
    'ข้อมูลปัจจุบันยังอยู่ ส่งออกไฟล์สำรองก่อนโหลดใหม่',
  'Retry opening storage or export the stored backup for recovery. Existing data will not be replaced with a new profile.':
    'ลองเปิดที่เก็บข้อมูลอีกครั้ง หรือส่งออกไฟล์สำรองเพื่อกู้คืน ข้อมูลเดิมจะไม่ถูกแทนที่ด้วยโปรไฟล์ใหม่',
  'Editing is paused until storage is available. Export this copy before loading the latest saved log.':
    'หยุดแก้ไขชั่วคราวจนกว่าที่เก็บข้อมูลจะพร้อม ส่งออกข้อมูลชุดนี้ก่อนโหลดบันทึกล่าสุด',
  'Export stored backup': 'ส่งออกไฟล์สำรอง',
  'Export unsaved copy': 'ส่งออกข้อมูลที่ยังไม่บันทึก',
  'Reload latest…': 'โหลดข้อมูลล่าสุด…',
  'Load the latest saved log?': 'โหลดบันทึกล่าสุดที่บันทึกไว้?',
  'This replaces this tab’s unsaved changes with the latest stored copy. Export the unsaved copy first if those changes should be kept.':
    'การทำเช่นนี้จะแทนที่การแก้ไขที่ยังไม่บันทึกในแท็บนี้ด้วยข้อมูลล่าสุดที่เก็บไว้ ถ้าต้องการเก็บการแก้ไขไว้ ให้ส่งออกข้อมูลชุดนี้ก่อน',
  'Reload latest': 'โหลดล่าสุด',
  'This screen could not be loaded': 'เปิดหน้านี้ไม่ได้',
  'Reconnect and retry. The saved log is still on this device.':
    'เชื่อมต่อแล้วลองใหม่ บันทึกยังอยู่ในเครื่องนี้',
  'Return to Today': 'กลับไปหน้าวันนี้',
  'Reload app': 'โหลดแอปใหม่',
  'Save or export the current log before reloading.':
    'บันทึกหรือส่งออกข้อมูลปัจจุบันก่อนโหลดใหม่',
};

function Loading({
  label = 'Loading your log',
  ariaLabel,
}: {
  label?: string;
  ariaLabel?: string;
}) {
  const { t } = useI18n(TH);
  return (
    <div
      role="status"
      aria-label={t(ariaLabel ?? label)}
      className="grid min-h-[45vh] place-items-center"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="grid h-16 w-16 animate-pulseSoft place-items-center rounded-3xl bg-[var(--accent)] text-3xl font-black text-[#1a0d07]">
          G
        </div>
        <p className="label">{t(label)}</p>
      </div>
    </div>
  );
}

function StorageRecovery({ blocking = false }: { blocking?: boolean }) {
  const { t } = useI18n(TH);
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
            ? t('Your saved log could not be opened')
            : status === 'conflict'
              ? t('Another tab saved a newer log')
              : t('Changes have not been saved')}
        </h1>
        <p className="mt-2 text-sm font-semibold text-dim">
          {(message && t(message)) ||
            t('Your current copy is kept. Export a backup before reloading.')}
        </p>
        <p className="mt-2 text-xs font-semibold text-dim">
          {blocking
            ? t(
                'Retry opening storage or export the stored backup for recovery. Existing data will not be replaced with a new profile.',
              )
            : t(
                'Editing is paused until storage is available. Export this copy before loading the latest saved log.',
              )}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn
            disabled={busy || committing}
            onClick={() => void run(() => useStore.getState().recoveryExport())}
          >
            {blocking ? t('Export stored backup') : t('Export unsaved copy')}
          </Btn>
          {status === 'error' && (
            <Btn
              variant="primary"
              disabled={busy || committing}
              onClick={() =>
                void run(() => useStore.getState().retryPersistence())
              }
            >
              {busy ? t('Working…') : t('Retry')}
            </Btn>
          )}
          {!blocking && (
            <Btn disabled={busy || committing} onClick={() => setReload(true)}>
              {t('Reload latest…')}
            </Btn>
          )}
        </div>
        {error && (
          <p className="mt-3 text-sm font-bold text-[var(--bad)]">{t(error)}</p>
        )}
      </section>
      <Confirm
        open={reload}
        onClose={() => setReload(false)}
        title={t('Load the latest saved log?')}
        body={t(
          'This replaces this tab’s unsaved changes with the latest stored copy. Export the unsaved copy first if those changes should be kept.',
        )}
        confirmLabel={t('Reload latest')}
        onConfirm={() => useStore.getState().reloadPersisted()}
      />
    </div>
  );
}

function RouteError() {
  const { t } = useI18n(TH);
  const navigate = useNavigate();
  const [error, setError] = useState('');
  return (
    <div role="alert" className="card p-5">
      <h1 className="text-lg font-black">
        {t('This screen could not be loaded')}
      </h1>
      <p className="mt-2 text-sm text-dim">
        {t('Reconnect and retry. The saved log is still on this device.')}
      </p>
      <div className="mt-4 flex gap-2">
        <Btn onClick={() => navigate('/')}>{t('Return to Today')}</Btn>
        <Btn
          onClick={() =>
            void useStore
              .getState()
              .flushPersistence()
              .then(() => window.location.reload())
              .catch(() =>
                setError(t('Save or export the current log before reloading.')),
              )
          }
        >
          {t('Reload app')}
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
  const { t } = useI18n(TH);
  const hydrated = useStore((s) => s.hydrated);
  const status = useStore((s) => s.persistenceStatus);
  const theme = useStore((s) => s.data.settings.theme);
  const language = useStore((s) => s.data.settings.language ?? 'en');
  const onboarded = useStore((s) => s.data.onboarded);
  useEffect(() => setLanguage(language), [language]);
  const { pathname, key: routeKey } = useLocation();
  useEffect(() => {
    document.documentElement.classList.toggle(
      'session-route',
      pathname === '/session',
    );
    return () => document.documentElement.classList.remove('session-route');
  }, [pathname]);
  useEffect(() => {
    const themeOption = themeMeta(theme);
    const light = isLightTheme(theme);
    document.documentElement.dataset.theme = themeOption.value;
    document.documentElement.classList.toggle('light', light);
    document.documentElement.classList.toggle('dark', !light);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', themeOption.themeColor);
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
          <section aria-label={t('Page content')} data-route={pathname}>
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
    if (
      navigationType === 'POP' &&
      pathname === '/library' &&
      getLibraryView(key, accountId)
    )
      return;
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, key, accountId, navigationType]);
  return null;
}

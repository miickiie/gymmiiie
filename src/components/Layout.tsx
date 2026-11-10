import clsx from 'clsx';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  CloudSun,
  CreditCard,
  Download,
  Dumbbell,
  Flame,
  Home,
  Info,
  Menu,
  NotebookPen,
  Salad,
  Settings,
  Timer,
  Trophy,
  Wrench,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { dateKey, fmtClock } from '../lib/date';
import { activeElapsed, currentStreak } from '../lib/stats';
import { useStore } from '../lib/store';
import { Avatar, Btn, Sheet, useNow } from './ui';
import { useAccount } from './AccountGate';

const NAV = [
  { to: '/', label: 'Today', icon: Home },
  { to: '/train', label: 'Train', icon: Dumbbell },
  { to: '/library', label: 'Exercises', icon: BookOpen },
  { to: '/routines', label: 'Routines', icon: CalendarDays },
  { to: '/progress', label: 'Progress', icon: BarChart3 },
  { to: '/history', label: 'History', icon: Timer },
  { to: '/nutrition', label: 'Nutrition', icon: Salad },
  { to: '/notes', label: 'Journal', icon: NotebookPen },
  { to: '/tools', label: 'Tools', icon: Wrench },
  { to: '/pass', label: 'Gym pass', icon: CreditCard },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/about', label: 'About', icon: Info },
];

const MOBILE_NAV = [NAV[0], NAV[1], NAV[5], NAV[4]];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { account, signOut, switchUser } = useAccount();
  const location = useLocation();
  const navigate = useNavigate();
  const data = useStore((s) => s.data);
  const [more, setMore] = useState(false);
  const [accountMenu, setAccountMenu] = useState(false);
  const [installVisible, setInstallVisible] = useState(
    !!(window as unknown as { __installPrompt?: Event }).__installPrompt,
  );
  useEffect(() => {
    const onReady = () => setInstallVisible(true);
    const onInstalled = () => setInstallVisible(false);
    window.addEventListener('gymmiie:installready', onReady);
    window.addEventListener('gymmiie:installed', onInstalled);
    return () => {
      window.removeEventListener('gymmiie:installready', onReady);
      window.removeEventListener('gymmiie:installed', onInstalled);
    };
  }, []);
  const active = data.active;
  const now = useNow(!!active, 1000);
  const streak = useMemo(
    () => currentStreak(data),
    [data.sessions, data.checkins, data.daysOff, dateKey(now)],
  );
  const onSession = location.pathname === '/session';

  const install = async () => {
    const prompt = (
      window as unknown as {
        __installPrompt?: Event & { prompt?: () => Promise<void> };
      }
    ).__installPrompt;
    if (prompt?.prompt) {
      await prompt.prompt();
      setInstallVisible(false);
    }
  };

  const isActive = (to: string) =>
    to === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(to) ||
        (to === '/train' && location.pathname === '/session');

  return (
    <div className="min-h-screen">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-line bg-[var(--bg-2)]/80 px-4 py-5 backdrop-blur lg:flex">
        <Link to="/" className="mb-7 flex items-center gap-3 px-2">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] text-xl font-black text-[#1a0d07] shadow-glow">
            G
          </div>
          <div>
            <p className="text-lg font-black leading-none tracking-tight">
              Gymmiie
            </p>
            <p className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-mute">
              Lift · log · grow
            </p>
          </div>
        </Link>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto no-scrollbar">
          {NAV.slice(0, 9).map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              aria-current={isActive(to) ? 'page' : undefined}
              to={to}
              className={clsx(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-extrabold transition',
                isActive(to)
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'text-dim hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
              )}
            >
              <Icon size={18} strokeWidth={2.4} />
              {label}
              {to === '/progress' && streak > 0 && (
                <span className="ml-auto flex items-center gap-1 text-[11px] font-black text-[var(--warn)]">
                  <Flame size={12} />
                  {streak}
                </span>
              )}
            </Link>
          ))}
          <div className="my-3 border-t border-line" />
          {NAV.slice(9).map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              aria-current={isActive(to) ? 'page' : undefined}
              to={to}
              className={clsx(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-extrabold transition',
                isActive(to)
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'text-dim hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
              )}
            >
              <Icon size={18} strokeWidth={2.4} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-4">
          {active ? (
            <button
              onClick={() => navigate('/session')}
              className="w-full rounded-2xl border border-[var(--accent-line)] bg-[var(--accent-soft)] p-3 text-left"
            >
              <div className="flex items-center gap-2 text-xs font-black text-[var(--accent)]">
                <span className="h-2 w-2 animate-pulseSoft rounded-full bg-[var(--accent)]" />{' '}
                Live workout
              </div>
              <p className="mt-1 num text-lg font-black">
                {fmtClock(activeElapsed(active))}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-dim">
                Back to session <ArrowRight size={12} />
              </p>
            </button>
          ) : (
            <div className="rounded-2xl border border-line bg-[var(--surface)] p-3">
              <div className="flex items-center gap-2 text-xs font-black text-[var(--warn)]">
                <Flame size={14} /> {streak} day streak
              </div>
              <p className="mt-1 text-[11px] font-semibold text-mute">
                {data.sessions.length} workouts logged · keep it going.
              </p>
              <Btn
                size="sm"
                variant="primary"
                className="mt-2.5 w-full"
                onClick={() => navigate('/train')}
              >
                Start training
              </Btn>
            </div>
          )}
          <button
            type="button"
            aria-label="Account menu"
            onClick={() => setAccountMenu(true)}
            className="mt-3 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-[var(--surface-2)]"
          >
            <Avatar name={account.name} size={32} />
            <div className="min-w-0">
              <p className="truncate text-xs font-black">{account.name}</p>
              <p className="text-[10px] font-bold text-mute">
                {data.settings.unit} · {data.settings.weeklyGoal}× / week
              </p>
            </div>
          </button>
        </div>
      </aside>

      {/* mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-[var(--bg)]/85 px-4 py-2.5 backdrop-blur-xl lg:hidden">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] text-sm font-black text-[#1a0d07]">
            G
          </div>
          <span className="text-[15px] font-black tracking-tight">Gymmiie</span>
        </Link>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2 py-1 text-[11px] font-black text-[var(--warn)]">
            <Flame size={12} />
            {streak}
          </span>
          <button
            aria-label="Open menu"
            onClick={() => setMore(true)}
            className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-2)] text-dim"
          >
            <Menu size={18} />
          </button>
          <button
            type="button"
            aria-label="Account menu"
            onClick={() => setAccountMenu(true)}
          >
            <Avatar name={account.name} size={32} />
          </button>
        </div>
      </header>

      {active && !onSession && (
        <div className="sticky top-[57px] z-20 border-b border-[var(--accent-line)] bg-[var(--accent-soft)] px-4 py-2 backdrop-blur lg:hidden">
          <button
            onClick={() => navigate('/session')}
            className="flex w-full items-center gap-2 text-xs font-black text-[var(--accent)]"
          >
            <span className="h-2 w-2 animate-pulseSoft rounded-full bg-[var(--accent)]" />
            Workout in progress ·{' '}
            <span className="num">{fmtClock(activeElapsed(active))}</span>
            <ArrowRight size={14} className="ml-auto" />
          </button>
        </div>
      )}

      <main
        className={clsx(
          'mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:ml-[248px] lg:max-w-[calc(100%-248px)] lg:px-8 lg:pb-12 lg:pt-8',
          onSession && 'pb-6',
        )}
      >
        {children}
      </main>

      {/* mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[var(--bg)]/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-lg items-stretch">
          {MOBILE_NAV.map(({ to, label, icon: Icon }) => {
            const on = isActive(to);
            return (
              <Link
                key={to}
                aria-current={isActive(to) ? 'page' : undefined}
                to={to}
                className={clsx(
                  'relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-extrabold',
                  on ? 'text-[var(--accent)]' : 'text-mute',
                )}
              >
                {on && (
                  <span className="absolute -top-px h-0.5 w-8 rounded-full bg-[var(--accent)]" />
                )}
                <Icon size={20} strokeWidth={on ? 2.7 : 2.1} />
                {label}
              </Link>
            );
          })}
          <button
            type="button"
            aria-label="More pages"
            aria-expanded={more}
            onClick={() => setMore(true)}
            className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-extrabold text-mute"
          >
            <Menu size={20} />
            More
          </button>
        </div>
      </nav>

      <Sheet open={more} onClose={() => setMore(false)} title="Menu">
        <div className="grid grid-cols-2 gap-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <button
              key={to}
              onClick={() => {
                setMore(false);
                navigate(to);
              }}
              className={clsx(
                'flex items-center gap-2.5 rounded-2xl border p-3 text-left text-sm font-extrabold',
                isActive(to)
                  ? 'border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-line bg-[var(--surface-2)] text-dim',
              )}
            >
              <Icon size={18} /> {label}
            </button>
          ))}
        </div>
        {installVisible && (
          <Btn
            className="mt-3 w-full"
            icon={<Download size={16} />}
            onClick={install}
          >
            Install Gymmiie
          </Btn>
        )}
        <div className="mt-4 flex items-center justify-center gap-2 text-[11px] font-bold text-mute">
          <Trophy size={13} /> Based on GymMane by InlitX · GPL-3.0
        </div>
        <div className="mt-4 flex items-center justify-center gap-2 text-[11px] font-bold text-mute">
          <CloudSun size={13} /> Offline logging · account sync when connected
        </div>
      </Sheet>
      <Sheet
        open={accountMenu}
        onClose={() => setAccountMenu(false)}
        title="Your account"
      >
        <p className="text-base font-black">{account.name}</p>
        <p className="mt-1 text-sm font-semibold text-dim">
          {account.telephone}
        </p>
        <div className="mt-5 grid gap-2">
          <Btn
            onClick={() => {
              setAccountMenu(false);
              navigate('/');
            }}
          >
            Home
          </Btn>
          <Btn
            onClick={() => {
              setAccountMenu(false);
              navigate('/settings');
            }}
          >
            Account settings
          </Btn>
          <Btn
            onClick={() => {
              setAccountMenu(false);
              void switchUser();
            }}
          >
            Switch user
          </Btn>
          <Btn
            onClick={() => {
              setAccountMenu(false);
              void signOut();
            }}
          >
            Sign out
          </Btn>
        </div>
      </Sheet>
    </div>
  );
}

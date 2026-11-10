import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppData } from '../types';
import {
  AccountApiError,
  getRememberedAccount,
  getSession,
  isLocallySignedOut,
  loginAccount,
  logoutAccount,
  registerAccount,
  type Account,
} from '../lib/accounts';
import { identityFieldErrors } from '../lib/identity';
import { useStore } from '../lib/store';
import { Btn, Card, Confirm, Field, Sheet, useToast } from './ui';

type Phase =
  | 'checking'
  | 'signed-out'
  | 'activating'
  | 'ready'
  | 'offline'
  | 'activation-error'
  | 'leaving'
  | 'leave-error'
  | 'leave-pending';
interface AccountContextValue {
  account: Account;
  signOut: () => Promise<void>;
  switchUser: () => Promise<void>;
  legacy: AppData | null;
  legacyError: string;
  legacyHidden: boolean;
  reviewLegacy: () => void;
  keepLegacySeparate: () => void;
}
const AccountContext = createContext<AccountContextValue | null>(null);
export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) throw new Error('Account context is unavailable.');
  return context;
}
const legacyChoiceKey = (id: string) =>
  `gymmiie:account:${id}:legacy-choice:v1`;
function hasLegacyChoice(id: string) {
  try {
    return localStorage.getItem(legacyChoiceKey(id)) !== null;
  } catch {
    return false;
  }
}
function rememberLegacyChoice(id: string, choice: string) {
  try {
    localStorage.setItem(legacyChoiceKey(id), choice);
  } catch {
    /* The original device record is preserved even without this preference. */
  }
}
function meaningfulLegacy(data: AppData) {
  return (
    !!data.active ||
    [
      data.sessions,
      data.routines,
      data.notes,
      data.bodyweights,
      data.measures,
      data.passes,
      data.customExercises,
      data.checkins,
      data.archived,
      data.nutrition.entries,
      data.nutrition.customFoods,
    ].some((rows) => rows.length > 0) ||
    Object.values(data.nutrition.water).some((value) => value > 0) ||
    Object.keys(data.weekPlan).length > 0 ||
    Object.keys(data.daysOff).length > 0 ||
    Object.values(data.favorites).some(Boolean) ||
    data.bodyGoalKg != null
  );
}
function messageOf(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function AccountGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { clear: clearToasts } = useToast();
  const cloudStatus = useStore((state) => state.cloudStatus);
  const [phase, setPhase] = useState<Phase>('checking');
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [legacy, setLegacy] = useState<AppData | null>(null);
  const [legacyError, setLegacyError] = useState('');
  const [legacyHidden, setLegacyHidden] = useState(true);
  const [legacyOpen, setLegacyOpen] = useState(false);
  const generation = useRef(0);
  const leaveReason = useRef<'out' | 'switch' | 'expired'>('out');
  const leaveAccount = useRef<Account | null>(null);

  const activate = async (
    candidate: Account,
    offline = false,
    preserveRoute = false,
  ) => {
    const token = ++generation.current;
    clearToasts();
    setAccount(candidate);
    setPhase('activating');
    setError('');
    try {
      await useStore.getState().activateAccount(candidate, { offline });
      if (token !== generation.current) return;
      setLegacy(null);
      setLegacyError('');
      setLegacyHidden(hasLegacyChoice(candidate.id));
      setPhase('ready');
      if (!preserveRoute) navigate('/', { replace: true });
      void useStore
        .getState()
        .previewLegacyDeviceData()
        .then((data) => {
          if (token === generation.current) {
            setLegacy(data);
            if (data && !meaningfulLegacy(data)) setLegacyHidden(true);
          }
        })
        .catch((failure) => {
          if (token === generation.current)
            setLegacyError(
              messageOf(
                failure,
                'The older device log could not be opened. It has been kept.',
              ),
            );
        });
    } catch (failure) {
      if (token !== generation.current) return;
      setError(messageOf(failure, 'The account log could not be loaded.'));
      setPhase(
        useStore.getState().cloudStatus === 'session-expired'
          ? 'signed-out'
          : offline
            ? 'activation-error'
            : 'offline',
      );
    }
  };
  const check = async () => {
    const token = ++generation.current;
    setPhase('checking');
    setError('');
    if (isLocallySignedOut()) {
      setAccount(null);
      setPhase('signed-out');
      return;
    }
    try {
      const existing = await getSession();
      if (token !== generation.current) return;
      if (!existing) {
        setAccount(null);
        setPhase('signed-out');
        navigate('/', { replace: true });
      } else await activate(existing, false, true);
    } catch (failure) {
      if (token !== generation.current) return;
      const remembered = getRememberedAccount();
      setAccount(remembered);
      setError(messageOf(failure, 'Connect to check the account session.'));
      setPhase(remembered && !isLocallySignedOut() ? 'offline' : 'signed-out');
    }
  };
  const finishLeave = async (
    candidate: Account,
    reason: 'out' | 'switch' | 'expired',
    unsynced = false,
  ) => {
    setPhase('leaving');
    try {
      await useStore.getState().deactivateAccount();
    } catch (failure) {
      setError(
        messageOf(
          failure,
          'The log could not be saved on this device. Export a recovery copy or retry before signing out.',
        ),
      );
      setPhase('leave-error');
      return;
    }
    let remoteError = '';
    if (reason !== 'expired') {
      try {
        await logoutAccount(candidate.id);
      } catch (failure) {
        remoteError = messageOf(
          failure,
          'Reconnect to finish signing out of the server.',
        );
      }
    }
    setAccount(null);
    setNotice(
      reason === 'expired'
        ? 'Your session has ended. Enter your name and telephone to continue. Unsynced changes are kept with this account on this device.'
        : unsynced
          ? `Signed out on this device. Unsynced changes for ${candidate.name} are kept here. Sign in on this device and sync before opening the latest log on another device.${remoteError ? ` ${remoteError}` : ''}`
          : remoteError
            ? `Your tracking changes were synced. Signed out on this device. ${remoteError}`
            : reason === 'switch'
              ? 'Your changes were synced. Enter the other user’s name and telephone.'
              : 'Signed out. Your changes were synced to your account.',
    );
    setPhase('signed-out');
    navigate('/', { replace: true });
  };
  const leave = async (reason: 'out' | 'switch' | 'expired') => {
    const candidate = account ?? useStore.getState().account;
    if (!candidate) {
      setPhase('signed-out');
      return;
    }
    leaveReason.current = reason;
    leaveAccount.current = candidate;
    ++generation.current;
    clearToasts();
    setPhase('leaving');
    setError('');
    setLegacy(null);
    setLegacyOpen(false);
    if (reason !== 'expired') {
      try {
        // Flush the latest local draft and its durable cloud outbox before stopping
        // the coordinator or invalidating the server session.
        await useStore.getState().flushAccountSync();
      } catch (failure) {
        if (useStore.getState().cloudStatus === 'session-expired') {
          await finishLeave(candidate, 'expired', true);
          return;
        }
        setError(
          messageOf(
            failure,
            'The latest changes could not be synced. They remain on this device.',
          ),
        );
        setPhase('leave-pending');
        return;
      }
    }
    await finishLeave(candidate, reason, reason === 'expired');
  };
  const keepOpen = () => {
    const candidate = leaveAccount.current;
    const state = useStore.getState();
    if (
      candidate &&
      (state.cloudStatus === 'session-expired' ||
        state.account?.id !== candidate.id ||
        state.accountMode === 'locked')
    ) {
      void finishLeave(candidate, 'expired', true);
      return;
    }
    setError('');
    setPhase('ready');
  };

  useEffect(() => {
    void check();
    return () => {
      generation.current++;
    };
  }, []);
  useEffect(() => {
    if (phase === 'ready' && cloudStatus === 'session-expired')
      void leave('expired');
  }, [phase, cloudStatus]);

  if (phase === 'ready' && cloudStatus === 'session-expired')
    return (
      <PublicShell>
        <p role="status">Your session has ended. Returning to sign in…</p>
      </PublicShell>
    );
  if (phase === 'ready' && account)
    return (
      <AccountContext.Provider
        value={{
          account,
          signOut: () => leave('out'),
          switchUser: () => leave('switch'),
          legacy,
          legacyError,
          legacyHidden,
          reviewLegacy: () => setLegacyOpen(true),
          keepLegacySeparate: () => {
            rememberLegacyChoice(account.id, 'separate');
            setLegacyHidden(true);
          },
        }}
      >
        {children}
        <LegacyImportDialog
          open={legacyOpen}
          onClose={() => setLegacyOpen(false)}
          onSeparate={() => {
            rememberLegacyChoice(account.id, 'separate');
            setLegacyHidden(true);
            setLegacyOpen(false);
          }}
          legacy={legacy}
          account={account}
          onImported={() => {
            rememberLegacyChoice(account.id, 'imported');
            setLegacyHidden(true);
            setLegacyOpen(false);
          }}
        />
      </AccountContext.Provider>
    );
  if (phase === 'leave-pending')
    return (
      <PublicShell>
        <p className="text-sm text-dim">
          The account log stays closed while you choose what to do.
        </p>
        <Sheet
          open
          onClose={keepOpen}
          title="Changes are not synced yet"
          footer={
            <div className="flex flex-wrap gap-2">
              <Btn className="flex-1" onClick={keepOpen}>
                Keep open
              </Btn>
              <Btn
                variant="primary"
                className="flex-1"
                onClick={() => {
                  const candidate = leaveAccount.current;
                  if (candidate)
                    void finishLeave(candidate, leaveReason.current, true);
                }}
              >
                Continue sign out
              </Btn>
            </div>
          }
        >
          <p className="text-sm font-semibold">
            The latest tracking data is kept on this device for{' '}
            {leaveAccount.current?.name}. It may not be available on another
            device until you return here and sync.
          </p>
          <p role="alert" className="mt-3 text-sm text-[var(--bad)]">
            {error}
          </p>
          <Btn
            className="mt-4"
            onClick={() =>
              void useStore
                .getState()
                .recoveryExport()
                .catch((failure) =>
                  setError(
                    messageOf(failure, 'Could not export the device copy.'),
                  ),
                )
            }
          >
            Export device copy
          </Btn>
        </Sheet>
      </PublicShell>
    );
  if (phase === 'checking' || phase === 'activating' || phase === 'leaving')
    return (
      <PublicShell>
        <p
          role="status"
          className="py-12 text-center text-sm font-bold text-dim"
        >
          {phase === 'checking'
            ? 'Checking your session…'
            : phase === 'leaving'
              ? 'Saving this user’s log and signing out…'
              : 'Opening your account log…'}
        </p>
      </PublicShell>
    );
  if (phase === 'leave-error')
    return (
      <PublicShell>
        <h1 className="text-2xl font-black">
          Keep this log before signing out
        </h1>
        <p role="alert" className="mt-3 text-sm text-[var(--bad)]">
          {error}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Btn onClick={keepOpen}>Keep open</Btn>
          <Btn
            onClick={() =>
              void useStore
                .getState()
                .recoveryExport()
                .catch((failure) =>
                  setError(messageOf(failure, 'Could not export this log.')),
                )
            }
          >
            Export recovery copy
          </Btn>
          <Btn
            variant="primary"
            onClick={() => void leave(leaveReason.current)}
          >
            Retry sign out
          </Btn>
        </div>
      </PublicShell>
    );
  if ((phase === 'offline' || phase === 'activation-error') && account)
    return (
      <PublicShell>
        <h1 className="text-2xl font-black">
          Your account log is not open yet
        </h1>
        <p role="alert" className="mt-3 text-sm text-dim">
          {error}
        </p>
        <p className="mt-3 text-sm font-semibold">
          {account.name} · {account.telephone}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Btn
            variant="primary"
            onClick={() => void activate(account, false, true)}
          >
            Retry online
          </Btn>
          {!isLocallySignedOut() &&
            getRememberedAccount()?.id === account.id && (
              <Btn onClick={() => void activate(account, true, true)}>
                Continue offline
              </Btn>
            )}
          <Btn onClick={() => void leave('switch')}>Use another user</Btn>
          <Btn
            onClick={() =>
              void useStore
                .getState()
                .recoveryExport()
                .catch((failure) =>
                  setError(
                    messageOf(
                      failure,
                      'No saved account log could be exported.',
                    ),
                  ),
                )
            }
          >
            Export recovery copy
          </Btn>
        </div>
      </PublicShell>
    );
  return (
    <PublicShell>
      <AccountForm
        initialError={error}
        notice={notice}
        onAccount={activate}
        onRetry={() => void check()}
      />
    </PublicShell>
  );
}

function PublicShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-5 py-10">
      <div className="mb-7 flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent)] text-xl font-black text-[#1a0d07]">
          G
        </div>
        <div>
          <p className="text-xl font-black">Gymmiie</p>
          <p className="text-xs font-bold text-mute">Lift · log · grow</p>
        </div>
      </div>
      <Card className="p-5 sm:p-6">{children}</Card>
    </main>
  );
}
function AccountForm({
  initialError,
  notice,
  onAccount,
  onRetry,
}: {
  initialError: string;
  notice: string;
  onAccount: (account: Account) => Promise<void>;
  onRetry: () => void;
}) {
  const [name, setName] = useState('');
  const [telephone, setTelephone] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [fields, setFields] = useState<
    Partial<Record<'name' | 'telephone', string>>
  >({});
  const resetIdentity = () => {
    setRegister(false);
    setPassphrase('');
    setError('');
    setFields({});
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const invalid = identityFieldErrors(name, telephone);
    setFields(invalid);
    if (Object.keys(invalid).length) return;
    if (register && !passphrase) {
      setError('Enter the registration passphrase.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const candidate = register
        ? await registerAccount(name, telephone, passphrase)
        : await loginAccount(name, telephone);
      setPassphrase('');
      await onAccount(candidate);
    } catch (failure) {
      if (
        !register &&
        failure instanceof AccountApiError &&
        failure.status === 404 &&
        failure.code === 'account_not_found'
      ) {
        setRegister(true);
        setError('');
      } else
        setError(
          messageOf(
            failure,
            'The request could not be completed. Retry when connected.',
          ),
        );
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={(event) => void submit(event)}>
      <h1 className="text-2xl font-black">
        {register ? 'Create your user' : 'Welcome to Gymmiie'}
      </h1>
      <p className="mt-2 text-sm font-semibold text-dim">
        {register
          ? 'No user was found with these details. A registration passphrase is required to create one.'
          : 'Enter the same name and telephone to open your training log.'}
      </p>
      {notice && (
        <p
          role="status"
          className="mt-3 rounded-xl bg-[var(--accent-soft)] p-3 text-sm font-semibold"
        >
          {notice}
        </p>
      )}
      <div className="mt-5 space-y-4">
        <Field label="Name">
          <input
            name="name"
            autoComplete="name"
            className="input"
            value={name}
            disabled={busy}
            aria-invalid={!!fields.name}
            aria-describedby={fields.name ? 'account-name-error' : undefined}
            onChange={(event) => {
              setName(event.target.value);
              resetIdentity();
            }}
          />
        </Field>
        {fields.name && (
          <p
            role="alert"
            id="account-name-error"
            className="text-xs font-bold text-[var(--bad)]"
          >
            {fields.name}
          </p>
        )}
        <Field
          label="Telephone"
          hint="Include + and the international country calling code."
        >
          <input
            aria-label="Telephone"
            name="telephone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            className="input"
            value={telephone}
            disabled={busy}
            aria-invalid={!!fields.telephone}
            aria-describedby={
              fields.telephone ? 'account-telephone-error' : undefined
            }
            onChange={(event) => {
              setTelephone(event.target.value);
              resetIdentity();
            }}
          />
        </Field>
        {fields.telephone && (
          <p
            role="alert"
            id="account-telephone-error"
            className="text-xs font-bold text-[var(--bad)]"
          >
            {fields.telephone}
          </p>
        )}
        {register && (
          <Field label="Registration passphrase">
            <input
              name="registration-passphrase"
              type="password"
              autoComplete="off"
              className="input"
              value={passphrase}
              disabled={busy}
              onChange={(event) => setPassphrase(event.target.value)}
            />
          </Field>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm font-bold text-[var(--bad)]">
          {error}
        </p>
      )}
      <Btn
        type="submit"
        variant="primary"
        className="mt-5 w-full"
        disabled={busy}
      >
        {busy
          ? register
            ? 'Creating user…'
            : 'Opening your log…'
          : register
            ? 'Create user'
            : 'Continue'}
      </Btn>
      {register && (
        <Btn className="mt-2 w-full" disabled={busy} onClick={resetIdentity}>
          Back to sign in
        </Btn>
      )}
      {initialError && !register && (
        <Btn className="mt-2 w-full" disabled={busy} onClick={onRetry}>
          Retry connection
        </Btn>
      )}
    </form>
  );
}

export function LegacyDeviceNotice() {
  const {
    account,
    legacy,
    legacyError,
    legacyHidden,
    reviewLegacy,
    keepLegacySeparate,
  } = useAccount();
  if (legacyHidden || (!legacy && !legacyError)) return null;
  return (
    <section className="mb-4 rounded-2xl border border-line bg-[var(--surface)] p-4">
      <h2 className="text-sm font-black">
        An older device log is kept separately
      </h2>
      <p className="mt-2 text-xs font-semibold text-dim">
        {legacyError ||
          `Review it before choosing whether to import it into ${account.name}’s account. Nothing has been assigned automatically.`}
      </p>
      {legacy && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn size="sm" onClick={reviewLegacy}>
            Review device log
          </Btn>
          <Btn size="sm" onClick={keepLegacySeparate}>
            Keep separate
          </Btn>
        </div>
      )}
    </section>
  );
}
function LegacyImportDialog({
  open,
  onClose,
  onSeparate,
  legacy,
  account,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onSeparate: () => void;
  legacy: AppData | null;
  account: Account;
  onImported: () => void;
}) {
  const data = useStore((state) => state.data);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (!open) setConfirm(false);
  }, [open]);
  const counts = (snapshot: AppData) =>
    `${snapshot.sessions.length} workouts · ${snapshot.routines.length} routines · ${snapshot.notes.length} notes · ${snapshot.nutrition.entries.length} meals${snapshot.active ? ' · active workout' : ''}`;
  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title="Review older device log"
        footer={
          <div className="flex gap-2">
            <Btn className="flex-1" onClick={onSeparate}>
              Keep separate
            </Btn>
            <Btn
              variant="primary"
              className="flex-1"
              disabled={!legacy}
              onClick={() => setConfirm(true)}
            >
              Import into this account…
            </Btn>
          </div>
        }
      >
        <p className="text-sm font-semibold">
          Account: {account.name} · {account.telephone}
        </p>
        <h3 className="label mt-4">Current account log</h3>
        <p className="mt-2 text-sm">{counts(data)}</p>
        <h3 className="label mt-4">Older device log</h3>
        <p className="mt-2 text-sm">
          {legacy ? counts(legacy) : 'No older device log is available.'}
        </p>
        <p className="mt-4 text-sm text-dim">
          Import replaces this account’s tracking data with a copy of the older
          device log. The original device log stays separate and unchanged.
        </p>
      </Sheet>
      <Confirm
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Replace ${account.name}’s account log?`}
        body="This imports the older device history into the named account and replaces its current tracking data. Export the current account log first to keep both copies."
        confirmLabel="Import device log"
        onConfirm={async () => {
          await useStore.getState().importLegacyDeviceData();
          onImported();
        }}
      />
    </>
  );
}

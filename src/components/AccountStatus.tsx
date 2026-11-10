import { useState } from 'react';
import { useStore } from '../lib/store';
import { useAccount } from './AccountGate';
import { Btn, Card, Confirm } from './ui';

export function accountSyncLabel(status: string) {
  if (status === 'syncing') return 'Saved on device · syncing account';
  if (status === 'pending') return 'Saved on device · account sync pending';
  if (status === 'offline') return 'Saved on device · account sync waiting';
  if (status === 'conflict') return 'Account copies need review';
  if (status === 'session-expired') return 'Sign in again to sync';
  return 'Account sync up to date';
}

export function AccountSyncNotice() {
  const status = useStore((state) => state.cloudStatus);
  const localStatus = useStore((state) => state.persistenceStatus);
  const error = useStore((state) => state.cloudError);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [reload, setReload] = useState(false);
  if (status === 'session-expired') return null;
  if (status === 'idle' || status === 'pending' || status === 'syncing')
    return (
      <p role="status" className="mb-3 min-h-5 text-xs font-semibold text-mute">
        {localStatus === 'saving'
          ? 'Saving on this device…'
          : localStatus === 'error' || localStatus === 'conflict'
            ? 'Account sync paused while this device copy needs recovery'
            : accountSyncLabel(status)}
      </p>
    );
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setActionError('');
    try {
      await action();
    } catch (failure) {
      setActionError(
        failure instanceof Error
          ? failure.message
          : 'The account could not be synchronized. The device copy has been kept.',
      );
    } finally {
      setBusy(false);
    }
  };
  const conflict = status === 'conflict';
  return (
    <section
      className={`mb-4 rounded-2xl border p-4 ${conflict ? 'border-[var(--warn)]/40 bg-[var(--warn)]/10' : 'border-line bg-[var(--surface)]'}`}
    >
      <p role={conflict ? 'alert' : 'status'} className="text-sm font-black">
        {accountSyncLabel(status)}
      </p>
      {error && <p className="mt-2 text-xs font-semibold text-dim">{error}</p>}
      {conflict && (
        <p className="mt-2 text-xs text-dim">
          Your device log has been kept. Export it before choosing to replace it
          with the account copy. Nothing will be merged automatically.
        </p>
      )}
      {(conflict || status === 'offline') && (
        <div className="mt-3 flex flex-wrap gap-2">
          {conflict ? (
            <>
              <Btn
                size="sm"
                disabled={busy}
                onClick={() =>
                  void run(() => useStore.getState().recoveryExport())
                }
              >
                Export device copy
              </Btn>
              <Btn size="sm" disabled={busy} onClick={() => setReload(true)}>
                Load account copy…
              </Btn>
            </>
          ) : (
            <Btn
              size="sm"
              disabled={busy}
              onClick={() =>
                void run(() => useStore.getState().flushAccountSync())
              }
            >
              {busy ? 'Retrying…' : 'Retry account sync'}
            </Btn>
          )}
        </div>
      )}
      {actionError && (
        <p role="alert" className="mt-3 text-xs font-bold text-[var(--bad)]">
          {actionError}
        </p>
      )}
      <Confirm
        open={reload}
        onClose={() => setReload(false)}
        title="Replace this device’s log?"
        body="This loads the account copy and replaces this device’s unsynced tracking data, including an active workout. Export this device copy first to keep both."
        confirmLabel="Load account copy"
        onConfirm={() => useStore.getState().reloadAccountData()}
      />
    </section>
  );
}

export function AccountSettingsCard() {
  const { account, signOut, switchUser, legacy, legacyError, reviewLegacy } =
    useAccount();
  const status = useStore((state) => state.cloudStatus);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Card className="mb-5 p-4">
      <h2 className="text-base font-black">Your account</h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="label">Account name</dt>
          <dd className="mt-1 text-sm font-bold">{account.name}</dd>
        </div>
        <div>
          <dt className="label">Telephone</dt>
          <dd className="mt-1 text-sm font-bold">{account.telephone}</dd>
        </div>
      </dl>
      <p role="status" className="mt-3 text-xs font-semibold text-dim">
        {accountSyncLabel(status)}
      </p>
      <p className="mt-2 text-xs text-mute">
        Use this account name and telephone when returning. Your training
        display name can be edited separately below.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Btn size="sm" onClick={() => void switchUser()}>
          Switch user
        </Btn>
        <Btn size="sm" onClick={() => void signOut()}>
          Sign out
        </Btn>
        <Btn
          size="sm"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError('');
            void useStore
              .getState()
              .flushAccountSync()
              .catch((failure) =>
                setError(
                  failure instanceof Error
                    ? failure.message
                    : 'Account sync failed.',
                ),
              )
              .finally(() => setBusy(false));
          }}
        >
          {busy ? 'Syncing…' : 'Sync account now'}
        </Btn>
        {legacy && (
          <Btn size="sm" onClick={reviewLegacy}>
            Review device log
          </Btn>
        )}
      </div>
      {(error || legacyError) && (
        <p role="alert" className="mt-3 text-xs font-bold text-[var(--bad)]">
          {error || legacyError}
        </p>
      )}
    </Card>
  );
}

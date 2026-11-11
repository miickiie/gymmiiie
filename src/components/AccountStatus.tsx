import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { useStore } from '../lib/store';
import { useAccount } from './AccountGate';
import { Btn, Card, Confirm } from './ui';

const TH: Record<string, string> = {
  'Saved on device · syncing account': 'บันทึกในเครื่องแล้ว · กำลังซิงก์บัญชี',
  'Saved on device · account sync pending':
    'บันทึกในเครื่องแล้ว · รอซิงก์บัญชี',
  'Saved on device · account sync waiting':
    'บันทึกในเครื่องแล้ว · รอการซิงก์บัญชี',
  'Account copies need review': 'ต้องตรวจสอบข้อมูลบัญชี',
  'Sign in again to sync': 'เข้าสู่ระบบใหม่เพื่อซิงก์',
  'Account sync up to date': 'ซิงก์บัญชีล่าสุดแล้ว',
  'Saving on this device…': 'กำลังบันทึกในเครื่องนี้…',
  'Account sync paused while this device copy needs recovery':
    'หยุดซิงก์บัญชีชั่วคราวจนกว่าข้อมูลในเครื่องจะกู้คืน',
  'The account could not be synchronized. The device copy has been kept.':
    'ซิงก์บัญชีไม่ได้ แต่ยังเก็บสำเนาในเครื่องไว้',
  'Your device log has been kept. Export it before choosing to replace it with the account copy. Nothing will be merged automatically.':
    'เก็บข้อมูลในเครื่องไว้แล้ว ส่งออกก่อนถ้าจะแทนที่ด้วยข้อมูลจากบัญชี ระบบจะไม่รวมข้อมูลให้อัตโนมัติ',
  'Export device copy': 'ส่งออกสำเนาในเครื่อง',
  'Load account copy…': 'โหลดข้อมูลจากบัญชี…',
  'Retrying…': 'กำลังลองใหม่…',
  'Retry account sync': 'ลองซิงก์บัญชีอีกครั้ง',
  'Replace this device’s log?': 'แทนที่ข้อมูลในเครื่องนี้?',
  'This loads the account copy and replaces this device’s unsynced tracking data, including an active workout. Export this device copy first to keep both.':
    'การโหลดจะใช้ข้อมูลจากบัญชีและแทนที่ข้อมูลที่ยังไม่ซิงก์ในเครื่อง รวมถึงการฝึกที่ยังไม่จบ ส่งออกสำเนาในเครื่องก่อนถ้าต้องการเก็บทั้งสองชุด',
  'Load account copy': 'โหลดข้อมูลจากบัญชี',
  'Account name': 'ชื่อบัญชี',
  Telephone: 'เบอร์โทร',
  'Use this account name and telephone when returning. Your training display name can be edited separately below.':
    'ใช้ชื่อบัญชีและเบอร์โทรนี้เมื่อกลับมา ชื่อที่แสดงตอนฝึกแก้ไขแยกได้ด้านล่าง',
  'Sync account now': 'ซิงก์บัญชีตอนนี้',
  'Syncing…': 'กำลังซิงก์…',
  'Account sync failed.': 'ซิงก์บัญชีไม่สำเร็จ',
  'Review device log': 'ตรวจดูบันทึกในเครื่อง',
};

export function accountSyncLabel(status: string) {
  if (status === 'syncing') return 'Saved on device · syncing account';
  if (status === 'pending') return 'Saved on device · account sync pending';
  if (status === 'offline') return 'Saved on device · account sync waiting';
  if (status === 'conflict') return 'Account copies need review';
  if (status === 'session-expired') return 'Sign in again to sync';
  return 'Account sync up to date';
}

export function AccountSyncNotice() {
  const { t } = useI18n(TH);
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
          ? t('Saving on this device…')
          : localStatus === 'error' || localStatus === 'conflict'
            ? t('Account sync paused while this device copy needs recovery')
            : t(accountSyncLabel(status))}
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
          : t(
              'The account could not be synchronized. The device copy has been kept.',
            ),
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
        {t(accountSyncLabel(status))}
      </p>
      {error && <p className="mt-2 text-xs font-semibold text-dim">{error}</p>}
      {conflict && (
        <p className="mt-2 text-xs text-dim">
          {t(
            'Your device log has been kept. Export it before choosing to replace it with the account copy. Nothing will be merged automatically.',
          )}
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
                {t('Export device copy')}
              </Btn>
              <Btn size="sm" disabled={busy} onClick={() => setReload(true)}>
                {t('Load account copy…')}
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
              {busy ? t('Retrying…') : t('Retry account sync')}
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
        title={t('Replace this device’s log?')}
        body={t(
          'This loads the account copy and replaces this device’s unsynced tracking data, including an active workout. Export this device copy first to keep both.',
        )}
        confirmLabel={t('Load account copy')}
        onConfirm={() => useStore.getState().reloadAccountData()}
      />
    </section>
  );
}

export function AccountSettingsCard() {
  const { t } = useI18n(TH);
  const { account, signOut, switchUser, legacy, legacyError, reviewLegacy } =
    useAccount();
  const status = useStore((state) => state.cloudStatus);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Card className="mb-5 p-4">
      <h2 className="text-base font-black">{t('Your account')}</h2>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="label">{t('Account name')}</dt>
          <dd className="mt-1 text-sm font-bold">{account.name}</dd>
        </div>
        <div>
          <dt className="label">{t('Telephone')}</dt>
          <dd className="mt-1 text-sm font-bold">{account.telephone}</dd>
        </div>
      </dl>
      <p role="status" className="mt-3 text-xs font-semibold text-dim">
        {t(accountSyncLabel(status))}
      </p>
      <p className="mt-2 text-xs text-mute">
        {t(
          'Use this account name and telephone when returning. Your training display name can be edited separately below.',
        )}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Btn size="sm" onClick={() => void switchUser()}>
          {t('Switch user')}
        </Btn>
        <Btn size="sm" onClick={() => void signOut()}>
          {t('Sign out')}
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
                    : t('Account sync failed.'),
                ),
              )
              .finally(() => setBusy(false));
          }}
        >
          {busy ? t('Syncing…') : t('Sync account now')}
        </Btn>
        {legacy && (
          <Btn size="sm" onClick={reviewLegacy}>
            {t('Review device log')}
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

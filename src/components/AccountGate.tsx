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
import { pinIdentityFieldErrors, PIN_LENGTH } from '../lib/identity';
import { setLanguage, useI18n, type Language } from '../lib/i18n';
import { useStore } from '../lib/store';
import { Btn, Card, Confirm, Field, Segmented, Sheet, useToast } from './ui';

const TH: Record<string, string> = {
  'Sign in': 'เข้าสู่ระบบ',
  'Enter your name.': 'กรอกชื่อบัญชี',
  'Use a name between 1 and 100 characters.': 'ชื่อบัญชีต้องมีความยาว 1–100 ตัวอักษร',
  'The registration passphrase is incorrect.': 'รหัสสำหรับสมัครบัญชีไม่ถูกต้อง',
  'New account registration is not configured.': 'ขณะนี้ยังสมัครบัญชีใหม่ไม่ได้ กรุณาติดต่อผู้ดูแล',
  'This account already exists. Sign in with its name and PIN.': 'มีบัญชีนี้อยู่แล้ว เข้าสู่ระบบด้วยชื่อบัญชีและ PIN เดิม',
  'Too many attempts. Try again later.': 'ทำรายการหลายครั้งเกินไป กรุณารอแล้วลองใหม่',
  'The account response is invalid. Your local log has been kept.': 'ข้อมูลบัญชีที่ได้รับไม่ถูกต้อง บันทึกในเครื่องยังอยู่',
  'The cloud request timed out. Local changes have been kept; reconnect and retry.': 'เซิร์ฟเวอร์ตอบกลับไม่ทันเวลา ข้อมูลที่แก้ไขในเครื่องยังอยู่ กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่',
  'Your session expired. Sign in again.': 'หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบอีกครั้ง',
  'Sign in to access this account.': 'เข้าสู่ระบบเพื่อเปิดบัญชีนี้',
  'Account storage is unavailable. Try again without clearing local data.': 'ขณะนี้โหลดข้อมูลบัญชีไม่ได้ กรุณาลองใหม่โดยไม่ล้างข้อมูลในเครื่อง',
  'PIN (4 digits)': 'PIN 4 หลัก',
  'Enter your 4-digit PIN.': 'กรอก PIN 4 หลัก',
  'Use exactly 4 digits for your PIN.': 'PIN ต้องเป็นตัวเลข 4 หลัก',
  'Enter the same name and 4-digit PIN to open your training log.':
    'กรอกชื่อและ PIN 4 หลักเดิมเพื่อเปิดบันทึกการฝึกของคุณ',
  'Your session has ended. Enter your name and PIN to continue. Unsynced changes are kept with this account on this device.':
    'เซสชันสิ้นสุดแล้ว กรอกชื่อและ PIN เพื่อไปต่อ การเปลี่ยนแปลงที่ยังไม่ซิงก์ยังเก็บไว้กับบัญชีนี้ในเครื่อง',
  'Your changes were synced. Enter the other user’s name and PIN.':
    'ซิงก์ข้อมูลแล้ว กรอกชื่อและ PIN ของผู้ใช้คนอื่น',
  'Account: {name}': 'บัญชี: {name}',
  'No account matches this name and PIN.': 'ไม่พบบัญชีที่ตรงกับชื่อและ PIN นี้',
  'The older device log could not be opened. It has been kept.':
    'เปิดบันทึกเดิมในเครื่องไม่ได้ แต่ยังเก็บไว้อยู่',
  'The account log could not be loaded.': 'โหลดบันทึกของบัญชีไม่ได้',
  'Connect to check the account session.':
    'เชื่อมต่อเพื่อตรวจสอบเซสชันบัญชี',
  'The log could not be saved on this device. Export a recovery copy or retry before signing out.':
    'บันทึกข้อมูลลงเครื่องนี้ไม่ได้ ส่งออกสำเนาสำรองหรือลองใหม่ก่อนออกจากระบบ',
  'Reconnect to finish signing out of the server.':
    'เชื่อมต่อใหม่เพื่อออกจากระบบเซิร์ฟเวอร์ให้เสร็จ',
  'Signed out on this device. Unsynced changes for {name} are kept here. Sign in on this device and sync before opening the latest log on another device.':
    'ออกจากระบบในเครื่องนี้แล้ว การเปลี่ยนแปลงของ {name} ที่ยังไม่ซิงก์ยังอยู่ที่นี่ เข้าสู่ระบบในเครื่องนี้และซิงก์ก่อนเปิดข้อมูลล่าสุดบนเครื่องอื่น',
  'Your tracking changes were synced. Signed out on this device.':
    'ซิงก์ข้อมูลการฝึกแล้ว ออกจากระบบในเครื่องนี้เรียบร้อย',
  'Signed out. Your changes were synced to your account.':
    'ออกจากระบบแล้ว ข้อมูลของคุณซิงก์กับบัญชีเรียบร้อย',
  'The latest changes could not be synced. They remain on this device.':
    'ซิงก์การเปลี่ยนแปลงล่าสุดไม่ได้ ข้อมูลยังอยู่ในเครื่องนี้',
  'Your session has ended. Returning to sign in…':
    'เซสชันสิ้นสุดแล้ว กำลังกลับไปหน้าเข้าสู่ระบบ…',
  'The account log stays closed while you choose what to do.':
    'บันทึกของบัญชีจะปิดอยู่จนกว่าคุณจะเลือกว่าจะทำอะไร',
  'Changes are not synced yet': 'ยังไม่ได้ซิงก์การเปลี่ยนแปลง',
  'Keep open': 'เปิดค้างไว้',
  'Continue sign out': 'ออกจากระบบต่อ',
  'The latest tracking data is kept on this device for {name}. It may not be available on another device until you return here and sync.':
    'ข้อมูลการฝึกล่าสุดของ {name} เก็บไว้ในเครื่องนี้ อาจยังไม่แสดงบนเครื่องอื่นจนกว่าจะกลับมาที่นี่และซิงก์',
  'Could not export the device copy.': 'ส่งออกสำเนาในเครื่องไม่ได้',
  'Export device copy': 'ส่งออกสำเนาในเครื่อง',
  'Checking your session…': 'กำลังตรวจสอบเซสชัน…',
  'Saving this user’s log and signing out…':
    'กำลังบันทึกข้อมูลผู้ใช้และออกจากระบบ…',
  'Opening your account log…': 'กำลังเปิดบันทึกของบัญชี…',
  'Keep this log before signing out': 'เก็บข้อมูลนี้ก่อนออกจากระบบ',
  'Could not export this log.': 'ส่งออกข้อมูลนี้ไม่ได้',
  'Export recovery copy': 'ส่งออกสำเนาสำรอง',
  'Retry sign out': 'ลองออกจากระบบอีกครั้ง',
  'Your account log is not open yet': 'ยังเปิดบันทึกของบัญชีไม่ได้',
  'Retry online': 'ลองออนไลน์อีกครั้ง',
  'Continue offline': 'ใช้แบบออฟไลน์ต่อ',
  'Use another user': 'ใช้ผู้ใช้อื่น',
  'No saved account log could be exported.':
    'ไม่มีบันทึกบัญชีที่บันทึกไว้ให้ส่งออก',
  'Enter the registration passphrase.': 'กรอกรหัสสำหรับสมัครบัญชี',
  'The request could not be completed. Retry when connected.':
    'ทำรายการไม่สำเร็จ ลองใหม่เมื่อเชื่อมต่อ',
  'Create an account': 'สร้างบัญชี',
  'Welcome to Gymmiie': 'ยินดีต้อนรับสู่ Gymmiie',
  'No account matches these details. Enter the registration passphrase to create an account.':
    'ไม่พบบัญชีที่ตรงกับข้อมูลนี้ กรอกรหัสสำหรับสมัครบัญชีเพื่อสร้างบัญชีใหม่',
  Name: 'ชื่อบัญชี',
  'Registration passphrase': 'รหัสสำหรับสมัครบัญชี',
  'Creating account…': 'กำลังสร้างบัญชี…',
  'Opening your log…': 'กำลังเปิดบันทึกของคุณ…',
  'Create account': 'สร้างบัญชี',
  'Back to sign in': 'กลับไปหน้าเข้าสู่ระบบ',
  'Retry connection': 'ลองเชื่อมต่ออีกครั้ง',
  'An older device log is kept separately':
    'มีบันทึกเดิมในเครื่องแยกเก็บไว้',
  'Review it before choosing whether to import it into {name}’s account. Nothing has been assigned automatically.':
    'ตรวจดูก่อนเลือกว่าจะนำเข้ายังบัญชีของ {name} หรือไม่ ยังไม่มีอะไรถูกกำหนดอัตโนมัติ',
  'Review device log': 'ตรวจดูบันทึกในเครื่อง',
  'Keep separate': 'แยกเก็บไว้',
  'Review older device log': 'ตรวจดูบันทึกเดิมในเครื่อง',
  'Import into this account…': 'นำเข้าบัญชีนี้…',
  'Current account log': 'บันทึกบัญชีปัจจุบัน',
  'Older device log': 'บันทึกเดิมในเครื่อง',
  'No older device log is available.': 'ไม่มีบันทึกเดิมในเครื่อง',
  'Import replaces this account’s tracking data with a copy of the older device log. The original device log stays separate and unchanged.':
    'การนำเข้าจะแทนที่ข้อมูลการฝึกของบัญชีนี้ด้วยสำเนาบันทึกเดิม โดยบันทึกเดิมยังแยกเก็บไว้และไม่ถูกเปลี่ยน',
  'Replace {name}’s account log?': 'แทนที่บันทึกบัญชีของ {name}?',
  'This imports the older device history into the named account and replaces its current tracking data. Export the current account log first to keep both copies.':
    'การนำเข้าจะย้ายประวัติจากเครื่องเดิมเข้าบัญชีนี้และแทนที่ข้อมูลปัจจุบัน ส่งออกบันทึกบัญชีปัจจุบันก่อนถ้าต้องการเก็บทั้งสองชุด',
  'Import device log': 'นำเข้าบันทึกในเครื่อง',
  '{n} workouts': '{n} การฝึก',
  '{n} routines': '{n} ตารางฝึก',
  '{n} notes': '{n} โน้ต',
  '{n} meals': '{n} มื้อ',
  'active workout': 'กำลังฝึกอยู่',
};

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
type AccountNotice = {
  key: string;
  vars?: Record<string, string | number>;
  suffix?: string;
};

function messageOf(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function AccountGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { t } = useI18n(TH);
  const { clear: clearToasts } = useToast();
  const cloudStatus = useStore((state) => state.cloudStatus);
  const [phase, setPhase] = useState<Phase>('checking');
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<AccountNotice | null>(null);
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
      setError(
        messageOf(failure, 'The account log could not be loaded.'),
      );
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
        ? { key: 'Your session has ended. Enter your name and PIN to continue. Unsynced changes are kept with this account on this device.' }
        : unsynced
          ? {
              key: 'Signed out on this device. Unsynced changes for {name} are kept here. Sign in on this device and sync before opening the latest log on another device.',
              vars: { name: candidate.name },
              suffix: remoteError,
            }
          : remoteError
            ? { key: 'Your tracking changes were synced. Signed out on this device.', suffix: remoteError }
            : reason === 'switch'
              ? { key: 'Your changes were synced. Enter the other user’s name and PIN.' }
              : { key: 'Signed out. Your changes were synced to your account.' },
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
        <p role="status">
          {t('Your session has ended. Returning to sign in…')}
        </p>
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
          {t('The account log stays closed while you choose what to do.')}
        </p>
        <Sheet
          open
          onClose={keepOpen}
          title={t('Changes are not synced yet')}
          footer={
            <div className="flex flex-wrap gap-2">
              <Btn className="flex-1" onClick={keepOpen}>
                {t('Keep open')}
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
                {t('Continue sign out')}
              </Btn>
            </div>
          }
        >
          <p className="text-sm font-semibold">
            {t(
              'The latest tracking data is kept on this device for {name}. It may not be available on another device until you return here and sync.',
              { name: leaveAccount.current?.name ?? '' },
            )}
          </p>
          <p role="alert" className="mt-3 text-sm text-[var(--bad)]">
            {t(error)}
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
            {t('Export device copy')}
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
            ? t('Checking your session…')
            : phase === 'leaving'
              ? t('Saving this user’s log and signing out…')
              : t('Opening your account log…')}
        </p>
      </PublicShell>
    );
  if (phase === 'leave-error')
    return (
      <PublicShell>
        <h1 className="text-2xl font-black">
          {t('Keep this log before signing out')}
        </h1>
        <p role="alert" className="mt-3 text-sm text-[var(--bad)]">
          {t(error)}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Btn onClick={keepOpen}>{t('Keep open')}</Btn>
          <Btn
            onClick={() =>
              void useStore
                .getState()
                .recoveryExport()
                .catch((failure) =>
                  setError(
                    messageOf(failure, 'Could not export this log.'),
                  ),
                )
            }
          >
            {t('Export recovery copy')}
          </Btn>
          <Btn
            variant="primary"
            onClick={() => void leave(leaveReason.current)}
          >
            {t('Retry sign out')}
          </Btn>
        </div>
      </PublicShell>
    );
  if ((phase === 'offline' || phase === 'activation-error') && account)
    return (
      <PublicShell>
        <h1 className="text-2xl font-black">
          {t('Your account log is not open yet')}
        </h1>
        <p role="alert" className="mt-3 text-sm text-dim">
          {t(error)}
        </p>
        <p className="mt-3 text-sm font-semibold">
          {account.name}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Btn
            variant="primary"
            onClick={() => void activate(account, false, true)}
          >
            {t('Retry online')}
          </Btn>
          {!isLocallySignedOut() &&
            getRememberedAccount()?.id === account.id && (
              <Btn onClick={() => void activate(account, true, true)}>
                {t('Continue offline')}
              </Btn>
            )}
          <Btn onClick={() => void leave('switch')}>
            {t('Use another user')}
          </Btn>
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
            {t('Export recovery copy')}
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
  const { language, t } = useI18n(TH);
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-5 py-10">
      <div className="mb-7 flex flex-wrap items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent)] text-xl font-black text-[#1a0d07]">
          G
        </div>
        <div>
          <p className="text-xl font-black">Gymmiie</p>
          <p className="text-xs font-bold text-mute">
            {t('Lift · log · grow')}
          </p>
        </div>
        <div role="group" aria-label={t('Language')} className="ml-auto">
          <Segmented<Language>
            value={language}
            onChange={setLanguage}
            options={[
              { value: 'en', label: 'EN' },
              { value: 'th', label: 'ไทย' },
            ]}
          />
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
  notice: AccountNotice | null;
  onAccount: (account: Account) => Promise<void>;
  onRetry: () => void;
}) {
  const { t } = useI18n(TH);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [fields, setFields] = useState<
    Partial<Record<'name' | 'pin', string>>
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
    const invalid = pinIdentityFieldErrors(name, pin);
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
        ? await registerAccount(name, pin, passphrase)
        : await loginAccount(name, pin);
      setPassphrase('');
      setPin('');
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
        {register ? t('Create an account') : t('Welcome to Gymmiie')}
      </h1>
      <p className="mt-2 text-sm font-semibold text-dim">
        {register
          ? t(
              'No account matches these details. Enter the registration passphrase to create an account.',
            )
          : t(
              'Enter the same name and 4-digit PIN to open your training log.',
            )}
      </p>
      {notice && (
        <p
          role="status"
          className="mt-3 rounded-xl bg-[var(--accent-soft)] p-3 text-sm font-semibold"
        >
          {t(notice.key, notice.vars)}
          {notice.suffix ? ` ${t(notice.suffix)}` : ''}
        </p>
      )}
      <div className="mt-5 space-y-4">
        <Field label={t('Name')}>
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
            {t(fields.name)}
          </p>
        )}
        <Field label={t('PIN (4 digits)')}>
          <input
            aria-label={t('PIN (4 digits)')}
            name="pin"
            type="password"
            inputMode="numeric"
            maxLength={PIN_LENGTH}
            autoComplete={register ? 'new-password' : 'current-password'}
            className="input tracking-widest"
            value={pin}
            disabled={busy}
            aria-invalid={!!fields.pin}
            aria-describedby={fields.pin ? 'account-pin-error' : undefined}
            onChange={(event) => {
              setPin(event.target.value.replace(/[^0-9]/g, '').slice(0, PIN_LENGTH));
              resetIdentity();
            }}
          />
        </Field>
        {fields.pin && (
          <p role="alert" id="account-pin-error" className="text-xs font-bold text-[var(--bad)]">
            {t(fields.pin)}
          </p>
        )}
        {register && (
          <Field label={t('Registration passphrase')}>
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
          {t(error)}
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
            ? t('Creating account…')
            : t('Opening your log…')
          : register
            ? t('Create account')
            : t('Sign in')}
      </Btn>
      {register && (
        <Btn className="mt-2 w-full" disabled={busy} onClick={() => {
          setPin('');
          resetIdentity();
        }}>
          {t('Back to sign in')}
        </Btn>
      )}
      {initialError && !register && (
        <Btn className="mt-2 w-full" disabled={busy} onClick={onRetry}>
          {t('Retry connection')}
        </Btn>
      )}
    </form>
  );
}

export function LegacyDeviceNotice() {
  const { t } = useI18n(TH);
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
        {t('An older device log is kept separately')}
      </h2>
      <p className="mt-2 text-xs font-semibold text-dim">
        {(legacyError && t(legacyError)) ||
          t(
            'Review it before choosing whether to import it into {name}’s account. Nothing has been assigned automatically.',
            { name: account.name },
          )}
      </p>
      {legacy && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn size="sm" onClick={reviewLegacy}>
            {t('Review device log')}
          </Btn>
          <Btn size="sm" onClick={keepLegacySeparate}>
            {t('Keep separate')}
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
  const { t } = useI18n(TH);
  const data = useStore((state) => state.data);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (!open) setConfirm(false);
  }, [open]);
  const counts = (snapshot: AppData) =>
    `${t('{n} workouts', { n: snapshot.sessions.length })} · ${t('{n} routines', { n: snapshot.routines.length })} · ${t('{n} notes', { n: snapshot.notes.length })} · ${t('{n} meals', { n: snapshot.nutrition.entries.length })}${snapshot.active ? ` · ${t('active workout')}` : ''}`;
  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={t('Review older device log')}
        footer={
          <div className="flex gap-2">
            <Btn className="flex-1" onClick={onSeparate}>
              {t('Keep separate')}
            </Btn>
            <Btn
              variant="primary"
              className="flex-1"
              disabled={!legacy}
              onClick={() => setConfirm(true)}
            >
              {t('Import into this account…')}
            </Btn>
          </div>
        }
      >
        <p className="text-sm font-semibold">
          {t('Account: {name}', {
            name: account.name,
          })}
        </p>
        <h3 className="label mt-4">{t('Current account log')}</h3>
        <p className="mt-2 text-sm">{counts(data)}</p>
        <h3 className="label mt-4">{t('Older device log')}</h3>
        <p className="mt-2 text-sm">
          {legacy ? counts(legacy) : t('No older device log is available.')}
        </p>
        <p className="mt-4 text-sm text-dim">
          {t(
            'Import replaces this account’s tracking data with a copy of the older device log. The original device log stays separate and unchanged.',
          )}
        </p>
      </Sheet>
      <Confirm
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('Replace {name}’s account log?', { name: account.name })}
        body={t(
          'This imports the older device history into the named account and replaces its current tracking data. Export the current account log first to keep both copies.',
        )}
        confirmLabel={t('Import device log')}
        onConfirm={async () => {
          await useStore.getState().importLegacyDeviceData();
          onImported();
        }}
      />
    </>
  );
}

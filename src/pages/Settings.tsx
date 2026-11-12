import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  Activity,
  Check,
  ChevronRight,
  Cloud,
  Download,
  Info,
  Palette,
  Ruler,
  Shield,
  Smartphone,
  Sparkles,
  Target,
  Timer,
  Trash2,
  Upload,
  User,
  Volume2,
  Vibrate,
  Weight,
  Zap,
} from 'lucide-react';
import { useStore } from '../lib/store';
import { manualSyncStorageKey } from '../lib/accounts';
import { setLanguage, useI18n, type Language } from '../lib/i18n';
import {
  DARK_THEMES,
  LIGHT_THEMES,
  themeMeta,
  type ThemeOption,
} from '../lib/theme';
import { useAccount } from '../components/AccountGate';
import { AccountSettingsCard } from '../components/AccountStatus';
import { fromDisplayWeight, toDisplayWeight } from '../lib/stats';
import { downloadFile } from '../lib/db';
import { parseBackup } from '../lib/backup';
import {
  deleteSync,
  downloadSync,
  getSyncInfo,
  uploadSync,
  type SyncInfo,
  type SyncNamespace,
} from '../lib/cloud';
import { beep, vibrate } from '../lib/audio';
import type { AppData, ThemePref } from '../types';
import {
  Btn,
  Card,
  Confirm,
  Field,
  NumField,
  NumericInput,
  PageHeader,
  SectionHeader,
  Segmented,
  Sheet,
  Stepper,
  Toggle,
  useToast,
} from '../components/ui';

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const SEX_LABEL = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
} as const;

const TH: Record<string, string> = {
  'Overwrite cloud copy': 'เขียนทับสำเนาบนคลาวด์',
  'Make it yours': 'ปรับให้เป็นของคุณ',
  'Your account log saves on this device and syncs when connected. Manual encrypted backups are optional.':
    'ข้อมูลบัญชีบันทึกในเครื่องนี้และซิงก์เมื่อออนไลน์ สำรองแบบเข้ารหัสเป็นตัวเลือกเสริม',
  'Used for calorie and strength estimates':
    'ใช้ประมาณการพลังงานและคะแนนความแข็งแรง',
  'Training display name': 'ชื่อที่แสดง',
  'Display name': 'ชื่อที่แสดง',
  'Member since {year} · {n} workouts':
    'สมาชิกตั้งแต่ {year} · ฝึกแล้ว {n} ครั้ง',
  Sex: 'เพศ',
  Male: 'ชาย',
  Female: 'หญิง',
  Age: 'อายุ',
  yrs: 'yrs',
  Height: 'ส่วนสูง',
  Activity: 'ระดับกิจกรรม',
  Sedentary: 'เคลื่อนไหวน้อย',
  'Light (1–2 sessions)': 'เบา (1–2 ครั้ง/สัปดาห์)',
  'Moderate (3–4)': 'ปานกลาง (3–4)',
  'Active (5–6)': 'สูง (5–6)',
  'Very active': 'สูงมาก',
  Measurements: 'สัดส่วนร่างกาย',
  'Macro goals': 'เป้าหมายสารอาหาร',
  'Dark tones': 'โทนมืด',
  'Light tones': 'โทนสว่าง',
  Kilograms: 'Kilograms',
  Pounds: 'Pounds',
  Off: 'ปิด',
  'Beep test': 'ทดสอบเสียง',
  'Vibration test': 'ทดสอบการสั่น',
  'Plate inventory ({unit})': 'แผ่นน้ำหนักที่มี ({unit})',
  'Enter a positive finite plate weight': 'กรอกน้ำหนักแผ่นเป็นตัวเลขที่มากกว่า 0',
  'Importing…': 'กำลังนำเข้า…',
  '{n} workouts · {n2} notes · {n3} routines · {n4} custom exercises':
    '{n} การฝึก · {n2} โน้ต · {n3} ตารางฝึก · {n4} ท่าที่สร้างเอง',
  'Storage protected': 'ปกป้องพื้นที่เก็บข้อมูลแล้ว',
  'Browser declined': 'เบราว์เซอร์ไม่อนุญาต',
  'Not supported': 'ไม่รองรับ',
  'Backup downloaded': 'ดาวน์โหลดไฟล์สำรองแล้ว',
  'Workout CSV downloaded': 'ดาวน์โหลด CSV แล้ว',
  'Could not read that backup': 'อ่านไฟล์สำรองไม่ได้',
  'Use your browser menu → Add to Home Screen':
    'ใช้เมนูเบราว์เซอร์ → เพิ่มลงหน้าจอหลัก',
  '{theme} theme': 'ธีม {theme}',
  '{n}s rest': 'พัก {n} s',
  '{n}× / week': '{n}× / สัปดาห์',
  'Replace local log?': 'แทนที่ข้อมูลในเครื่อง?',
  'Replace local log': 'แทนที่ข้อมูลในเครื่อง',
  'Backup imported': 'นำเข้าไฟล์สำรองแล้ว',
  'Import failed': 'นำเข้าไม่สำเร็จ',
  'Import {name}': 'นำเข้า {name}',
  'Replaces this account’s tracking data, including an active workout. Export the current log first to keep both copies.':
    'ข้อมูลการฝึกของบัญชีนี้จะถูกแทนที่ รวมถึงการฝึกที่ยังไม่จบ ส่งออกข้อมูลเดิมก่อนถ้าต้องการเก็บไว้',
  'All data reset': 'รีเซ็ตข้อมูลทั้งหมดแล้ว',
  'Reset failed': 'รีเซ็ตไม่สำเร็จ',
  'Reset everything?': 'รีเซ็ตทุกอย่าง?',
  'This clears {name}’s workouts, routines, notes, nutrition logs and training settings. The cleared log will sync to this account. Export a backup first to keep a copy. Your account identity remains available.':
    'ล้างประวัติการฝึก ตารางฝึก โน้ต บันทึกอาหาร และการตั้งค่าการฝึกของ {name} การล้างข้อมูลนี้จะซิงก์ไปยังบัญชีด้วย ส่งออกไฟล์สำรองก่อนหากต้องการเก็บข้อมูลเดิมไว้ บัญชีของคุณยังใช้งานได้',
  'Delete everything': 'ลบทั้งหมด',
  '{n} workouts · {n2} routines · {n3} notes · {n4} meals':
    '{n} การฝึก · {n2} ตารางฝึก · {n3} โน้ต · {n4} มื้อ',
  ' · active workout': ' · กำลังฝึก',
  'Encrypted snapshot': 'ไฟล์สำรองเข้ารหัส',
  'Optional code-protected backup': 'สำรองด้วยรหัส (ไม่บังคับ)',
  'Secret sync code': 'รหัสลับสำหรับไฟล์สำรอง',
  'Your secret sync code': 'รหัสลับสำหรับไฟล์สำรองของคุณ',
  HIDE: 'ซ่อน',
  SHOW: 'แสดง',
  'Enter a sync code': 'กรอกรหัสสำหรับไฟล์สำรอง',
  'Sync code saved': 'บันทึกรหัสซิงก์แล้ว',
  'Browser could not remember the code. Keep a separate copy.':
    'เบราว์เซอร์จำรหัสไม่ได้ เก็บสำเนาไว้อีกที่',
  'Codes are case-sensitive. Use the exact same code on another device. There is no reset link.':
    'ตัวพิมพ์ใหญ่และเล็กถือเป็นคนละตัว ต้องใช้รหัสเดียวกันทุกตัวอักษรเมื่อเปิดไฟล์สำรองบนอุปกรณ์อื่น รหัสนี้รีเซ็ตไม่ได้',
  'Uploading…': 'กำลังอัปโหลด…',
  'Downloading…': 'กำลังดาวน์โหลด…',
  'Generate code': 'สร้างรหัส',
  'New code generated — keep a copy, then upload':
    'สร้างรหัสใหม่แล้ว เก็บสำเนาไว้แล้วอัปโหลด',
  'Cloud copy to delete': 'สำเนาบนคลาวด์ที่จะลบ',
  Current: 'ปัจจุบัน',
  Legacy: 'เวอร์ชันเก่า',
  'Delete cloud copy': 'ลบสำเนาบนคลาวด์',
  'Privacy by design': 'ออกแบบมาเพื่อความเป็นส่วนตัว',
  'Your browser encrypts the backup with your code. Only ciphertext is uploaded. Download previews a snapshot before replacing your local log.':
    'เบราว์เซอร์เข้ารหัสไฟล์ด้วยรหัสของคุณ อัปโหลดเฉพาะข้อมูลที่เข้ารหัสแล้ว กดดาวน์โหลดเพื่อดูตัวอย่างก่อนแทนที่ข้อมูลในเครื่อง',
  'Older snapshots remain available with the original code. Upload creates a current copy and keeps the legacy copy until it is explicitly deleted.':
    'ไฟล์เก่ายังใช้รหัสเดิมได้ การอัปโหลดจะสร้างสำเนาปัจจุบันและเก็บเวอร์ชันเก่าไว้จนกว่าจะลบ',
  '{n} workouts in this snapshot': 'มี {n} การฝึกในไฟล์นี้',
  'Upload after adding new workouts': 'อัปโหลดหลังเพิ่มการฝึกใหม่',
  'Delete cloud copy?': 'ลบสำเนาบนคลาวด์?',
  'Overwrite cloud copy?': 'เขียนทับสำเนาบนคลาวด์?',
  '{copy} cloud copy · {date}': 'สำเนาบนคลาวด์ ({copy}) · {date}',
  'This replaces this account’s tracking data, including an active workout. Export the current account log first to keep both copies.':
    'ข้อมูลการฝึกของบัญชีนี้จะถูกแทนที่ รวมถึงการฝึกที่ยังไม่จบ ส่งออกข้อมูลเดิมก่อนถ้าต้องการเก็บทั้งสองชุด',
  'Only this selected cloud copy is deleted. Your local log and other cloud copies are kept.':
    'ลบเฉพาะสำเนาบนคลาวด์ที่เลือก ข้อมูลในเครื่องและสำเนาอื่นยังอยู่',
  'This replaces the selected manual encrypted snapshot with the current account log shown above. The prior snapshot cannot be recovered afterward.':
    'เขียนทับไฟล์สำรองที่เลือกด้วยข้อมูลปัจจุบันด้านบน ไฟล์เดิมจะกู้คืนไม่ได้',
  'Uploaded current copy · {date}': 'อัปโหลดสำเนาปัจจุบันแล้ว · {date}',
  'Encrypted snapshot uploaded': 'อัปโหลดไฟล์สำรองแล้ว',
  'Restored {copy} copy · {date}': 'กู้คืนสำเนา ({copy}) แล้ว · {date}',
  current: 'ปัจจุบัน',
  legacy: 'เวอร์ชันเก่า',
  'Snapshot restored': 'กู้คืนไฟล์สำรองแล้ว',
  '{copy} cloud copy deleted': 'ลบสำเนาบนคลาวด์ ({copy}) แล้ว',
  'Cloud snapshot deleted': 'ลบไฟล์สำรองบนคลาวด์แล้ว',
  'Cloud operation failed': 'ดำเนินการบนคลาวด์ไม่สำเร็จ',
  'Enter a sync code first': 'ใส่รหัสซิงก์ก่อน',
  'No snapshot found for that code': 'ไม่พบไฟล์สำรองสำหรับรหัสนี้',
  'No {copy} cloud copy found': 'ไม่พบสำเนาบนคลาวด์ ({copy})',
  'Could not read the cloud copy': 'อ่านสำเนาบนคลาวด์ไม่ได้',
  'Switched to {theme} theme! ✨': 'เปลี่ยนธีมเป็น {theme} แล้ว! ✨',
  'Units set to {unit}! ⚖️': 'ตั้งหน่วยเป็น {unit} แล้ว! ⚖️',
  'kilogram': 'kilogram',
  'pound': 'pound',
  'Week starts on {day}! 📅': 'เริ่มสัปดาห์วัน{day}! 📅',
  'Effort tracking turned off! 🎯': 'ปิดการวัดความเหนื่อยแล้ว! 🎯',
  'Effort tracking set to {mode}! 🎯': 'ตั้งการวัดความเหนื่อยเป็น {mode}! 🎯',
  'Weekly goal set to {n}×! 🎯': 'ตั้งเป้าหมายรายสัปดาห์ {n}×! 🎯',
  'Auto rest timer on! ⏱️': 'เปิดจับเวลาพักอัตโนมัติ! ⏱️',
  'Auto rest timer off! ⏱️': 'ปิดจับเวลาพักอัตโนมัติ! ⏱️',
  'Auto advance on! ⏭️': 'เปิดไปท่าถัดไปอัตโนมัติ! ⏭️',
  'Auto advance off! ⏭️': 'ปิดไปท่าถัดไปอัตโนมัติ! ⏭️',
  'Default rest set to {n}s! ⏱️': 'ตั้งเวลาพักเริ่มต้นเป็น {n} s แล้ว! ⏱️',
  'Sound on! 🔊': 'เปิดเสียง! 🔊',
  'Sound off! 🔊': 'ปิดเสียง! 🔊',
  'Vibration on! 📳': 'เปิดการสั่น! 📳',
  'Vibration off! 📳': 'ปิดการสั่น! 📳',
  'Bar weight updated! 🏋️': 'อัปเดตน้ำหนักบาร์แล้ว! 🏋️',
  'Plate inventory updated! 🏋️': 'อัปเดตแผ่นน้ำหนักแล้ว! 🏋️',
  'Name saved as {name}! 🐾': 'บันทึกชื่อ {name} แล้ว! 🐾',
  'Name cleared! 🐾': 'ล้างชื่อแล้ว! 🐾',
  'Bodyweight updated! ⚖️': 'อัปเดตน้ำหนักตัวแล้ว! ⚖️',
  'Sex set to {sex}. 🐾': 'ตั้งเพศเป็น {sex} 🐾',
  'Age set to {n}. 🐾': 'ตั้งอายุ {n} ปี 🐾',
  'Height set to {n} cm. 📏': 'ตั้งส่วนสูงเป็น {n} cm แล้ว 📏',
  'Activity level updated! 🏃': 'อัปเดตระดับกิจกรรมแล้ว! 🏃',
};

interface SettingsSnapshot {
  settings: AppData['settings'];
  profile: AppData['profile'];
}

interface SettingReaction {
  key: string;
  message: string;
}

/** Mochi narrates every settings/profile change so the bubble stays lively. */
function settingMessages(
  prev: SettingsSnapshot,
  next: SettingsSnapshot,
  t: (text: string, vars?: Record<string, string | number>) => string,
): SettingReaction[] {
  const reactions: SettingReaction[] = [];
  const add = (key: string, message: string) =>
    reactions.push({ key, message });
  const was = prev.settings;
  const now = next.settings;
  if (was.theme !== now.theme)
    add(
      'theme',
      t('Switched to {theme} theme! ✨', {
        theme: themeMeta(now.theme).label,
      }),
    );
  if (was.unit !== now.unit)
    add(
      'unit',
      t('Units set to {unit}! ⚖️', {
        unit: now.unit === 'kg' ? t('Kilograms') : t('Pounds'),
      }),
    );
  if (was.weekStart !== now.weekStart)
    add('weekStart', t('Week starts on {day}! 📅', { day: t(WEEKDAYS[now.weekStart]) }));
  if (was.effort !== now.effort)
    add(
      'effort',
      now.effort === 'off'
        ? t('Effort tracking turned off! 🎯')
        : t('Effort tracking set to {mode}! 🎯', {
            mode: now.effort.toUpperCase(),
          }),
    );
  if (was.weeklyGoal !== now.weeklyGoal)
    add('weeklyGoal', t('Weekly goal set to {n}×! 🎯', { n: now.weeklyGoal }));
  if (was.autoRest !== now.autoRest)
    add(
      'autoRest',
      now.autoRest
        ? t('Auto rest timer on! ⏱️')
        : t('Auto rest timer off! ⏱️'),
    );
  if (was.autoAdvance !== now.autoAdvance)
    add(
      'autoAdvance',
      now.autoAdvance ? t('Auto advance on! ⏭️') : t('Auto advance off! ⏭️'),
    );
  if (was.restSec !== now.restSec)
    add('restSec', t('Default rest set to {n}s! ⏱️', { n: now.restSec }));
  if (was.sound !== now.sound)
    add('sound', now.sound ? t('Sound on! 🔊') : t('Sound off! 🔊'));
  if (was.vibrate !== now.vibrate)
    add(
      'vibrate',
      now.vibrate ? t('Vibration on! 📳') : t('Vibration off! 📳'),
    );
  if (was.barWeight !== now.barWeight)
    add('barWeight', t('Bar weight updated! 🏋️'));
  if (
    was.plates.length !== now.plates.length ||
    was.plates.some((plate, i) => plate !== now.plates[i])
  )
    add('plates', t('Plate inventory updated! 🏋️'));

  const before = prev.profile;
  const after = next.profile;
  if (before.name !== after.name) {
    const name = after.name.trim();
    add(
      'name',
      name ? t('Name saved as {name}! 🐾', { name }) : t('Name cleared! 🐾'),
    );
  }
  if (before.weightKg !== after.weightKg)
    add('weightKg', t('Bodyweight updated! ⚖️'));
  if (before.sex !== after.sex)
    add('sex', t('Sex set to {sex}. 🐾', { sex: t(SEX_LABEL[after.sex]) }));
  if (before.age !== after.age)
    add('age', t('Age set to {n}. 🐾', { n: after.age }));
  if (before.heightCm !== after.heightCm)
    add('heightCm', t('Height set to {n} cm. 📏', { n: after.heightCm }));
  if (before.activity !== after.activity)
    add('activity', t('Activity level updated! 🏃'));
  return reactions;
}

/** Debounced so typing in a number/name field produces one spoken update. */
function useCatSettingReactions(data: AppData) {
  const { push, clear } = useToast();
  const { t } = useI18n(TH);
  const previous = useRef<SettingsSnapshot>();
  const pending = useRef(new Map<string, string>());
  useEffect(() => {
    const snapshot: SettingsSnapshot = {
      settings: data.settings,
      profile: data.profile,
    };
    const before = previous.current;
    previous.current = snapshot;
    if (before) {
      for (const reaction of settingMessages(before, snapshot, t))
        pending.current.set(reaction.key, reaction.message);
    }
    if (!pending.current.size) return;
    const timeout = window.setTimeout(() => {
      const messages = [...pending.current.values()];
      pending.current.clear();
      clear();
      push(messages.join(' '), 'good');
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [data.settings, data.profile, push, clear, t]);
}

export default function SettingsPage() {
  const { account } = useAccount();
  const toast = useToast();
  const { t } = useI18n(TH);
  const data = useStore((s) => s.data);
  useCatSettingReactions(data);
  const setProfile = useStore((s) => s.setProfile);
  const setSettings = useStore((s) => s.setSettings);
  const replaceData = useStore((s) => s.replaceData);
  const resetAll = useStore((s) => s.resetAll);
  const unit = data.settings.unit;
  const profile = data.profile;
  const [resetOpen, setResetOpen] = useState(false);
  const [newPlate, setNewPlate] = useState('');
  const [importing, setImporting] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    data: AppData;
    name: string;
  } | null>(null);
  const isCommitting = useStore((s) => s.isCommitting);
  const installReadyInit = !!(window as unknown as { __installPrompt?: Event })
    .__installPrompt;
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
  const prompt = (
    window as unknown as {
      __installPrompt?: Event & { prompt?: () => Promise<void> };
    }
  ).__installPrompt;
  const weightDisplay =
    Math.round(toDisplayWeight(profile.weightKg, unit) * 10) / 10;

  const exportData = () => {
    downloadFile(
      `gymmiie-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(data, null, 2),
    );
    toast.push(t('Backup downloaded'), 'good');
  };

  const exportCsv = () => {
    const cell = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows: (string | number)[][] = [
      [
        'date',
        'session',
        'duration_sec',
        'exercise',
        'set_index',
        'kind',
        'weight_kg',
        'reps',
        'reps_left',
        'reps_right',
        'rpe',
        'distance_km',
        'seconds',
        'notes',
      ],
    ];
    for (const s of data.sessions) {
      for (const ex of s.exercises) {
        ex.sets.forEach((set, i) => {
          rows.push([
            s.date,
            s.name || '',
            s.durationSec,
            ex.name,
            i + 1,
            set.kind,
            set.weight,
            set.reps,
            set.left ?? '',
            set.right ?? '',
            set.rpe ?? '',
            set.km ?? '',
            set.sec ?? '',
            set.note ?? '',
          ]);
        });
      }
    }
    downloadFile(
      `gymmiie-workouts-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map((r) => r.map(cell).join(',')).join('\n'),
    );
    toast.push(t('Workout CSV downloaded'), 'good');
  };

  const importData = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = parseBackup(JSON.parse(text));
      setPendingImport({ data: parsed, name: file.name });
    } catch (error) {
      toast.push(
        error instanceof Error ? error.message : t('Could not read that backup'),
        'bad',
      );
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
      toast.push(t('Use your browser menu → Add to Home Screen'));
    }
  };

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow={t("Settings")}
        title={t("Make it yours")}
        subtitle={t(
          "Your account log saves on this device and syncs when connected. Manual encrypted backups are optional.",
        )}
      />

      <AccountSettingsCard />
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <SectionHeader
            title={t("Profile")}
            subtitle={t("Used for calorie and strength estimates")}
          />
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] text-xl font-black text-[#1a0d07]">
                {(profile.name || 'G')
                  .trim()
                  .split(/\s+/)
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <input
                  className="input !border-0 !bg-transparent !p-0 text-lg font-black"
                  value={profile.name}
                  aria-label={t("Training display name")}
                  placeholder={t("Display name")}
                  onChange={(e) => setProfile({ name: e.target.value })}
                />
                <p className="text-[10px] font-bold text-mute">
                  {t("Member since {year} · {n} workouts", {
                    year: profile.since
                      ? new Date(profile.since).getFullYear()
                      : new Date().getFullYear(),
                    n: data.sessions.length,
                  })}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label={t("Sex")}>
                <select
                  className="input"
                  value={profile.sex}
                  onChange={(e) =>
                    setProfile({ sex: e.target.value as typeof profile.sex })
                  }
                >
                  <option value="male">{t("Male")}</option>
                  <option value="female">{t("Female")}</option>
                  <option value="other">{t("Other")}</option>
                </select>
              </Field>
              <Field label={t("Age")}>
                <NumField
                  value={profile.age}
                  onChange={(v) => setProfile({ age: v })}
                  unit={t("yrs")}
                  min={13}
                  max={100}
                />
              </Field>
              <Field label={t("Height")}>
                <NumField
                  value={profile.heightCm}
                  onChange={(v) => setProfile({ heightCm: v })}
                  unit="cm"
                  min={100}
                  max={250}
                />
              </Field>
              <Field label={t("Weight")}>
                <NumField
                  value={weightDisplay}
                  onChange={(v) =>
                    setProfile({ weightKg: fromDisplayWeight(v, unit) })
                  }
                  unit={unit}
                  step={0.5}
                />
              </Field>
            </div>
            <Field label={t("Activity")}>
              <select
                className="input"
                value={profile.activity}
                onChange={(e) =>
                  setProfile({ activity: Number(e.target.value) })
                }
              >
                <option value={1.2}>{t("Sedentary")}</option>
                <option value={1.375}>{t("Light (1–2 sessions)")}</option>
                <option value={1.55}>{t("Moderate (3–4)")}</option>
                <option value={1.725}>{t("Active (5–6)")}</option>
                <option value={1.9}>{t("Very active")}</option>
              </select>
            </Field>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                to="/progress"
                className="flex items-center gap-2 rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs font-extrabold"
              >
                <Ruler size={14} className="text-mute" /> {t("Measurements")}{' '}
                <ChevronRight size={12} className="ml-auto text-mute" />
              </Link>
              <Link
                to="/nutrition"
                className="flex items-center gap-2 rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs font-extrabold"
              >
                <Target size={14} className="text-mute" /> {t("Macro goals")}{' '}
                <ChevronRight size={12} className="ml-auto text-mute" />
              </Link>
            </div>
          </Card>

          <SectionHeader title={t("Appearance")} />
          <Card className="space-y-4 p-4">
            <div>
              <p className="label mb-1.5">{t("Language")}</p>
              <Segmented
                value={data.settings.language ?? "en"}
                onChange={(v) => {
                  const next = v as Language;
                  setSettings({ language: next });
                  setLanguage(next);
                }}
                options={[
                  { value: "en", label: t("English") },
                  { value: "th", label: t("Thai") },
                ]}
              />
            </div>
            <div>
              <p className="label mb-2">{t("Theme")}</p>
              <ThemePicker
                value={data.settings.theme}
                onChange={(v) => setSettings({ theme: v })}
              />
            </div>
            <div>
              <p className="label mb-1.5">{t("Units")}</p>
              <Segmented
                value={unit}
                onChange={(v) => setSettings({ unit: v })}
                options={[
                  { value: 'kg', label: t('Kilograms') },
                  { value: 'lb', label: t('Pounds') },
                ]}
              />
            </div>
            <div>
              <p className="label mb-1.5">{t("Week starts on")}</p>
              <Segmented
                value={String(data.settings.weekStart)}
                onChange={(v) =>
                  setSettings({ weekStart: Number(v) as 0 | 1 | 6 })
                }
                options={[
                  { value: '1', label: t('Monday') },
                  { value: '0', label: t('Sunday') },
                  { value: '6', label: t('Saturday') },
                ]}
              />
            </div>
            <div>
              <p className="label mb-1.5">{t("Effort tracking")}</p>
              <Segmented
                value={data.settings.effort}
                onChange={(v) => setSettings({ effort: v })}
                options={[
                  { value: 'off', label: t('Off') },
                  { value: 'rpe', label: 'RPE' },
                  { value: 'rir', label: 'RIR' },
                ]}
              />
            </div>
          </Card>
        </div>

        <div>
          <SectionHeader title={t("Training")} />
          <Card className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-extrabold">{t("Weekly goal")}</p>
                <p className="text-[10px] font-semibold text-mute">
                  {t("Workouts per week")}
                </p>
              </div>
              <Stepper
                value={data.settings.weeklyGoal}
                onChange={(v) => setSettings({ weeklyGoal: v })}
                min={1}
                max={7}
                unit="×"
              />
            </div>
            <div className="h-px bg-[var(--line)]" />
            <Toggle
              on={data.settings.autoRest}
              onChange={(v) => setSettings({ autoRest: v })}
              label={t("Auto rest timer")}
              hint={t("Start countdown when a set is completed")}
            />
            <Toggle
              on={data.settings.autoAdvance}
              onChange={(v) => setSettings({ autoAdvance: v })}
              label={t("Auto advance")}
              hint={t("Move to the next exercise after the last set")}
            />
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-extrabold">{t("Default rest")}</p>
                <p className="text-[10px] font-semibold text-mute">
                  {t("Seconds after a working set")}
                </p>
              </div>
              <Stepper
                value={data.settings.restSec}
                onChange={(v) => setSettings({ restSec: v })}
                min={0}
                max={600}
                step={15}
                unit="s"
              />
            </div>
          </Card>

          <SectionHeader title={t("Feedback")} />
          <Card className="space-y-3 p-4">
            <Toggle
              on={data.settings.sound}
              onChange={(v) => setSettings({ sound: v })}
              label={t("Sound")}
              hint={t("Rest timer beeps")}
            />
            <Toggle
              on={data.settings.vibrate}
              onChange={(v) => setSettings({ vibrate: v })}
              label={t("Vibration")}
              hint={t("Where supported by your device")}
            />
            <div className="flex gap-2 pt-1">
              <Btn
                size="sm"
                onClick={() => {
                  beep(2);
                  toast.push(t('Beep test'));
                }}
                icon={<Volume2 size={14} />}
              >
                {t("Test beep")}
              </Btn>
              <Btn
                size="sm"
                onClick={() => {
                  vibrate();
                  toast.push(t('Vibration test'));
                }}
                icon={<Vibrate size={14} />}
              >
                {t("Test buzz")}
              </Btn>
            </div>
          </Card>

          <SectionHeader title={t("Barbell & plates")} />
          <Card className="p-4">
            <Field label={t("Bar weight")}>
              <NumField
                value={
                  Math.round(
                    toDisplayWeight(data.settings.barWeight, unit) * 10,
                  ) / 10
                }
                onChange={(v) =>
                  setSettings({ barWeight: fromDisplayWeight(v, unit) })
                }
                unit={unit}
                step={0.5}
              />
            </Field>
            <p className="label mb-1.5 mt-3">{t("Plate inventory ({unit})", { unit })}</p>
            <div className="flex flex-wrap gap-1.5">
              {data.settings.plates.map((p) => (
                <button
                  key={p}
                  onClick={() =>
                    setSettings({
                      plates: data.settings.plates.filter((x) => x !== p),
                    })
                  }
                  className="chip"
                  title={t("Remove plate")}
                >
                  {p} <Trash2 size={10} />
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <NumericInput
                className="input !py-1.5 text-sm"
                placeholder={t("Add plate")}
                value={newPlate}
                onValueChange={setNewPlate}
              />
              <Btn
                size="sm"
                onClick={() => {
                  const v = Number(newPlate);
                  if (!Number.isFinite(v) || v <= 0) {
                    toast.push(t('Enter a positive finite plate weight'), 'bad');
                    return;
                  }
                  if (!data.settings.plates.includes(v)) {
                    setSettings({
                      plates: [...data.settings.plates, v].sort(
                        (a, b) => b - a,
                      ),
                    });
                    setNewPlate('');
                  }
                }}
              >
                {t("Add")}
              </Btn>
            </div>
            <p className="mt-2 text-[10px] font-semibold text-mute">
              {t("Used by the plate calculator. Values are per side.")}
            </p>
          </Card>
        </div>
      </div>

      <SectionHeader
        title={t("Manual encrypted backup")}
        subtitle={t("Optional code-protected backup, separate from account sync")}
      />
      <CloudSyncCard />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <SectionHeader title={t("Data")} />
          <Card className="space-y-3 p-4">
            <div className="flex flex-wrap gap-2">
              <Btn onClick={exportData} icon={<Download size={15} />}>
                {t("Export backup")}
              </Btn>
              <Btn onClick={exportCsv} icon={<Download size={15} />}>
                {t("Export CSV")}
              </Btn>
              <Btn
                disabled={importing || isCommitting}
                onClick={() => fileRef.current?.click()}
                icon={<Upload size={15} />}
              >
                {importing ? t('Importing…') : t('Import backup')}
              </Btn>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importData(f);
                }}
              />
            </div>
            <div className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-[11px] font-semibold text-mute">
              {t(
                "{n} workouts · {n2} notes · {n3} routines · {n4} custom exercises",
                {
                  n: data.sessions.length,
                  n2: data.notes.length,
                  n3: data.routines.length,
                  n4: data.customExercises.length,
                },
              )}
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[var(--bad)]/25 bg-[var(--bad-soft)] px-3 py-2">
              <div>
                <p className="text-xs font-black text-[var(--bad)]">
                  {t("Reset all data")}
                </p>
                <p className="text-[10px] font-semibold text-[var(--bad)]/80">
                  {t("Clears this account’s tracking data")}
                </p>
              </div>
              <Btn
                size="sm"
                variant="danger"
                onClick={() => setResetOpen(true)}
                icon={<Trash2 size={13} />}
              >
                {t("Reset")}
              </Btn>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] px-3 py-2">
              <div>
                <p className="text-xs font-black">{t("Persistent storage")}</p>
                <p className="text-[10px] font-semibold text-mute">
                  {t("Ask the browser to keep your log")}
                </p>
              </div>
              <Btn
                size="sm"
                onClick={async () => {
                  if (navigator.storage?.persist) {
                    const ok = await navigator.storage.persist();
                    toast.push(
                      ok ? t('Storage protected') : t('Browser declined'),
                      ok ? 'good' : 'bad',
                    );
                  } else toast.push(t('Not supported'));
                }}
              >
                {t("Request")}
              </Btn>
            </div>
          </Card>
        </div>

        <div>
          <SectionHeader title={t("App")} />
          <Card className="space-y-2 p-4">
            {installReady && (
              <button
                onClick={install}
                className="flex w-full items-center gap-3 rounded-xl bg-[var(--accent-soft)] px-3 py-2.5 text-left"
              >
                <Smartphone size={17} className="text-[var(--accent)]" />
                <span className="flex-1">
                  <span className="block text-sm font-extrabold">
                    {t("Install Gymmiie")}
                  </span>
                  <span className="block text-[10px] font-semibold text-mute">
                    {t("Add to home screen, works offline")}
                  </span>
                </span>
                <ChevronRight size={15} className="text-mute" />
              </button>
            )}
            <Link
              to="/about"
              className="flex items-center gap-3 rounded-xl bg-[var(--surface-2)] px-3 py-2.5"
            >
              <Info size={17} className="text-mute" />
              <span className="flex-1 text-sm font-extrabold">
                {t("About & credits")}
              </span>
              <ChevronRight size={15} className="text-mute" />
            </Link>
            <Link
              to="/tools"
              className="flex items-center gap-3 rounded-xl bg-[var(--surface-2)] px-3 py-2.5"
            >
              <Sparkles size={17} className="text-mute" />
              <span className="flex-1 text-sm font-extrabold">{t("Calculators")}</span>
              <ChevronRight size={15} className="text-mute" />
            </Link>
            <div className="flex items-center gap-2 px-1 pt-1 text-[10px] font-bold text-mute">
              <Shield size={12} /> {t("Offline logging · account sync when connected")}
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-[10px] font-bold text-mute">
        <span className="flex items-center gap-1">
          <Palette size={12} /> {t("{theme} theme", { theme: themeMeta(data.settings.theme).label })}
        </span>
        <span className="flex items-center gap-1">
          <Weight size={12} /> {unit}
        </span>
        <span className="flex items-center gap-1">
          <Timer size={12} /> {t("{n}s rest", { n: data.settings.restSec })}
        </span>
        <span className="flex items-center gap-1">
          <Activity size={12} /> {t("{n}× / week", { n: data.settings.weeklyGoal })}
        </span>
      </div>

      <Sheet
        open={!!pendingImport}
        onClose={() => {
          if (!isCommitting) setPendingImport(null);
        }}
        title={t("Replace local log?")}
        footer={
          <div className="flex gap-2">
            <Btn
              className="flex-1"
              disabled={isCommitting}
              onClick={() => setPendingImport(null)}
            >
              {t("Cancel")}
            </Btn>
            <Btn
              className="flex-1"
              variant="danger"
              disabled={isCommitting}
              onClick={async () => {
                if (!pendingImport) return;
                try {
                  await replaceData(pendingImport.data);
                  setPendingImport(null);
                  toast.push(t('Backup imported'), 'good');
                } catch (error) {
                  toast.push(
                    error instanceof Error ? error.message : t('Import failed'),
                    'bad',
                  );
                }
              }}
            >
              {isCommitting ? t('Saving…') : t('Replace local log')}
            </Btn>
          </div>
        }
      >
        {pendingImport && (
          <>
            <p className="mb-3 text-sm font-semibold">
              {t("Import {name}", { name: pendingImport.name })}
            </p>
            <BackupSummary data={pendingImport.data} />
            <p className="mt-3 text-sm text-mute">
              {t("Replaces this account’s tracking data, including an active workout. Export the current log first to keep both copies.")}
            </p>
          </>
        )}
      </Sheet>

      <Confirm
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={async () => {
          try {
            await resetAll();
            try {
              localStorage.removeItem(manualSyncStorageKey(account.id, 'code'));
              localStorage.removeItem(
                manualSyncStorageKey(account.id, 'status'),
              );
            } catch {
              /* Optional local preferences may be blocked. */
            }
            toast.push(t('All data reset'), 'good');
          } catch (error) {
            toast.push(
              error instanceof Error ? error.message : t('Reset failed'),
              'bad',
            );
            throw error;
          }
        }}
        title={t("Reset everything?")}
        body={t(
          "This clears {name}’s workouts, routines, notes, nutrition logs and training settings. The cleared log will sync to this account. Export a backup first to keep a copy. Your account identity remains available.",
          { name: account.name },
        )}
        confirmLabel={t("Delete everything")}
      />
    </div>
  );
}

function BackupSummary({ data }: { data: AppData }) {
  const { t } = useI18n(TH);
  return (
    <div className="rounded-xl bg-[var(--surface-2)] p-3 text-sm font-semibold">
      {t("{n} workouts · {n2} routines · {n3} notes · {n4} meals", {
        n: data.sessions.length,
        n2: data.routines.length,
        n3: data.notes.length,
        n4: data.nutrition.entries.length,
      })}
      {data.active ? t(" · active workout") : ""}
    </div>
  );
}

function ThemePicker({
  value,
  onChange,
}: {
  value: ThemePref;
  onChange: (value: ThemePref) => void;
}) {
  const { t } = useI18n(TH);
  const groups: { label: string; options: readonly ThemeOption[] }[] = [
    { label: 'Dark tones', options: DARK_THEMES },
    { label: 'Light tones', options: LIGHT_THEMES },
  ];
  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-mute">
            {t(group.label)}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {group.options.map((theme) => {
              const active = value === theme.value;
              return (
                <button
                  key={theme.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange(theme.value)}
                  className={clsx(
                    'flex flex-col gap-2 rounded-xl border p-2 text-left transition',
                    active
                      ? 'border-[var(--accent-line)] bg-[var(--accent-soft)]'
                      : 'border-line bg-[var(--surface-2)] hover:border-strong',
                  )}
                >
                  <span
                    className="flex h-8 items-center gap-1 rounded-lg p-1.5"
                    style={{ background: theme.swatch.bg }}
                    aria-hidden="true"
                  >
                    <span
                      className="h-5 w-5 rounded-md"
                      style={{ background: theme.swatch.surface }}
                    />
                    <span
                      className="h-5 flex-1 rounded-md"
                      style={{ background: theme.swatch.accent }}
                    />
                  </span>
                  <span className="flex items-center justify-between gap-1 text-[11px] font-extrabold">
                    {theme.label}
                    {active && (
                      <Check size={12} className="shrink-0 text-accent" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function readLocal(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}
function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Cloud operations still work when optional local preferences are unavailable. */
  }
}

type CloudAction =
  | { kind: 'upload'; code: string; data: AppData; info: SyncInfo }
  | {
      kind: 'restore';
      code: string;
      data: AppData;
      info: { updatedAt: string; namespace: SyncNamespace };
    }
  | { kind: 'delete'; code: string; info: SyncInfo };

function CloudSyncCard() {
  const { account } = useAccount();
  const { t } = useI18n(TH);
  const toast = useToast();
  const data = useStore((s) => s.data);
  const replaceData = useStore((s) => s.replaceData);
  const isCommitting = useStore((s) => s.isCommitting);
  const [code, setCode] = useState(() =>
    readLocal(manualSyncStorageKey(account.id, 'code')),
  );
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState('');
  const [status, setStatus] = useState(() =>
    readLocal(manualSyncStorageKey(account.id, 'status')),
  );
  const [deleteTarget, setDeleteTarget] = useState<SyncNamespace>('v2');
  const [pending, setPending] = useState<CloudAction | null>(null);
  const blocked = !!busy || isCommitting;

  const savedStatus = (message: string, exactCode: string) => {
    setStatus(message);
    remember(manualSyncStorageKey(account.id, 'status'), message);
    remember(manualSyncStorageKey(account.id, 'code'), exactCode);
  };
  const execute = async (action: CloudAction) => {
    setBusy(action.kind);
    try {
      if (action.kind === 'upload') {
        const info = await uploadSync(action.code, action.data);
        savedStatus(
          t('Uploaded current copy · {date}', {
            date: new Date(info.updatedAt).toLocaleString(),
          }),
          action.code,
        );
        toast.push(t('Encrypted snapshot uploaded'), 'good');
      } else if (action.kind === 'restore') {
        await replaceData(action.data);
        savedStatus(
          t('Restored {copy} copy · {date}', {
            copy: t(action.info.namespace === 'legacy' ? 'legacy' : 'current'),
            date: new Date(action.info.updatedAt).toLocaleString(),
          }),
          action.code,
        );
        toast.push(t('Snapshot restored'), 'good');
      } else {
        await deleteSync(action.code, action.info.namespace);
        savedStatus(
          t('{copy} cloud copy deleted', {
            copy: t(action.info.namespace === 'legacy' ? 'Legacy' : 'Current'),
          }),
          action.code,
        );
        toast.push(t('Cloud snapshot deleted'), 'good');
      }
      setPending(null);
    } catch (error) {
      toast.push(
        error instanceof Error ? error.message : t('Cloud operation failed'),
        'bad',
      );
    } finally {
      setBusy('');
    }
  };

  const prepare = async (kind: 'upload' | 'download' | 'delete') => {
    const exactCode = code.trim();
    if (!exactCode) {
      toast.push(t('Enter a sync code first'), 'bad');
      return;
    }
    setBusy(kind);
    try {
      if (kind === 'download') {
        const result = await downloadSync(exactCode);
        if (!result) {
          toast.push(t('No snapshot found for that code'), 'bad');
          return;
        }
        setPending({
          kind: 'restore',
          code: exactCode,
          data: result.data,
          info: result,
        });
      } else {
        const info = await getSyncInfo(
          exactCode,
          kind === 'upload' ? 'v2' : deleteTarget,
        );
        if (kind === 'delete') {
          if (!info) {
            toast.push(
              t('No {copy} cloud copy found', {
                copy: t(deleteTarget === 'legacy' ? 'legacy' : 'current'),
              }),
              'bad',
            );
            return;
          }
          setPending({ kind: 'delete', code: exactCode, info });
        } else if (info)
          setPending({ kind: 'upload', code: exactCode, data, info });
        else {
          const uploaded = await uploadSync(exactCode, data);
          savedStatus(
            t('Uploaded current copy · {date}', {
              date: new Date(uploaded.updatedAt).toLocaleString(),
            }),
            exactCode,
          );
          toast.push(t('Encrypted snapshot uploaded'), 'good');
        }
      }
    } catch (error) {
      toast.push(
        error instanceof Error
          ? error.message
          : t('Could not read the cloud copy'),
        'bad',
      );
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <Card className="mt-1 p-4">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Cloud size={18} />
              </div>
              <div>
                <p className="text-sm font-black">{t('Encrypted snapshot')}</p>
                <p className="text-[10px] font-semibold text-mute">
                  {t('Optional code-protected backup')}
                </p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <div className="relative flex-1">
                <input
                  aria-label={t('Secret sync code')}
                  disabled={blocked}
                  className="input pr-16 font-mono"
                  type={show ? 'text' : 'password'}
                  placeholder={t('Your secret sync code')}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-mute"
                >
                  {show ? t('HIDE') : t('SHOW')}
                </button>
              </div>
              <Btn
                size="sm"
                variant="soft"
                disabled={blocked}
                onClick={() => {
                  if (!code.trim()) {
                    toast.push(t('Enter a sync code'), 'bad');
                    return;
                  }
                  try {
                    localStorage.setItem(
                      manualSyncStorageKey(account.id, 'code'),
                      code.trim(),
                    );
                    toast.push(t('Sync code saved'), 'good');
                  } catch {
                    toast.push(
                      t('Browser could not remember the code. Keep a separate copy.'),
                      'bad',
                    );
                  }
                }}
              >
                {t('Save')}
              </Btn>
            </div>
            <p className="mt-1.5 text-[10px] font-semibold text-mute">
              {t('Codes are case-sensitive. Use the exact same code on another device. There is no reset link.')}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn
                size="sm"
                variant="primary"
                onClick={() => prepare('upload')}
                disabled={blocked}
                icon={<Upload size={13} />}
              >
                {busy === 'upload' ? t('Uploading…') : t('Upload')}
              </Btn>
              <Btn
                size="sm"
                onClick={() => prepare('download')}
                disabled={blocked}
                icon={<Download size={13} />}
              >
                {busy === 'download' ? t('Downloading…') : t('Download')}
              </Btn>
              <Btn
                size="sm"
                variant="ghost"
                disabled={blocked}
                onClick={() => {
                  const random = crypto.getRandomValues(new Uint32Array(3));
                  setCode(
                    `rep-${Array.from(random, (n) => n.toString(36).padStart(7, '0')).join('-')}`,
                  );
                  setShow(true);
                  toast.push(t('New code generated — keep a copy, then upload'));
                }}
                icon={<Sparkles size={13} />}
              >
                {t('Generate code')}
              </Btn>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label
                className="text-[11px] font-bold"
                htmlFor="cloud-delete-target"
              >
                {t('Cloud copy to delete')}
              </label>
              <select
                id="cloud-delete-target"
                className="input !w-auto !py-1 text-xs"
                disabled={blocked}
                value={deleteTarget}
                onChange={(e) =>
                  setDeleteTarget(e.target.value as SyncNamespace)
                }
              >
                <option value="v2">{t('Current')}</option>
                <option value="legacy">{t('Legacy')}</option>
              </select>
              <Btn
                size="sm"
                variant="ghost"
                onClick={() => prepare('delete')}
                disabled={blocked}
                icon={<Trash2 size={13} />}
              >
                {t('Delete cloud copy')}
              </Btn>
            </div>
            {status && (
              <p className="mt-2 flex items-center gap-1 text-[10px] font-bold text-[var(--good)]">
                <Check size={11} /> {status}
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-line bg-[var(--surface-2)] p-3 text-[11px] font-semibold leading-relaxed text-mute">
            <p className="mb-1 flex items-center gap-1 font-black text-dim">
              <Shield size={12} /> {t('Privacy by design')}
            </p>
            <p>
              {t('Your browser encrypts the backup with your code. Only ciphertext is uploaded. Download previews a snapshot before replacing your local log.')}
            </p>
            <p className="mt-2">
              {t('Older snapshots remain available with the original code. Upload creates a current copy and keeps the legacy copy until it is explicitly deleted.')}
            </p>
            <p className="mt-2 flex items-center gap-1">
              <User size={11} />{' '}
              {t('{n} workouts in this snapshot', { n: data.sessions.length })}
            </p>
            <p className="flex items-center gap-1">
              <Zap size={11} /> {t('Upload after adding new workouts')}
            </p>
          </div>
        </div>
      </Card>
      <Sheet
        open={!!pending}
        onClose={() => {
          if (!blocked) setPending(null);
        }}
        title={
          pending?.kind === 'restore'
            ? t('Replace local log?')
            : pending?.kind === 'delete'
              ? t('Delete cloud copy?')
              : t('Overwrite cloud copy?')
        }
        footer={
          <div className="flex gap-2">
            <Btn
              className="flex-1"
              disabled={blocked}
              onClick={() => setPending(null)}
            >
              {t("Cancel")}
            </Btn>
            <Btn
              className="flex-1"
              variant="danger"
              disabled={blocked}
              onClick={() => {
                if (pending) void execute(pending);
              }}
            >
              {blocked
                ? t('Working…')
                : pending?.kind === 'restore'
                  ? t('Replace local log')
                  : pending?.kind === 'delete'
                    ? t('Delete cloud copy')
                    : t('Overwrite cloud copy')}
            </Btn>
          </div>
        }
      >
        {pending && (
          <div className="space-y-3 text-sm font-semibold">
            <p>
              {t('{copy} cloud copy · {date}', {
                copy: t(pending.info.namespace === 'legacy' ? 'Legacy' : 'Current'),
                date: new Date(pending.info.updatedAt).toLocaleString(),
              })}
            </p>
            {pending.kind !== 'delete' && <BackupSummary data={pending.data} />}
            <p className="text-mute">
              {pending.kind === 'restore'
                ? t('This replaces this account’s tracking data, including an active workout. Export the current account log first to keep both copies.')
                : pending.kind === 'delete'
                  ? t('Only this selected cloud copy is deleted. Your local log and other cloud copies are kept.')
                  : t('This replaces the selected manual encrypted snapshot with the current account log shown above. The prior snapshot cannot be recovered afterward.')}
            </p>
          </div>
        )}
      </Sheet>
    </>
  );
}

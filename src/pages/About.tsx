import {
  Activity,
  BookOpen,
  Cloud,
  Dumbbell,
  Lock,
  Salad,
  Shield,
  Sparkles,
  Timer,
  Trophy,
  WifiOff,
  Wrench,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, PageHeader } from '../components/ui';
import { useI18n } from '../lib/i18n';
import { useStore } from '../lib/store';

const TH: Record<string, string> = {
  About: 'เกี่ยวกับ',
  'Built for the long haul': 'สร้างมาเพื่อระยะยาว',
  'Flexible workouts': 'ฝึกได้ยืดหยุ่น',
  'Use a routine, start empty, or review optional muscle-based suggestions.':
    'ใช้ตารางฝึก เริ่มจากว่าง หรือดูคำแนะนำตามกล้ามเนื้อ',
  'Live set logging': 'บันทึกเซ็ตแบบสด',
  'Rest timer, set details, RPE or RIR, cardio distance and timed exercises.':
    'จับเวลาพัก รายละเอียดเซ็ต RPE หรือ RIR ระยะคาร์ดิโอ และท่าจับเวลา',
  '501 exercises': '501 ท่าออกกำลัง',
  'Search by muscle, equipment or name. Reviewed form guides appear where available.':
    'ค้นหาตามกล้ามเนื้อ อุปกรณ์ หรือชื่อ มีคู่มือท่าที่ตรวจแล้วในบางท่า',
  'Progress that sticks': 'ความก้าวหน้าที่เห็นจริง',
  'Estimated 1RM, PRs, weekly volume, muscle heatmaps and 15 awards.':
    '1RM โดยประมาณ, PR, ปริมาณรายสัปดาห์, แผนที่กล้ามเนื้อ และ 15 รางวัล',
  'Nutrition log': 'บันทึกอาหาร',
  '561 foods and 27 dishes with macros, water tracking and daily goals.':
    '561 อาหารและ 27 เมนู พร้อมสารอาหาร การติดตามน้ำ และเป้าหมายรายวัน',
  'Ten calculators': 'สิบเครื่องคำนวณ',
  '1RM, BMI, calories, body fat, FFMI, plates, warm-ups, RPE, DOTS and Wilks.':
    '1RM, BMI, แคลอรี, ไขมันร่างกาย, FFMI, แผ่นน้ำหนัก, วอร์มอัป, RPE, DOTS และ Wilks',
  'Body tracking': 'ติดตามร่างกาย',
  'Bodyweight trends, tape measurements, goals and training notes.':
    'แนวโน้มน้ำหนักตัว ขนาดร่างกาย เป้าหมาย และโน้ตการฝึก',
  'Works offline': 'ใช้ออฟไลน์ได้',
  'Installable PWA. Your log opens instantly in the gym basement with no signal.':
    'ติดตั้งเป็น PWA ได้ เปิดบันทึกได้ทันทีแม้ในยิมชั้นใต้ดินที่ไม่มีสัญญาณ',
  'Lift. Log it. Grow.': 'ยก บันทึก แล้วเติบโต',
  'Version 1.0.0 · web edition': 'เวอร์ชัน 1.0.0 · เว็บ',
  workouts: 'การฝึก',
  routines: 'ตารางฝึก',
  notes: 'โน้ต',
  'Gymmiie keeps each user’s training log under their account. Return with the same name and 4-digit PIN. Changes save on this device and sync to the account when connected; manual encrypted backups are available separately.':
    'Gymmiie เก็บบันทึกการฝึกของแต่ละบัญชีไว้ กลับมาใช้ชื่อและ PIN 4 หลักเดิม การเปลี่ยนแปลงบันทึกในเครื่องและซิงก์เมื่อออนไลน์ สำรองแบบเข้ารหัสแยกได้',
  Privacy: 'ความเป็นส่วนตัว',
  'All workouts, notes and nutrition are cached separately for each account on this device.':
    'การฝึก โน้ต และอาหารทั้งหมดถูกแยกเก็บตามบัญชีในเครื่องนี้',
  'Account data syncs to the server for access from another device. Optional manual backups use a separate code and browser-side encryption.':
    'ข้อมูลบัญชีซิงก์ขึ้นเซิร์ฟเวอร์เพื่อใช้จากเครื่องอื่น สำรองเองใช้รหัสแยกและเข้ารหัสในเบราว์เซอร์',
  'There are no analytics, trackers or third-party pixels. The app works offline after an account has been opened and cached on this device.':
    'ไม่มีระบบวิเคราะห์ ตัวติดตาม หรือพิกเซลจากบุคคลที่สาม แอปใช้งานออฟไลน์ได้หลังเปิดบัญชีและแคชไว้ในเครื่อง',
  'Export a JSON backup any time from Settings. You own the data.':
    'ส่งออกไฟล์สำรอง JSON ได้ทุกเมื่อจากตั้งค่า ข้อมูลเป็นของคุณ',
  'Train hard. Log honestly. Recover well.':
    'ฝึกหนัก บันทึกตามจริง พักให้เต็มที่',
  'If Gymmiie helps you, share it with a training partner.':
    'ถ้า Gymmiie ช่วยคุณได้ แบ่งปันให้เพื่อนที่ฝึกด้วยกัน',
  'Start a workout': 'เริ่มฝึก',
  Settings: 'ตั้งค่า',
};

const FEATURES = [
  {
    icon: <Dumbbell size={18} />,
    title: 'Flexible workouts',
    body: 'Use a routine, start empty, or review optional muscle-based suggestions.',
  },
  {
    icon: <Timer size={18} />,
    title: 'Live set logging',
    body: 'Rest timer, set details, RPE or RIR, cardio distance and timed exercises.',
  },
  {
    icon: <BookOpen size={18} />,
    title: '501 exercises',
    body: 'Search by muscle, equipment or name. Reviewed form guides appear where available.',
  },
  {
    icon: <Trophy size={18} />,
    title: 'Progress that sticks',
    body: 'Estimated 1RM, PRs, weekly volume, muscle heatmaps and 15 awards.',
  },
  {
    icon: <Salad size={18} />,
    title: 'Nutrition log',
    body: '561 foods and 27 dishes with macros, water tracking and daily goals.',
  },
  {
    icon: <Wrench size={18} />,
    title: 'Ten calculators',
    body: '1RM, BMI, calories, body fat, FFMI, plates, warm-ups, RPE, DOTS and Wilks.',
  },
  {
    icon: <Activity size={18} />,
    title: 'Body tracking',
    body: 'Bodyweight trends, tape measurements, goals and training notes.',
  },
  {
    icon: <WifiOff size={18} />,
    title: 'Works offline',
    body: 'Installable PWA. Your log opens instantly in the gym basement with no signal.',
  },
];

export default function About() {
  const { t } = useI18n(TH);
  const data = useStore((s) => s.data);
  return (
    <div className="page-enter">
      <PageHeader
        eyebrow={t('About')}
        title={t('Built for the long haul')}
      />

      <Card className="relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[var(--accent)] opacity-[0.1] blur-3xl" />
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-strong)] text-3xl font-black text-[#1a0d07] shadow-glow">
            G
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight">Gymmiie</h2>
            <p className="text-sm font-semibold text-dim">
              {t('Lift. Log it. Grow.')}
            </p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-mute">
              {t('Version 1.0.0 · web edition')}
            </p>
          </div>
          <div className="ml-auto grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="num text-xl font-black">{data.sessions.length}</p>
              <p className="text-[9px] font-black uppercase text-mute">
                {t('workouts')}
              </p>
            </div>
            <div>
              <p className="num text-xl font-black">{data.routines.length}</p>
              <p className="text-[9px] font-black uppercase text-mute">
                {t('routines')}
              </p>
            </div>
            <div>
              <p className="num text-xl font-black">{data.notes.length}</p>
              <p className="text-[9px] font-black uppercase text-mute">
                {t('notes')}
              </p>
            </div>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-sm font-semibold leading-relaxed text-dim">
          {t(
            'Gymmiie keeps each user’s training log under their account. Return with the same name and 4-digit PIN. Changes save on this device and sync to the account when connected; manual encrypted backups are available separately.',
          )}
        </p>
      </Card>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {FEATURES.map((f) => (
          <Card key={f.title} className="p-4">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              {f.icon}
            </span>
            <p className="mt-3 text-sm font-black">{t(f.title)}</p>
            <p className="mt-1 text-[11px] font-semibold leading-relaxed text-mute">
              {t(f.body)}
            </p>
          </Card>
        ))}
      </div>

      <div className="mt-6">

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-[var(--good)]" />
            <h3 className="text-base font-black">{t('Privacy')}</h3>
          </div>
          <div className="mt-3 space-y-2.5 text-xs font-semibold leading-relaxed text-dim">
            <p className="flex gap-2">
              <Lock size={14} className="mt-0.5 shrink-0 text-mute" />{' '}
              {t(
                'All workouts, notes and nutrition are cached separately for each account on this device.',
              )}
            </p>
            <p className="flex gap-2">
              <Cloud size={14} className="mt-0.5 shrink-0 text-mute" />{' '}
              {t(
                'Account data syncs to the server for access from another device. Optional manual backups use a separate code and browser-side encryption.',
              )}
            </p>
            <p className="flex gap-2">
              <WifiOff size={14} className="mt-0.5 shrink-0 text-mute" />{' '}
              {t(
                'There are no analytics, trackers or third-party pixels. The app works offline after an account has been opened and cached on this device.',
              )}
            </p>
            <p className="flex gap-2">
              <Sparkles size={14} className="mt-0.5 shrink-0 text-mute" />{' '}
              {t(
                'Export a JSON backup any time from Settings. You own the data.',
              )}
            </p>
          </div>
        </Card>
      </div>


      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-[var(--surface)] px-4 py-4">
        <div>
          <p className="text-sm font-black">
            {t('Train hard. Log honestly. Recover well.')}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-mute">
            {t('If Gymmiie helps you, share it with a training partner.')}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/train" className="btn btn-primary px-4 py-2.5 text-sm">
            {t('Start a workout')}
          </Link>
          <Link to="/settings" className="btn btn-soft px-4 py-2.5 text-sm">
            {t('Settings')}
          </Link>
        </div>
      </div>

      <p className="mt-5 text-center text-[10px] font-bold text-mute">
        Crafted with 💜 by{' '}
        <a
          href="https://www.instagram.com/miiickiie"
          target="_blank"
          rel="noreferrer"
          className="text-[var(--accent)] underline"
        >
          Miickiie
        </a>
        .
      </p>
    </div>
  );
}

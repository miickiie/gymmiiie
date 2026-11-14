import { useCallback, useSyncExternalStore } from 'react';

export type Language = 'en' | 'th';

const STORAGE_KEY = 'gymmiie:language';

function readStoredLanguage(): Language {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'th' ? 'th' : 'en';
  } catch {
    return 'en';
  }
}

let currentLanguage: Language = readStoredLanguage();
const listeners = new Set<() => void>();

if (typeof document !== 'undefined') {
  document.documentElement.lang = currentLanguage === 'th' ? 'th' : 'en';
}

export function getLanguage(): Language {
  return currentLanguage;
}

export function setLanguage(next: Language) {
  if (next === currentLanguage) return;
  currentLanguage = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* The account setting still keeps the choice when storage is unavailable. */
  }
  if (typeof document !== 'undefined')
    document.documentElement.lang = next === 'th' ? 'th' : 'en';
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Components re-render when the language changes. */
export function useLanguage(): Language {
  return useSyncExternalStore(
    subscribe,
    getLanguage,
    () => 'en' as Language,
  );
}

export type Vars = Record<string, string | number>;

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

/**
 * Shared translations for navigation, common actions, muscle names and units.
 * Page-specific wording lives next to the page so it stays easy to review.
 */
export const COMMON_TH: Record<string, string> = {
  'No saved copy of this account is available on this device. Sign in online first.': 'อุปกรณ์นี้ยังไม่มีข้อมูลบัญชีที่บันทึกไว้ กรุณาเข้าสู่ระบบขณะออนไลน์ก่อน',
  'Sign in online before continuing with this account.': 'เชื่อมต่ออินเทอร์เน็ตแล้วเข้าสู่ระบบก่อนเปิดบัญชีนี้',
  'Working with this device’s saved copy. Reconnect to synchronize.': 'กำลังใช้ข้อมูลที่บันทึกไว้ในเครื่อง เชื่อมต่ออินเทอร์เน็ตเพื่อซิงก์',
  'The signed-in account changed in another tab. Sign in again; this account’s local changes have been kept.': 'มีการเปลี่ยนบัญชีในแท็บอื่น กรุณาเข้าสู่ระบบอีกครั้ง ข้อมูลที่แก้ไขในเครื่องของบัญชีนี้ยังอยู่',
  'Your log changed in another tab. Export this unsaved copy or reload the latest log.': 'ข้อมูลถูกแก้ไขในแท็บอื่น ส่งออกข้อมูลที่ยังไม่บันทึก หรือโหลดข้อมูลล่าสุด',
  'This tab has unsaved changes and another tab saved a newer log. Export the unsaved copy or reload the latest log.': 'แท็บนี้มีข้อมูลที่ยังไม่บันทึก และมีการบันทึกข้อมูลใหม่กว่าในแท็บอื่น ส่งออกข้อมูลที่ยังไม่บันทึก หรือโหลดข้อมูลล่าสุด',
  'The cloud profile is older than the saved device copy. Export this copy before replacing it.': 'ข้อมูลในบัญชีเก่ากว่าข้อมูลที่บันทึกไว้ในเครื่อง ส่งออกสำเนาในเครื่องก่อนแทนที่ข้อมูล',
  'The saved log has invalid storage metadata. Export a recovery copy before replacing it.': 'ข้อมูลสถานะของบันทึกไม่ถูกต้อง กรุณาส่งออกสำเนาสำหรับกู้คืนก่อนแทนที่ข้อมูล',
  'Invalid account synchronization metadata. Export this cache before replacing it.': 'ข้อมูลสถานะการซิงก์บัญชีไม่ถูกต้อง กรุณาส่งออกสำเนาในเครื่องก่อนแทนที่ข้อมูล',
  'Invalid pending account upload. Export this cache before replacing it.': 'ข้อมูลที่รอซิงก์ไม่ถูกต้อง กรุณาส่งออกสำเนาในเครื่องก่อนแทนที่ข้อมูล',
  'Wait for the current save to finish before switching accounts.': 'รอให้บันทึกข้อมูลเสร็จก่อนสลับบัญชี',
  'The active account changed. Retry from the current profile.': 'มีการเปลี่ยนบัญชีที่ใช้งาน กรุณาลองใหม่จากบัญชีปัจจุบัน',
  'The cloud request timed out. Local changes have been kept; reconnect and retry.': 'เซิร์ฟเวอร์ตอบกลับไม่ทันเวลา ข้อมูลที่แก้ไขในเครื่องยังอยู่ กรุณาเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่',
  'The account response is invalid. Your local log has been kept.': 'ข้อมูลบัญชีที่ได้รับไม่ถูกต้อง บันทึกในเครื่องยังอยู่',
  'The latest changes could not be synced. They remain on this device.': 'ซิงก์ข้อมูลล่าสุดไม่สำเร็จ ข้อมูลยังอยู่ในเครื่องนี้',
  'The account could not be synchronized. The device copy has been kept.': 'ซิงก์บัญชีไม่สำเร็จ ข้อมูลในเครื่องยังอยู่',
  'Account sync failed.': 'ซิงก์บัญชีไม่สำเร็จ',
  'Could not connect. Check your internet connection and try again.': 'เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง',
  'Mochi couldn’t refresh yet. Check your connection and make sure your changes are saved, then try again.': 'Mochi ยังรีเฟรชแอปไม่ได้ ตรวจสอบการเชื่อมต่อและให้แน่ใจว่าบันทึกการเปลี่ยนแปลงแล้ว จากนั้นลองอีกครั้ง',
  // Navigation and sections
  Today: 'วันนี้',
  Train: 'ฝึก',
  Exercises: 'ท่าออกกำลัง',
  Routines: 'ตารางฝึก',
  Progress: 'ความก้าวหน้า',
  History: 'ประวัติ',
  Nutrition: 'อาหาร',
  Journal: 'บันทึก',
  Tools: 'เครื่องมือ',
  Settings: 'ตั้งค่า',
  About: 'เกี่ยวกับ',
  More: 'เพิ่มเติม',
  'More pages': 'หน้าอื่น ๆ',
  'Account menu': 'เมนูบัญชี',
  'Open menu': 'เปิดเมนู',
  Menu: 'เมนู',
  Account: 'บัญชี',
  Home: 'หน้าแรก',
  'Your account': 'บัญชีของคุณ',
  'Account settings': 'ตั้งค่าบัญชี',
  'Switch user': 'สลับผู้ใช้',
  'Sign out': 'ออกจากระบบ',
  'About & credits': 'เกี่ยวกับและเครดิต',
  Calculators: 'เครื่องคำนวณ',
  'Install Gymmiie': 'ติดตั้ง Gymmiie',
  'Add to home screen, works offline': 'เพิ่มลงหน้าจอหลัก ใช้งานออฟไลน์ได้',
  'Lift · log · grow': 'ยก · บันทึก · พัฒนา',

  // Common actions
  Add: 'เพิ่ม',
  Save: 'บันทึก',
  Cancel: 'ยกเลิก',
  Delete: 'ลบ',
  Edit: 'แก้ไข',
  Remove: 'นำออก',
  Close: 'ปิด',
  Back: 'ย้อนกลับ',
  Next: 'ถัดไป',
  Continue: 'ต่อไป',
  Retry: 'ลองใหม่',
  Reset: 'รีเซ็ต',
  Export: 'ส่งออก',
  Import: 'นำเข้า',
  Download: 'ดาวน์โหลด',
  Upload: 'อัปโหลด',
  Search: 'ค้นหา',
  Filter: 'ตัวกรอง',
  Clear: 'ล้าง',
  All: 'ทั้งหมด',
  None: 'ไม่มี',
  Yes: 'ใช่',
  No: 'ไม่',
  Open: 'เปิด',
  '{n} days ago': 'เมื่อ {n} วันก่อน',
  '{n}× / week': '{n}× / สัปดาห์',
  Working: 'เซ็ตฝึกจริง',
  'Learn more': 'ดูเพิ่มเติม',
  'See all': 'ดูทั้งหมด',
  'View all': 'ดูทั้งหมด',
  'Load more': 'โหลดเพิ่ม',
  'Working…': 'กำลังทำงาน…',
  'Saving…': 'กำลังบันทึก…',
  'Loading…': 'กำลังโหลด…',
  Loading: 'กำลังโหลด',
  Optional: 'ไม่บังคับ',
  Required: 'จำเป็น',
  Selected: 'เลือกแล้ว',
  Start: 'เริ่ม',
  Stop: 'หยุด',
  Pause: 'พัก',
  Resume: 'ทำต่อ',
  Skip: 'ข้าม',
  Finish: 'จบ',
  Yesterday: 'เมื่อวาน',
  Tomorrow: 'พรุ่งนี้',

  // Settings and profile
  Language: 'ภาษา',
  English: 'English',
  Thai: 'ไทย',
  Profile: 'โปรไฟล์',
  Appearance: 'รูปลักษณ์',
  Training: 'การฝึก',
  Feedback: 'เสียงและการสั่น',
  'Barbell & plates': 'บาร์และแผ่นน้ำหนัก',
  Data: 'ข้อมูล',
  App: 'แอป',
  Theme: 'ธีม',
  Units: 'หน่วย',
  'Week starts on': 'เริ่มสัปดาห์วัน',
  'Effort tracking': 'การบันทึกระดับความหนัก',
  'Weekly goal': 'เป้าหมายรายสัปดาห์',
  'Workouts per week': 'จำนวนครั้งที่ฝึกต่อสัปดาห์',
  'Auto rest timer': 'จับเวลาพักอัตโนมัติ',
  'Start countdown when a set is completed': 'เริ่มนับถอยหลังเมื่อจบเซ็ต',
  'Auto advance': 'ไปท่าถัดไปอัตโนมัติ',
  'Move to the next exercise after the last set': 'ไปท่าถัดไปเมื่อจบเซ็ตสุดท้าย',
  'Default rest': 'เวลาพักค่าเริ่มต้น',
  'Seconds after a working set': 'เวลาพักหลังจบเซ็ตฝึกจริง',
  Sound: 'เสียง',
  'Rest timer beeps': 'เสียงเตือนหมดเวลาพัก',
  Vibration: 'การสั่น',
  'Where supported by your device': 'ถ้าอุปกรณ์รองรับ',
  'Test beep': 'ทดสอบเสียง',
  'Test buzz': 'ทดสอบการสั่น',
  'Bar weight': 'น้ำหนักบาร์',
  'Plate inventory': 'แผ่นน้ำหนักที่มี',
  'Add plate': 'เพิ่มแผ่น',
  'Remove plate': 'เอาแผ่นออก',
  'Used by the plate calculator. Values are per side.':
    'ใช้ในเครื่องคำนวณแผ่นน้ำหนัก (ต่อข้าง)',
  'Manual encrypted backup': 'สำรองข้อมูลแบบเข้ารหัสด้วยตนเอง',
  'Optional code-protected backup, separate from account sync':
    'สำรองเพิ่มเติมด้วยรหัส แยกจากซิงก์บัญชี',
  'Export backup': 'ส่งออกไฟล์สำรอง',
  'Export CSV': 'ส่งออก CSV',
  'Import backup': 'นำเข้าไฟล์สำรอง',
  'Reset all data': 'รีเซ็ตข้อมูลทั้งหมด',
  'Clears this account’s tracking data': 'ลบข้อมูลที่บันทึกไว้ในบัญชีนี้',
  'Persistent storage': 'พื้นที่เก็บถาวร',
  'Ask the browser to keep your log': 'ขอให้เบราว์เซอร์เก็บข้อมูลไว้',
  Request: 'ขอสิทธิ์',
  'Offline logging · account sync when connected':
    'บันทึกแบบออฟไลน์ · ซิงก์บัญชีเมื่อออนไลน์',
  'Weights are stored internally in kilograms and converted for display.':
    'ระบบเก็บน้ำหนักเป็นกิโลกรัมและแปลงหน่วยให้ตอนแสดงผล',

  // Exercise and training vocabulary
  Exercise: 'ท่าออกกำลัง',
  Workout: 'การฝึก',
  Workouts: 'การฝึก',
  Routine: 'ตารางฝึก',
  Set: 'Set',
  Sets: 'Sets',
  Reps: 'Reps',
  Weight: 'น้ำหนัก',
  Volume: 'ปริมาณการฝึก',
  Duration: 'ระยะเวลา',
  Rest: 'พัก',
  Notes: 'โน้ต',
  Note: 'โน้ต',
  'Warm-up': 'วอร์มอัป',
  Normal: 'ปกติ',
  Drop: 'ดรอป',
  Failure: 'หมดแรง',
  'Rest-pause': 'Rest-pause',
  Cluster: 'คลัสเตอร์',
  Favorites: 'รายการโปรด',
  Favorite: 'รายการโปรด',
  Archived: 'เก็บถาวร',
  Archive: 'เก็บถาวร',
  Custom: 'กำหนดเอง',
  'Custom exercise': 'ท่าที่สร้างเอง',
  'Create exercise': 'สร้างท่า',
  'Bodyweight': 'น้ำหนักตัว',
  'Weighted': 'เพิ่มน้ำหนัก',
  Barbell: 'บาร์เบล',
  Dumbbell: 'ดัมเบล',
  Cable: 'เคเบิล',
  Machine: 'เครื่อง',
  Band: 'ยางยืด',
  Rings: 'ห่วง',
  Kettlebell: 'เคตเทิลเบล',
  'EZ Bar': 'EZ Bar',
  'Smith Machine': 'Smith Machine',
  Other: 'อื่น ๆ',
  Beginner: 'เริ่มต้น',
  Intermediate: 'ปานกลาง',
  Advanced: 'ขั้นสูง',
  Chest: 'อก',
  Shoulders: 'ไหล่',
  Biceps: 'ไบเซ็ปส์',
  Abs: 'หน้าท้อง',
  Obliques: 'หน้าท้องด้านข้าง',
  Quads: 'ต้นขาด้านหน้า',
  Forearms: 'แขนท่อนล่าง',
  Traps: 'กล้ามเนื้อบ่า',
  'Lower back': 'หลังส่วนล่าง',
  Triceps: 'ไตรเซ็ปส์',
  Glutes: 'ก้น',
  Hamstrings: 'ต้นขาด้านหลัง',
  Calves: 'น่อง',
  Arms: 'แขน',
  Core: 'แกนกลางลำตัว',
  Legs: 'ขา',
  'Full Body': 'Full Body',
  'Push Pull Legs': 'Push Pull Legs',
  'Upper Lower': 'Upper Lower',
  'Arnold Split': 'Arnold Split',

  // Measurements and body data
  Neck: 'คอ',
  Waist: 'เอว',
  Hips: 'สะโพก',
  Thigh: 'ต้นขา',
  Calf: 'น่อง',
  Arm: 'แขน',
  Forearm: 'แขนท่อนล่าง',
  'Body fat %': 'ไขมันในร่างกาย %',
  Calories: 'แคลอรี',
  Protein: 'โปรตีน',
  Carbs: 'คาร์โบไฮเดรต',
  Fat: 'ไขมัน',
  Fiber: 'ใยอาหาร',
  Water: 'น้ำ',
  Meal: 'มื้อ',
  Meals: 'มื้อ',
  Food: 'อาหาร',
  Foods: 'อาหาร',

  // Weekdays and short labels
  Sunday: 'อาทิตย์',
  Monday: 'จันทร์',
  Tuesday: 'อังคาร',
  Wednesday: 'พุธ',
  Thursday: 'พฤหัสบดี',
  Friday: 'ศุกร์',
  Saturday: 'เสาร์',
  Sun: 'อา.',
  Mon: 'จ.',
  Tue: 'อ.',
  Wed: 'พ.',
  Thu: 'พฤ.',
  Fri: 'ศ.',
  Sat: 'ส.',
  January: 'มกราคม',
  February: 'กุมภาพันธ์',
  March: 'มีนาคม',
  April: 'เมษายน',
  May: 'พฤษภาคม',
  June: 'มิถุนายน',
  July: 'กรกฎาคม',
  August: 'สิงหาคม',
  September: 'กันยายน',
  October: 'ตุลาคม',
  November: 'พฤศจิกายน',
  December: 'ธันวาคม',

  // Common short status
  'Workout in progress': 'กำลังฝึกอยู่',
  'Back to session': 'กลับไปหน้าฝึก',
  'Live workout': 'กำลังฝึก',
  'Start workout': 'เริ่มฝึก',
  'Start training': 'เริ่มฝึก',
  'Resume workout': 'ฝึกต่อ',
  'Start routine': 'เริ่มฝึกตามตาราง',
  'Workout already in progress': 'มีการฝึกที่ยังไม่จบอยู่',
  'Discard the current workout?': 'ทิ้งการฝึกปัจจุบัน?',
  'Rest day': 'วันพัก',
  'Check in': 'เช็กอิน',
  'Checked in': 'เช็กอินแล้ว',
  'Trained today': 'ฝึกวันนี้แล้ว',
  'Mark rest': 'กำหนดเป็นวันพัก',
  'No workouts yet': 'ยังไม่มีการฝึก',
  'No plan set for today. Train by muscle instead.':
    'วันนี้ยังไม่มีแผนฝึก ลองเลือกกล้ามเนื้อที่ต้องการฝึก',
  'Recovery is part of the program. Come back stronger tomorrow.':
    'การพักคือส่วนหนึ่งของแผน พรุ่งนี้กลับมาให้ดีกว่าเดิม',
  'Nothing planned for today': 'วันนี้ยังไม่มีแผน',
  'Pick muscles': 'เลือกกล้ามเนื้อ',
  'Quick start': 'เริ่มฝึกทันที',
  'This week': 'สัปดาห์นี้',
  'Recent workouts': 'การฝึกล่าสุด',
  'Recent bests': 'สถิติล่าสุด',
  'Daily journal': 'บันทึกประจำวัน',
  'All PRs': 'PR ทั้งหมด',
  'Log': 'บันทึก',
  'Ready when you are': 'พร้อมเมื่อคุณพร้อม',
  'Offline logging': 'บันทึกแบบออฟไลน์',
};

const MUSCLE_TH: Record<string, string> = {
  chest: 'อก',
  shoulders: 'ไหล่',
  biceps: 'ไบเซ็ปส์',
  abdomen: 'หน้าท้อง',
  obliques: 'หน้าท้องด้านข้าง',
  quads: 'ต้นขาด้านหน้า',
  forearm: 'แขนท่อนล่าง',
  trapezius: 'กล้ามเนื้อบ่า',
  back: 'หลัง',
  lowerback: 'หลังส่วนล่าง',
  triceps: 'ไตรเซ็ปส์',
  glutes: 'ก้น',
  hamstrings: 'ต้นขาด้านหลัง',
  calves: 'น่อง',
};

function lookup(text: string): string {
  return COMMON_TH[text] ?? text;
}

/** Translate outside React, for small helpers such as date labels. */
export function translateNow(text: string, vars?: Vars): string {
  return interpolate(
    currentLanguage === 'th' ? lookup(text) : text,
    vars,
  );
}

export function useI18n(extra?: Record<string, string>) {
  const language = useLanguage();
  const t = useCallback(
    (text: string, vars?: Vars) => {
      const template =
        language === 'th' ? (extra?.[text] ?? lookup(text)) : text;
      return interpolate(template, vars);
    },
    [language, extra],
  );
  /** Muscle ids need their own map because labels such as "Back" are also actions. */
  const tm = useCallback(
    (id: string, fallback: string) =>
      language === 'th' ? (MUSCLE_TH[id] ?? lookup(fallback)) : fallback,
    [language],
  );
  return { language, t, tm };
}

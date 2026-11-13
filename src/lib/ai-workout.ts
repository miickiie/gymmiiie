import { AI_MUSCLES, AI_WORKOUT_LIMITS, parseAiWorkoutRequest, type AiWorkoutCandidate, type AiWorkoutMode, type AiWorkoutRequest } from '../../shared/ai-workout';
import type { AppData, Exercise } from '../types';
import { defaultPicks } from './exercises';
import { sessionTrainingDate } from './date';
import { sortedSessions, workingSets } from './stats';

const RECENT_MS = 30 * 24 * 60 * 60 * 1000;

export function routineCandidates(data: AppData, exercises: Exercise[], muscles: string[]): Exercise[] {
  const baseline = defaultPicks(exercises, data.sessions, muscles, data.favorites, AI_WORKOUT_LIMITS.exercises, data.archived);
  const logged = new Set(data.sessions.flatMap(session => session.exercises.filter(exercise => workingSets(exercise.sets).length).map(exercise => exercise.id)));
  const rank = (exercise: Exercise): number => data.favorites[exercise.id] ? 0 : logged.has(exercise.id) ? 1 : 2;
  const eligible = exercises.filter(exercise => exercise.suggestionGroup && !data.archived.includes(exercise.id) && [exercise.primary, ...exercise.secondary].some(muscle => muscles.includes(muscle)))
    .sort((a, b) => Number(!muscles.includes(a.primary)) - Number(!muscles.includes(b.primary)) || rank(a) - rank(b));
  const pool = [...baseline];
  const add = (exercise: Exercise | undefined): void => {
    if (exercise && pool.length < AI_WORKOUT_LIMITS.candidates && !pool.some(item => item.id === exercise.id)) pool.push(exercise);
  };
  for (const muscle of muscles) if (!pool.some(exercise => exercise.primary === muscle)) add(eligible.find(exercise => exercise.primary === muscle));
  for (const exercise of eligible) if (!pool.some(item => item.suggestionGroup === exercise.suggestionGroup)) add(exercise);
  eligible.forEach(add);
  return pool;
}

export function createAiWorkoutRequest(options: { data: AppData; exercises: Exercise[]; muscles: string[]; mode: AiWorkoutMode; accountId: string; now?: number }): AiWorkoutRequest {
  const { data, exercises, muscles, mode, accountId, now = Date.now() } = options;
  const baseline = defaultPicks(exercises, data.sessions, muscles, data.favorites, AI_WORKOUT_LIMITS.exercises, data.archived);
  const pool = mode === 'suggest' ? baseline : routineCandidates(data, exercises, muscles);
  const sessions = sortedSessions(data.sessions);
  const candidates: AiWorkoutCandidate[] = pool.flatMap(exercise => {
    const primary = AI_MUSCLES.find(muscle => muscle === exercise.primary);
    if (!primary || !exercise.suggestionGroup) return [];
    const history = sessions.flatMap(session => {
      const count = session.exercises.filter(item => item.id === exercise.id).reduce((total, item) => total + workingSets(item.sets).length, 0);
      const date = new Date(sessionTrainingDate(session)).getTime();
      return count && Number.isFinite(date) ? [{ count, date }] : [];
    });
    return [{
      id: exercise.id, name: exercise.name.slice(0, AI_WORKOUT_LIMITS.name), primary,
      secondary: AI_MUSCLES.filter(muscle => exercise.secondary.includes(muscle)), suggestionGroup: exercise.suggestionGroup,
      favorite: Boolean(data.favorites[exercise.id]), history: {
        hasWorkingSets: history.length > 0, lastTrainedAt: history[0]?.date ?? null, latestWorkingSets: history[0]?.count ?? 0,
        workingSets30Days: history.filter(item => item.date >= now - RECENT_MS && item.date <= now).reduce((total, item) => total + item.count, 0),
      },
    }];
  });
  return parseAiWorkoutRequest({
    mode, expectedAccountId: accountId, selectedMuscles: muscles, language: data.settings.language,
    profile: { sex: data.profile.sex, age: data.profile.age, height: data.profile.heightCm, weight: data.profile.weightKg, activity: data.profile.activity },
    candidates, baselineIds: baseline.map(exercise => exercise.id),
  });
}

export const AI_WORKOUT_TH: Record<string, string> = {
  'AI is unavailable. Please try again.': 'AI ยังไม่พร้อมใช้งาน โปรดลองอีกครั้ง',
  'Exercises': 'ท่าออกกำลัง', 'Warm-up / mobility': 'วอร์มอัป / เพิ่มช่วงการเคลื่อนไหว',
  'Generate with AI': 'สร้างด้วย AI', 'Generate routine': 'สร้างตารางด้วย AI',
  'AI is arranging your workout…': 'AI กำลังจัดแผนฝึก…', 'Use basic suggestions': 'ใช้คำแนะนำพื้นฐาน',
  'Basic suggestions are shown. AI is unavailable.': 'แสดงคำแนะนำพื้นฐาน เนื่องจาก AI ยังไม่พร้อมใช้งาน',
  'AI generation is not enabled yet.': 'ยังไม่ได้เปิดใช้งานการสร้างแผนด้วย AI',
  'Sign in online to use AI generation.': 'เข้าสู่ระบบออนไลน์เพื่อสร้างแผนด้วย AI',
  'Connect to the internet to use AI generation.': 'เชื่อมต่ออินเทอร์เน็ตเพื่อสร้างแผนด้วย AI',
  'AI generation timed out. Try again or use basic suggestions.': 'AI ใช้เวลานานเกินไป ลองอีกครั้งหรือใช้คำแนะนำพื้นฐาน',
  'The AI request limit was reached. Try again later.': 'ถึงขีดจำกัดคำขอ AI แล้ว โปรดลองภายหลัง',
  'The daily AI allowance is exhausted. Try again tomorrow.': 'ใช้โควตา AI ประจำวันครบแล้ว โปรดลองวันถัดไป',
  'AI is busy. Try again later.': 'AI กำลังไม่ว่าง โปรดลองภายหลัง',
  'AI returned an invalid plan. Please try again.': 'AI ส่งแผนที่ไม่ถูกต้อง โปรดลองอีกครั้ง',
  'The active account changed. Generate a new plan.': 'บัญชีที่ใช้งานเปลี่ยนแล้ว โปรดสร้างแผนใหม่',
  'No reviewed exercises match these muscles. Change your selection or add exercises manually.': 'ไม่พบท่าที่ผ่านการตรวจสอบสำหรับกล้ามเนื้อที่เลือก โปรดเปลี่ยนกล้ามเนื้อหรือเพิ่มท่าเอง',
  'AI plan': 'แผนจาก AI', 'Routine name': 'ชื่อตารางฝึก', 'Save routine': 'บันทึกตารางฝึก', 'Saving…': 'กำลังบันทึก…',
  'Nothing is saved until you choose Save routine.': 'แผนจะยังไม่ถูกบันทึกจนกว่าจะเลือกบันทึกตารางฝึก',
  'Previous working sets; adjust when workout starts.': 'เซ็ตฝึกที่เคยบันทึกไว้ ปรับได้เมื่อเริ่มฝึก',
  'No working-set history; existing defaults will be used.': 'ยังไม่มีประวัติเซ็ตฝึก ระบบจะใช้ค่าเริ่มต้นเดิม',
  'Sets': 'เซ็ต', 'Rest (seconds)': 'พัก (วินาที)', 'Change focus': 'เปลี่ยนเป้าหมาย',
  'Add exercise': 'เพิ่มท่า', 'Replace': 'เปลี่ยนท่า', 'Replace exercise': 'เปลี่ยนท่า',
  'Remove {name}': 'เอา {name} ออก', 'Move {name} up': 'เลื่อน {name} ขึ้น', 'Move {name} down': 'เลื่อน {name} ลง',
  'Form guide': 'คำแนะนำการทำท่า', 'Form guide · {name}': 'คู่มือท่า · {name}',
  'No exercises selected': 'ยังไม่ได้เลือกท่า',
  'No primary movement for {muscles}. Add an exercise or change the focus.': 'ยังไม่มีท่าหลักของ {muscles} เพิ่มท่าหรือเปลี่ยนเป้าหมาย',
  'AI uses your current profile, favorites, and working-set history. Review profile values before generating.': 'AI ใช้โปรไฟล์ รายการโปรด และประวัติเซ็ตฝึกปัจจุบัน โปรดตรวจค่าโปรไฟล์ก่อนสร้างแผน',
  'Age {age} · {height} cm · {weight} kg · {sex} · activity {activity}': 'อายุ {age} · {height} ซม. · {weight} กก. · {sex} · ระดับกิจกรรม {activity}',
  'Edit profile': 'แก้ไขโปรไฟล์', 'male': 'ชาย', 'female': 'หญิง', 'other': 'อื่น ๆ',
  'Select at least one muscle.': 'เลือกกล้ามเนื้ออย่างน้อยหนึ่งส่วน', 'Cancel': 'ยกเลิก',
  'Could not save routine. Check storage and account status, then retry.': 'บันทึกตารางฝึกไม่ได้ โปรดตรวจสถานะพื้นที่จัดเก็บและบัญชี แล้วลองอีกครั้ง',
};

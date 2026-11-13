import { instructionsOf, stepsFor, tipsFor } from '../lib/art';
import { useGuideLanguage } from '../lib/guide';
import { useI18n } from '../lib/i18n';
import type { Exercise } from '../types';
import { ExerciseArt } from './ExerciseArt';
import { ExerciseIcon } from './ExerciseTile';
import { Sheet } from './ui';

const TH: Record<string, string> = {
  'Form guide · {name}': 'คู่มือท่า · {name}',
  Exercise: 'ท่าออกกำลัง',
  'Verified form guidance is not available for this movement.':
    'ยังไม่มีคำแนะนำท่าที่ตรวจสอบแล้วสำหรับท่านี้',
  'Your exercise instructions': 'คำแนะนำท่าของคุณ',
  'Reviewed form guide': 'คู่มือท่าที่ตรวจแล้ว',
  Reference: 'อ้างอิง',
  'No form guide is available for this saved exercise.':
    'ไม่มีคู่มือท่าสำหรับท่าที่บันทึกไว้นี้',
};

export function ExerciseGuide({
  exercise,
  name,
  open,
  onClose,
}: {
  exercise?: Exercise | null;
  name?: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n(TH);
  useGuideLanguage();
  const guide = exercise ? instructionsOf(exercise.id) : undefined;
  const steps = exercise ? stepsFor(exercise) : [];
  const tips = exercise ? tipsFor(exercise) : [];
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('Form guide · {name}', { name: name ?? exercise?.name ?? t('Exercise') })}
    >
      {exercise ? (
        <>
          <ExerciseArt
            slug={exercise.art}
            height={220}
            fallback={<ExerciseIcon ex={exercise} size={64} />}
          />
          {steps.length ? (
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm font-semibold text-dim">
              {steps.map((step, index) => <li key={index}>{step}</li>)}
            </ol>
          ) : (
            <p className="mt-3 text-sm font-semibold text-mute">
              {t('Verified form guidance is not available for this movement.')}
            </p>
          )}
          {tips.length > 0 && (
            <ul className="mt-4 list-disc space-y-2 pl-5 text-xs text-dim">
              {tips.map((tip, index) => <li key={index}>{tip}</li>)}
            </ul>
          )}
          {exercise.kind === 'custom' && (
            <p className="mt-3 text-xs text-mute">{t('Your exercise instructions')}</p>
          )}
          {guide && (
            <p className="mt-3 text-xs text-mute">
              {t('Reviewed form guide')}
              {guide.url && (
                <>{' '}·{' '}<a href={guide.url} target="_blank" rel="noreferrer" className="text-[var(--accent)] underline">{t('Reference')}</a></>
              )}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-mute">{t('No form guide is available for this saved exercise.')}</p>
      )}
    </Sheet>
  );
}

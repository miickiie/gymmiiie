import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../lib/i18n';
import { useStore, type StartResult } from '../lib/store';
import { Btn, Confirm, Sheet, useToast } from './ui';

const TH: Record<string, string> = {
  'No available exercises were found for this workout':
    'ไม่พบท่าออกกำลังที่ใช้ได้สำหรับการฝึกนี้',
  'Resolve the storage issue before starting a workout':
    'แก้ปัญหาพื้นที่เก็บข้อมูลก่อนเริ่มฝึก',
  'Resume the current workout, or discard it before starting another. Completed sets are saved only when the workout is finished.':
    'ฝึกต่อจากเดิม หรือทิ้งก่อนเริ่มใหม่ เซ็ตที่ทำเสร็จจะบันทึกเมื่อจบการฝึกเท่านั้น',
  'Discard & start…': 'ทิ้งแล้วเริ่มใหม่…',
  'All completed and unfinished sets in this workout will be lost. The new workout will then start.':
    'เซ็ตทั้งหมดในการฝึกนี้จะหายไป แล้วจะเริ่มการฝึกใหม่',
  'Discard & start': 'ทิ้งแล้วเริ่มใหม่',
  'Resolve the storage issue before replacing this workout.':
    'แก้ปัญหาพื้นที่เก็บข้อมูลก่อนแทนที่การฝึกนี้',
};

/** Every workout entry point uses the same active-session protection. */
export function useWorkoutStart() {
  const { t } = useI18n(TH);
  const navigate = useNavigate();
  const toast = useToast();
  const [pending, setPending] = useState<{ run: () => StartResult } | null>(
    null,
  );
  const [replace, setReplace] = useState(false);

  const begin = (run: () => StartResult) => {
    const result = run();
    if (result.status === 'started') {
      setPending(null);
      navigate('/session');
    } else if (result.status === 'active-exists') setPending({ run });
    else
      toast.push(
        result.status === 'not-found'
          ? t('No available exercises were found for this workout')
          : t('Resolve the storage issue before starting a workout'),
        'bad',
      );
  };
  const requestStart = (run: () => StartResult) => {
    if (useStore.getState().data.active) setPending({ run });
    else begin(run);
  };
  const close = () => {
    setPending(null);
    setReplace(false);
  };
  const dialogs = (
    <>
      <Sheet
        open={!!pending}
        onClose={close}
        title={t('Workout already in progress')}
      >
        <p className="text-sm font-semibold text-dim">
          {t(
            'Resume the current workout, or discard it before starting another. Completed sets are saved only when the workout is finished.',
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Btn
            variant="primary"
            className="flex-1"
            onClick={() => {
              close();
              navigate('/session');
            }}
          >
            {t('Resume workout')}
          </Btn>
          <Btn className="flex-1" onClick={close}>
            {t('Cancel')}
          </Btn>
          <Btn
            variant="danger"
            className="w-full"
            onClick={() => setReplace(true)}
          >
            {t('Discard & start…')}
          </Btn>
        </div>
      </Sheet>
      <Confirm
        open={replace}
        onClose={() => setReplace(false)}
        title={t('Discard the current workout?')}
        body={t(
          'All completed and unfinished sets in this workout will be lost. The new workout will then start.',
        )}
        confirmLabel={t('Discard & start')}
        onConfirm={() => {
          if (!pending) return;
          useStore.getState().discardSession();
          if (useStore.getState().data.active)
            throw new Error(
              t('Resolve the storage issue before replacing this workout.'),
            );
          begin(pending.run);
        }}
      />
    </>
  );
  return { requestStart, dialogs };
}

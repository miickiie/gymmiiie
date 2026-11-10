import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, type StartResult } from '../lib/store';
import { Btn, Confirm, Sheet, useToast } from './ui';

/** Every workout entry point uses the same active-session protection. */
export function useWorkoutStart() {
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
      toast.push('Workout started! Your little spotter is cheering for you. Let’s take it one set at a time.', 'good');
      navigate('/session');
    } else if (result.status === 'active-exists') setPending({ run });
    else
      toast.push(
        result.status === 'not-found'
          ? 'No available exercises were found for this workout'
          : 'Resolve the storage issue before starting a workout',
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
        title="Workout already in progress"
      >
        <p className="text-sm font-semibold text-dim">
          Resume the current workout, or discard it before starting another.
          Completed sets are saved only when the workout is finished.
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
            Resume workout
          </Btn>
          <Btn className="flex-1" onClick={close}>
            Cancel
          </Btn>
          <Btn
            variant="danger"
            className="w-full"
            onClick={() => setReplace(true)}
          >
            Discard & start…
          </Btn>
        </div>
      </Sheet>
      <Confirm
        open={replace}
        onClose={() => setReplace(false)}
        title="Discard the current workout?"
        body="All completed and unfinished sets in this workout will be lost. The new workout will then start."
        confirmLabel="Discard & start"
        onConfirm={() => {
          if (!pending) return;
          useStore.getState().discardSession();
          if (useStore.getState().data.active)
            throw new Error(
              'Resolve the storage issue before replacing this workout.',
            );
          begin(pending.run);
        }}
      />
    </>
  );
  return { requestStart, dialogs };
}

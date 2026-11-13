import { useCallback, useEffect, useRef, useState } from 'react';
import { AI_WORKOUT_LIMITS, isRecord, parseAiWorkoutOutput, type AiWorkoutMode, type AiWorkoutPlan } from '../../shared/ai-workout';
import { createAiWorkoutRequest } from './ai-workout';
import { allExercises, useStore } from './store';

const ERROR_MESSAGES: Record<string, string> = {
  AI_DISABLED: 'AI generation is not enabled yet.',
  AI_LIMIT: 'The AI request limit was reached. Try again later.',
  AI_QUOTA: 'The daily AI allowance is exhausted. Try again tomorrow.',
  AI_BUSY: 'AI is busy. Try again later.',
  AI_TIMEOUT: 'AI generation timed out. Try again or use basic suggestions.',
  AI_INVALID_RESPONSE: 'AI returned an invalid plan. Please try again.',
  AI_ACCOUNT_CHANGED: 'The active account changed. Generate a new plan.',
  session_required: 'Sign in online to use AI generation.',
};

export function useAiWorkout(): { loading: boolean; notice: string | null; cancel: () => void; generate: (mode: AiWorkoutMode, muscles: string[]) => Promise<AiWorkoutPlan | null> } {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const sequence = useRef(0);
  const active = useRef<AbortController | null>(null);
  const cancel = useCallback((): void => {
    sequence.current += 1;
    active.current?.abort();
    active.current = null;
    setLoading(false);
  }, []);
  useEffect(() => {
    const unsubscribe = useStore.subscribe((state, previous) => {
      if (state.account?.id !== previous.account?.id || state.accountMode !== previous.accountMode ||
        state.data.profile !== previous.data.profile || state.data.favorites !== previous.data.favorites ||
        state.data.sessions !== previous.data.sessions || state.data.archived !== previous.data.archived ||
        state.data.customExercises !== previous.data.customExercises || state.data.settings.language !== previous.data.settings.language) cancel();
    });
    return () => { unsubscribe(); sequence.current += 1; active.current?.abort(); };
  }, [cancel]);

  const generate = useCallback(async (mode: AiWorkoutMode, muscles: string[]): Promise<AiWorkoutPlan | null> => {
    if (active.current) return null;
    const state = useStore.getState();
    setNotice(null);
    if (!state.account || state.accountMode !== 'online' || state.cloudStatus === 'session-expired' || state.cloudStatus === 'conflict') {
      setNotice('Sign in online to use AI generation.'); return null;
    }
    if (!navigator.onLine) { setNotice('Connect to the internet to use AI generation.'); return null; }
    let input;
    try { input = createAiWorkoutRequest({ data: state.data, exercises: allExercises(), muscles, mode, accountId: state.account.id }); }
    catch { setNotice('No reviewed exercises match these muscles. Change your selection or add exercises manually.'); return null; }
    const controller = new AbortController();
    const current = ++sequence.current;
    active.current = controller;
    setLoading(true);
    const timer = setTimeout(() => controller.abort(), AI_WORKOUT_LIMITS.clientTimeout);
    try {
      const response = await fetch('/api/ai/workout-plan', {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input), signal: controller.signal,
      });
      const value: unknown = await response.json();
      if (sequence.current !== current || useStore.getState().account?.id !== input.expectedAccountId) return null;
      if (!response.ok) {
        const code = isRecord(value) && isRecord(value.error) && typeof value.error.code === 'string' ? value.error.code : '';
        setNotice(ERROR_MESSAGES[code] ?? 'AI is unavailable. Please try again.');
        return null;
      }
      if (!isRecord(value) || value.mode !== mode) throw new Error('Invalid plan');
      try { return parseAiWorkoutOutput({ ...(mode === 'routine' ? { name: value.name } : {}), items: value.items }, input); }
      catch { setNotice(ERROR_MESSAGES.AI_INVALID_RESPONSE); return null; }
    } catch {
      if (sequence.current === current) setNotice(controller.signal.aborted ? ERROR_MESSAGES.AI_TIMEOUT : 'AI is unavailable. Please try again.');
      return null;
    } finally {
      clearTimeout(timer);
      if (sequence.current === current) { active.current = null; setLoading(false); }
    }
  }, []);
  return { loading, notice, cancel, generate };
}

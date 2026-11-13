import { useEffect, useRef, useState } from 'react';
import type { AiWorkoutPlan } from '../../shared/ai-workout';
import { AI_WORKOUT_TH } from '../lib/ai-workout';
import { useI18n } from '../lib/i18n';
import { useStore } from '../lib/store';
import { useAiWorkout } from '../lib/useAiWorkout';
import BodyMap from './BodyMap';
import AiProfileSummary from './AiProfileSummary';
import WorkoutDraftReview from './WorkoutDraftReview';
import { Btn, Sheet } from './ui';

export default function GenerateRoutine({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string) => void }) {
  const { t } = useI18n(AI_WORKOUT_TH);
  const accountId = useStore(state => state.account?.id);
  const initialAccount = useRef(accountId);
  const data = useStore(state => state.data);
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState<AiWorkoutPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState(false);
  const ai = useAiWorkout();
  useEffect(() => { if (accountId !== initialAccount.current) onClose(); }, [accountId, onClose]);
  const generate = async (): Promise<void> => {
    const result = await ai.generate('routine', selected);
    if (result) setDraft(result);
  };
  const save = async (): Promise<void> => {
    if (!draft || !accountId || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(false);
    const result = await useStore.getState().saveGeneratedRoutine({
      name: draft.name ?? '', exerciseIds: draft.items.map(item => item.exerciseId),
      sets: Object.fromEntries(draft.items.map(item => [item.exerciseId, item.sets ?? 3])),
      rest: Object.fromEntries(draft.items.map(item => [item.exerciseId, item.restSeconds ?? data.settings.restSec])),
    }, accountId);
    savingRef.current = false;
    setSaving(false);
    if (result.status === 'saved') onSaved(result.id);
    else setSaveError(true);
  };
  return <Sheet open onClose={() => { if (!savingRef.current) { ai.cancel(); onClose(); } }} dismissible={!saving} size="lg" title={t('Generate routine')}>
    <div className="space-y-4">
      {!draft && <>
        <AiProfileSummary />
        <BodyMap selected={selected} onToggle={muscle => { ai.cancel(); setSelected(values => values.includes(muscle) ? values.filter(value => value !== muscle) : [...values, muscle]); }} />
        {!selected.length && <p className="text-sm text-mute">{t('Select at least one muscle.')}</p>}
      </>}
      {ai.loading && <p role="status">{t('AI is arranging your workout…')}</p>}
      {ai.notice && <p role="status" className="text-sm text-[var(--warn)]">{t(ai.notice)}</p>}
      {draft && <>
        <p className="text-xs text-dim">{t('Nothing is saved until you choose Save routine.')}</p>
        <WorkoutDraftReview draft={draft} selectedMuscles={selected} onChange={value => { if (!savingRef.current) setDraft(value); }} />
      </>}
      {saveError && <p role="alert">{t('Could not save routine. Check storage and account status, then retry.')}</p>}
      <div className="flex flex-wrap gap-2">
        {draft ? <><Btn disabled={saving} onClick={() => { ai.cancel(); setDraft(null); }}>{t('Change focus')}</Btn><Btn variant="primary" disabled={saving || !draft.items.length || !draft.name?.trim()} onClick={() => { void save(); }}>{t(saving ? 'Saving…' : 'Save routine')}</Btn></> : <Btn variant="primary" disabled={!selected.length || ai.loading || !accountId} onClick={() => { void generate(); }}>{t('Generate with AI')}</Btn>}
        {ai.loading && <Btn onClick={ai.cancel}>{t('Cancel')}</Btn>}
      </div>
    </div>
  </Sheet>;
}

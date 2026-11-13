import { Link } from 'react-router-dom';
import { AI_WORKOUT_TH } from '../lib/ai-workout';
import { useI18n } from '../lib/i18n';
import { useStore } from '../lib/store';

export default function AiProfileSummary() {
  const { t } = useI18n(AI_WORKOUT_TH);
  const profile = useStore(state => state.data.profile);
  return <div className="mb-3 space-y-1">
    <p className="text-sm text-dim">{t('AI uses your current profile, favorites, and working-set history. Review profile values before generating.')}</p>
    <p className="text-xs text-mute">{t('Age {age} · {height} cm · {weight} kg · {sex} · activity {activity}', { age: profile.age, height: profile.heightCm, weight: profile.weightKg, sex: t(profile.sex), activity: profile.activity })} · <Link className="underline" to="/settings">{t('Edit profile')}</Link></p>
  </div>;
}

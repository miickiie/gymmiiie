import { useEffect, useSyncExternalStore } from 'react';
import { useLanguage } from './i18n';

/** Thai form-guide copy keyed by the reviewed English sentence. */
export type GuideTranslations = Record<string, string>;

// The Thai copy is ~456 KB. Keeping it behind a dynamic import keeps it out of
// the app shell for English readers, who would otherwise download it on every
// route that renders exercise rows.
let thGuide: GuideTranslations | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish() {
  for (const listener of listeners) listener();
}

/** Load the Thai guide copy on demand. Safe to call repeatedly. */
export function loadGuideLanguage(): Promise<void> {
  if (thGuide) return Promise.resolve();
  loading ??= import('../data/instructions-th.json')
    .then((module) => {
      thGuide = (module.default ?? module) as GuideTranslations;
      publish();
    })
    .catch(() => {
      // Retry on the next request instead of caching a failure for this session.
      loading = null;
    });
  return loading;
}

/** Synchronous read for helpers that run outside React. */
export function guideTranslations(): GuideTranslations | null {
  return thGuide;
}

function guideReady(): boolean {
  return thGuide !== null;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Re-render guide text once the Thai copy has loaded. Components that display
 * steps or tips should call this so switching language at runtime fills in the
 * translations without a reload.
 */
export function useGuideLanguage(): boolean {
  const language = useLanguage();
  const ready = useSyncExternalStore(subscribe, guideReady, () => false);
  useEffect(() => {
    if (language === 'th' && !ready) void loadGuideLanguage();
  }, [language, ready]);
  return ready || language !== 'th';
}

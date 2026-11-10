import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from './store';

const VERSION_TIMEOUT_MS = 10_000;

async function latestVersion(signal: AbortSignal): Promise<string | undefined> {
  const response = await fetch('/api/app-version', {
    cache: 'no-store',
    credentials: 'same-origin',
    signal,
  });
  if (!response.ok) return undefined;
  const metadata: unknown = await response.json();
  if (
    metadata &&
    typeof metadata === 'object' &&
    'version' in metadata &&
    typeof metadata.version === 'string' &&
    /^[a-f0-9]{20}$/.test(metadata.version)
  ) {
    return metadata.version;
  }
  return undefined;
}

export function useAppUpdate() {
  const [loadedVersion] = useState(() =>
    document.querySelector<HTMLMetaElement>('meta[name="gymmiie-build"]')?.content,
  );
  const [version, setVersion] = useState<string>();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const dismissedVersions = useRef(new Set<string>());
  const refreshInProgress = useRef(false);

  useEffect(() => {
    if (!loadedVersion) return;
    let request: AbortController | undefined;
    let timeout: number | undefined;
    const check = async () => {
      if (document.visibilityState === 'hidden' || request) return;
      const controller = new AbortController();
      request = controller;
      timeout = window.setTimeout(() => controller.abort(), VERSION_TIMEOUT_MS);
      try {
        const latest = await latestVersion(controller.signal);
        if (!latest || controller.signal.aborted) return;
        if (latest === loadedVersion) setVersion(undefined);
        else if (!dismissedVersions.current.has(latest)) setVersion(latest);
      } catch {
        // An unavailable server must not interrupt an offline workout.
      } finally {
        window.clearTimeout(timeout);
        if (request === controller) request = undefined;
      }
    };
    const onOpen = () => { void check(); };
    onOpen();
    window.addEventListener('pageshow', onOpen);
    window.addEventListener('focus', onOpen);
    window.addEventListener('online', onOpen);
    document.addEventListener('visibilitychange', onOpen);
    return () => {
      request?.abort();
      window.clearTimeout(timeout);
      window.removeEventListener('pageshow', onOpen);
      window.removeEventListener('focus', onOpen);
      window.removeEventListener('online', onOpen);
      document.removeEventListener('visibilitychange', onOpen);
    };
  }, [loadedVersion]);

  const dismiss = useCallback(() => {
    if (version) dismissedVersions.current.add(version);
    setVersion(undefined);
    setError('');
  }, [version]);

  const refresh = useCallback(async () => {
    if (refreshInProgress.current) return;
    refreshInProgress.current = true;
    setRefreshing(true);
    setError('');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), VERSION_TIMEOUT_MS);
    try {
      const latest = await latestVersion(controller.signal);
      if (!latest) throw new Error('The latest app could not be reached.');
      if (latest === loadedVersion) {
        setVersion(undefined);
        return;
      }
      const store = useStore.getState();
      if (store.isCommitting) throw new Error('Changes are still being saved.');
      if (store.hydrated) await store.flushPersistence();
      if (useStore.getState().isCommitting)
        throw new Error('Changes are still being saved.');
      window.location.assign('/api/app-update?refresh=1');
    } catch {
      setError('Mochi couldn’t refresh yet. Check your connection and make sure your changes are saved, then try again.');
    } finally {
      window.clearTimeout(timeout);
      refreshInProgress.current = false;
      setRefreshing(false);
    }
  }, [loadedVersion]);

  return { version, refreshing, error, refresh, dismiss };
}

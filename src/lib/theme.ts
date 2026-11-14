import type { ThemePref } from '../types';

export type ThemeTone = 'dark' | 'light';

/** Mirror of the persisted theme used by the zero-flash boot script in index.html. */
export const THEME_STORAGE_KEY = 'gymmiie:theme';

export interface ThemeOption {
  value: ThemePref;
  label: string;
  tone: ThemeTone;
  themeColor: string;
  swatch: {
    bg: string;
    surface: string;
    accent: string;
  };
}

export const THEMES: readonly ThemeOption[] = [
  {
    value: 'dark',
    label: 'Dark',
    tone: 'dark',
    themeColor: '#090b0e',
    swatch: { bg: '#090b0e', surface: '#1a202a', accent: '#10b981' },
  },
  {
    value: 'light',
    label: 'Light',
    tone: 'light',
    themeColor: '#f1f5f9',
    swatch: { bg: '#f1f5f9', surface: '#e8eef5', accent: '#047857' },
  },
  {
    value: 'solar',
    label: 'Solar',
    tone: 'dark',
    themeColor: '#120f0d',
    swatch: { bg: '#120f0d', surface: '#261f1b', accent: '#f59e0b' },
  },
];

export const DARK_THEMES = THEMES.filter((theme) => theme.tone === 'dark');
export const LIGHT_THEMES = THEMES.filter((theme) => theme.tone === 'light');
export const SOLAR_THEMES = THEMES.filter((theme) => theme.value === 'solar');

export function themeMeta(theme: ThemePref): ThemeOption {
  return THEMES.find((option) => option.value === theme) ?? THEMES[0];
}

export function isLightTheme(theme: ThemePref): boolean {
  return themeMeta(theme).tone === 'light';
}

export function isThemePref(value: unknown): value is ThemePref {
  return (
    typeof value === 'string' &&
    THEMES.some((option) => option.value === value)
  );
}

/**
 * Map the pre-1.1 theme palette onto the three current themes so saved
 * profiles keep a sensible appearance after upgrading.
 */
const LEGACY_THEMES: Record<string, ThemePref> = {
  midnight: 'dark',
  forest: 'dark',
  mist: 'light',
  sage: 'light',
};

/** Resolve pre-v1.1 `system` preferences and unknown values to a concrete theme. */
export function normalizeTheme(
  value: unknown,
  prefersLight = false,
): ThemePref {
  if (value === 'system') return prefersLight ? 'light' : 'dark';
  if (isThemePref(value)) return value;
  if (typeof value === 'string' && value in LEGACY_THEMES) {
    return LEGACY_THEMES[value];
  }
  return 'dark';
}

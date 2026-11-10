import type { ThemePref } from '../types';

export type ThemeTone = 'dark' | 'light';

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
    label: 'Ember',
    tone: 'dark',
    themeColor: '#0b0a09',
    swatch: { bg: '#0b0a09', surface: '#1f1b17', accent: '#df7f4a' },
  },
  {
    value: 'midnight',
    label: 'Midnight',
    tone: 'dark',
    themeColor: '#080b14',
    swatch: { bg: '#080b14', surface: '#182338', accent: '#6ea8fe' },
  },
  {
    value: 'forest',
    label: 'Royal Amethyst',
    tone: 'dark',
    themeColor: '#0d0817',
    swatch: { bg: '#0d0817', surface: '#211640', accent: '#b78cff' },
  },
  {
    value: 'light',
    label: 'Rose Quartz',
    tone: 'light',
    themeColor: '#fbf1f3',
    swatch: { bg: '#fbf1f3', surface: '#f3e4e9', accent: '#b95a7d' },
  },
  {
    value: 'mist',
    label: 'Mist',
    tone: 'light',
    themeColor: '#f2f5f9',
    swatch: { bg: '#f2f5f9', surface: '#e9eef5', accent: '#4a7fb5' },
  },
  {
    value: 'sage',
    label: 'Sage',
    tone: 'light',
    themeColor: '#f2f6f0',
    swatch: { bg: '#f2f6f0', surface: '#e9f0e5', accent: '#4f8a5b' },
  },
];

export const DARK_THEMES = THEMES.filter((theme) => theme.tone === 'dark');
export const LIGHT_THEMES = THEMES.filter((theme) => theme.tone === 'light');

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

/** Resolve pre-v1.1 `system` preferences and unknown values to a concrete theme. */
export function normalizeTheme(
  value: unknown,
  prefersLight = false,
): ThemePref {
  if (value === 'system') return prefersLight ? 'light' : 'dark';
  return isThemePref(value) ? value : 'dark';
}

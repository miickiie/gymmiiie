import type { ThemePref } from '../types';

export type ThemeTone = 'dark' | 'light';

/** Mirror of the persisted theme used by the zero-flash boot script in index.html. */
export const THEME_STORAGE_KEY = 'gymmiie:theme';

export interface ThemePreview {
  bg: string;
  card: string;
  border: string;
  fg: string;
  secondary: string;
  accent: string;
}

export interface ThemeOption {
  value: ThemePref;
  /** Display name, e.g. `Obsidian`. */
  name: string;
  /** Short badge shown next to the swatch, e.g. `AMOLED`. */
  tag: string;
  /** Kept as an alias of `name` for existing translated strings. */
  label: string;
  tone: ThemeTone;
  description: string;
  /** Browser chrome colour applied to `<meta name="theme-color">`. */
  themeColor: string;
  preview: ThemePreview;
  /** Legacy compact swatch shape used by older UI code. */
  swatch: {
    bg: string;
    surface: string;
    accent: string;
  };
}

export const THEMES: readonly ThemeOption[] = [
  {
    value: 'dark',
    name: 'Obsidian',
    tag: 'Dark',
    label: 'Obsidian',
    tone: 'dark',
    description: 'Tactile slate & emerald baseline',
    themeColor: '#090b0e',
    preview: {
      bg: '#090B0E',
      card: '#12161D',
      border: '#242C3A',
      fg: '#F8FAFC',
      secondary: '#94A3B8',
      accent: '#10B981',
    },
    swatch: { bg: '#090b0e', surface: '#1a202a', accent: '#10b981' },
  },
  {
    value: 'volt',
    name: 'Volt OLED',
    tag: 'AMOLED',
    label: 'Volt OLED',
    tone: 'dark',
    description: 'Pure #000000 black + kinetic lime',
    themeColor: '#000000',
    preview: {
      bg: '#000000',
      card: '#0B0E0C',
      border: '#232B26',
      fg: '#F7FEE7',
      secondary: '#A1ABA4',
      accent: '#A3E635',
    },
    swatch: { bg: '#000000', surface: '#141916', accent: '#a3e635' },
  },
  {
    value: 'abyss',
    name: 'Abyss',
    tag: 'Cool Dark',
    label: 'Abyss',
    tone: 'dark',
    description: 'Deep navy + cryo telemetry cyan',
    themeColor: '#070d19',
    preview: {
      bg: '#070D19',
      card: '#0E1729',
      border: '#1F3152',
      fg: '#F0F7FF',
      secondary: '#93ADC8',
      accent: '#38BDF8',
    },
    swatch: { bg: '#070d19', surface: '#16233b', accent: '#38bdf8' },
  },
  {
    value: 'solar',
    name: 'Solar',
    tag: 'Night Warm',
    label: 'Solar',
    tone: 'dark',
    description: 'Low-blue-light espresso + amber gold',
    themeColor: '#120f0d',
    preview: {
      bg: '#120F0D',
      card: '#1C1714',
      border: '#352B25',
      fg: '#FAF5EE',
      secondary: '#B8AA9E',
      accent: '#F59E0B',
    },
    swatch: { bg: '#120f0d', surface: '#261f1b', accent: '#f59e0b' },
  },
  {
    value: 'light',
    name: 'Studio',
    tag: 'Daylight',
    label: 'Studio',
    tone: 'light',
    description: 'Crisp studio slate + clean emerald',
    themeColor: '#f1f5f9',
    preview: {
      bg: '#F1F5F9',
      card: '#FFFFFF',
      border: '#CBD5E1',
      fg: '#0F172A',
      secondary: '#475569',
      accent: '#047857',
    },
    swatch: { bg: '#f1f5f9', surface: '#e8eef5', accent: '#047857' },
  },
  {
    value: 'dune',
    name: 'Dune',
    tag: 'Chalk Stone',
    label: 'Dune',
    tone: 'light',
    description: 'Alabaster stone + competition red',
    themeColor: '#f5f5f4',
    preview: {
      bg: '#F5F5F4',
      card: '#FFFFFF',
      border: '#D6D6D3',
      fg: '#18181A',
      secondary: '#525258',
      accent: '#C81E1E',
    },
    swatch: { bg: '#f5f5f4', surface: '#eaeae8', accent: '#c81e1e' },
  },
];

export const THEME_IDS: readonly ThemePref[] = THEMES.map(
  (theme) => theme.value,
);

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
 * Map the pre-1.1 theme palette onto the current themes so saved profiles
 * keep a sensible appearance after upgrading.
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

import { describe, expect, it } from 'vitest';
import {
  DARK_THEMES,
  LIGHT_THEMES,
  SOLAR_THEMES,
  isLightTheme,
  isThemePref,
  normalizeTheme,
  themeMeta,
} from './theme';

describe('theme registry', () => {
  it('exposes Dark, Light, and Solar exactly once', () => {
    expect(DARK_THEMES.map((theme) => theme.value)).toEqual([
      'dark',
      'solar',
    ]);
    expect(LIGHT_THEMES.map((theme) => theme.value)).toEqual(['light']);
    expect(SOLAR_THEMES.map((theme) => theme.value)).toEqual(['solar']);
    expect(isLightTheme('solar')).toBe(false);
  });

  it('recognises current theme ids', () => {
    expect(isThemePref('dark')).toBe(true);
    expect(isThemePref('light')).toBe(true);
    expect(isThemePref('solar')).toBe(true);
    expect(isThemePref('midnight')).toBe(false);
  });

  it('normalises legacy theme ids to the nearest current theme', () => {
    expect(normalizeTheme('midnight')).toBe('dark');
    expect(normalizeTheme('forest')).toBe('dark');
    expect(normalizeTheme('mist')).toBe('light');
    expect(normalizeTheme('sage')).toBe('light');
    expect(normalizeTheme('system', true)).toBe('light');
    expect(normalizeTheme('system', false)).toBe('dark');
    expect(normalizeTheme('unknown')).toBe('dark');
  });

  it('reports theme metadata and a safe fallback', () => {
    expect(themeMeta('solar').themeColor).toBe('#120f0d');
    expect(themeMeta('dark').label).toBe('Dark');
    expect(themeMeta('light').tone).toBe('light');
  });
});

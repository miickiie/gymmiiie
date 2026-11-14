import { describe, expect, it } from 'vitest';
import {
  DARK_THEMES,
  LIGHT_THEMES,
  SOLAR_THEMES,
  THEMES,
  THEME_IDS,
  isLightTheme,
  isThemePref,
  normalizeTheme,
  themeMeta,
} from './theme';

describe('theme registry', () => {
  it('exposes all six themes in display order', () => {
    expect(THEME_IDS).toEqual([
      'dark',
      'volt',
      'abyss',
      'solar',
      'light',
      'dune',
    ]);
    expect(THEMES).toHaveLength(6);
    expect(DARK_THEMES.map((theme) => theme.value)).toEqual([
      'dark',
      'volt',
      'abyss',
      'solar',
    ]);
    expect(LIGHT_THEMES.map((theme) => theme.value)).toEqual([
      'light',
      'dune',
    ]);
    expect(SOLAR_THEMES.map((theme) => theme.value)).toEqual(['solar']);
    expect(isLightTheme('solar')).toBe(false);
    expect(isLightTheme('dune')).toBe(true);
  });

  it('recognises current theme ids', () => {
    for (const id of THEME_IDS) expect(isThemePref(id)).toBe(true);
    expect(isThemePref('midnight')).toBe(false);
    expect(isThemePref('unknown')).toBe(false);
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

  it('keeps saved dark, light, and solar preferences intact', () => {
    expect(normalizeTheme('dark')).toBe('dark');
    expect(normalizeTheme('light')).toBe('light');
    expect(normalizeTheme('solar')).toBe('solar');
  });

  it('reports theme metadata and a safe fallback', () => {
    expect(themeMeta('solar').themeColor).toBe('#120f0d');
    expect(themeMeta('dark').name).toBe('Obsidian');
    expect(themeMeta('volt').tag).toBe('AMOLED');
    expect(themeMeta('abyss').tag).toBe('Cool Dark');
    expect(themeMeta('light').name).toBe('Studio');
    expect(themeMeta('dune').tag).toBe('Chalk Stone');
    expect(themeMeta('light').tone).toBe('light');
    expect(themeMeta('unknown' as never).value).toBe('dark');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../data/art.json', () => ({
  default: { painted: { n: 2, src: 'test', url: 'https://example.com/art' } },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

/** A DOM fixture isolates extraction; browser tests also exercise native SVG XML parsing. */
function documentFixture(frames: Record<string, string>[][]) {
  vi.stubGlobal(
    'DOMParser',
    class {
      parseFromString() {
        return {
          documentElement: {
            getAttribute: (name: string) =>
              name === 'viewBox' ? '0 0 229 275' : null,
            querySelector: () => null,
            querySelectorAll: () =>
              frames.map((paths) => ({
                querySelectorAll: () =>
                  paths.map((attributes) => ({
                    getAttribute: (name: string) => attributes[name] ?? null,
                  })),
              })),
          },
        };
      }
    },
  );
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<svg/>')));
}

describe('exercise SVG paint extraction', () => {
  it('preserves original background and figure paint, order, fill rule and opacity', async () => {
    documentFixture([
      [
        {
          d: 'M0 0h229v275H0z',
          fill: '#FFFFFF',
          'fill-rule': 'nonzero',
          opacity: '1.00',
        },
        {
          d: 'M100 20h10v100h-10z',
          fill: '#333333',
          'fill-rule': 'nonzero',
          opacity: '0.5',
        },
      ],
      [{ d: 'M100 30h10v100h-10z', fill: '#333333' }],
    ]);
    const { loadMotion } = await import('./art');
    const result = await loadMotion('painted');
    expect(result?.viewBox).toBe('0 0 229 275');
    expect(result?.frames[0]).toEqual([
      {
        d: 'M0 0h229v275H0z',
        fill: '#FFFFFF',
        fillRule: 'nonzero',
        opacity: 1,
      },
      {
        d: 'M100 20h10v100h-10z',
        fill: '#333333',
        fillRule: 'nonzero',
        opacity: 0.5,
      },
    ]);
    expect(result?.frames[1][0].fillRule).toBe('nonzero');
  });

  it('retains legacy monochrome currentColor and explicit evenodd geometry', async () => {
    documentFixture([[{ d: 'M1 1h4v4H1z', 'fill-rule': 'evenodd' }]]);
    const { loadMotion } = await import('./art');
    expect((await loadMotion('painted'))?.frames[0][0]).toEqual({
      d: 'M1 1h4v4H1z',
      fill: 'currentColor',
      fillRule: 'evenodd',
      opacity: 1,
    });
  });

  it('uses a finite bounded opacity even when source metadata is malformed', async () => {
    documentFixture([
      ['NaN', '2', '-1', ''].map((opacity) => ({ d: 'M1 1h4v4H1z', opacity })),
    ]);
    const { loadMotion } = await import('./art');
    expect(
      (await loadMotion('painted'))?.frames[0].map((path) => path.opacity),
    ).toEqual([1, 1, 0, 1]);
  });
});

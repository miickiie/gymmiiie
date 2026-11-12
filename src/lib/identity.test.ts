import { describe, expect, it } from 'vitest';
import { normalizePinIdentity, pinIdentityFieldErrors } from './identity';

describe('account identity normalization', () => {
  it('normalizes names and preserves leading zeros in four-digit PINs', () => {
    expect(normalizePinIdentity({ name: '  ＭＩＣＫＥＹ   Test ', pin: '0123' }))
      .toEqual({ name: 'MICKEY Test', normalizedName: 'mickey test', pin: '0123' });
    expect(pinIdentityFieldErrors('Mickey', '0000')).toEqual({});
  });
  it.each(['', '123', '12345', '-123', '12a3', '1.23'])('rejects invalid PIN %j', (pin) => {
    expect(pinIdentityFieldErrors('Mickey', pin).pin).toBeTruthy();
  });
  it('reports name and PIN errors together and rejects numeric PIN values', () => {
    expect(Object.keys(pinIdentityFieldErrors(' ', '12'))).toEqual(['name', 'pin']);
    expect(() => normalizePinIdentity({ name: 'Mickey', pin: 1234 })).toThrow();
  });
  it('shares NFKC, whitespace and case normalization across client and Worker', () => {
    expect(
      normalizePinIdentity({
        name: '  ＭＩＣＫＥＹ\t Smith  ',
        pin: '0123',
      }),
    ).toEqual({
      name: 'MICKEY Smith',
      normalizedName: 'mickey smith',
      pin: '0123',
    });
  });
  it('rejects invisible controls and bounds identity lengths', () => {
    for (const name of ['x'.repeat(101), 'Mickey\u0000', 'Mickey\u200b'])
      expect(pinIdentityFieldErrors(name, '0123').name).toBeTruthy();
  });
});

import { describe, expect, it } from 'vitest';
import { identityFieldErrors, normalizeIdentity, normalizePinIdentity, pinIdentityFieldErrors } from './identity';

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
      normalizeIdentity({
        name: '  ＭＩＣＫＥＹ\t Smith  ',
        telephone: '+66 (81) 234-5678',
      }),
    ).toEqual({
      name: 'MICKEY Smith',
      normalizedName: 'mickey smith',
      telephone: '+66812345678',
    });
  });
  it('requires an explicit international country code and rejects extensions', () => {
    for (const telephone of [
      '0812345678',
      '+0123456789',
      '+1234567',
      '+1234567890123456',
      '+1234567890 ext 1',
      '+1+234567890',
    ])
      expect(identityFieldErrors('Mickey', telephone).telephone).toBeTruthy();
  });
  it('reports both invalid fields without substituting a guessed country', () => {
    expect(Object.keys(identityFieldErrors(' ', '0812345678'))).toEqual([
      'name',
      'telephone',
    ]);
    expect(identityFieldErrors('Mickey', '+66812345678')).toEqual({});
  });
  it('rejects invisible controls and bounds identity lengths', () => {
    for (const name of ['x'.repeat(101), 'Mickey\u0000', 'Mickey\u200b'])
      expect(identityFieldErrors(name, '+66812345678').name).toBeTruthy();
  });
});

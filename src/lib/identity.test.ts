import { describe, expect, it } from 'vitest';
import { identityFieldErrors, normalizeIdentity } from './identity';

describe('account identity normalization', () => {
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

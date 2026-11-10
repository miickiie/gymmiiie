export type IdentityField = 'name' | 'telephone';

export class IdentityValidationError extends Error {
  constructor(
    public readonly field: IdentityField,
    message: string,
  ) {
    super(message);
    this.name = 'IdentityValidationError';
  }
}

export interface NormalizedIdentity {
  name: string;
  normalizedName: string;
  telephone: string;
}

/** Shared identity rules. No default telephone country or editable profile fields. */
export function normalizeIdentity(input: {
  name: unknown;
  telephone: unknown;
}): NormalizedIdentity {
  if (typeof input.name !== 'string')
    throw new IdentityValidationError('name', 'Enter your name.');
  const name = input.name.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  if (!name || name.length > 100 || /[\p{Cc}\p{Cf}]/u.test(name))
    throw new IdentityValidationError(
      'name',
      'Use a name between 1 and 100 characters.',
    );
  if (typeof input.telephone !== 'string')
    throw new IdentityValidationError(
      'telephone',
      'Enter your telephone number.',
    );
  const telephone = input.telephone
    .normalize('NFKC')
    .trim()
    .replace(/[\s()./\-]/gu, '');
  if (!/^\+[1-9][0-9]{7,14}$/.test(telephone))
    throw new IdentityValidationError(
      'telephone',
      'Use + and your country code, followed by 8–15 digits in total.',
    );
  return { name, normalizedName: name.toLowerCase(), telephone };
}

export function identityFieldErrors(
  name: string,
  telephone: string,
): Partial<Record<IdentityField, string>> {
  const errors: Partial<Record<IdentityField, string>> = {};
  // Validate independently so both fields can show useful feedback together.
  for (const field of ['name', 'telephone'] as const) {
    try {
      normalizeIdentity({
        name: field === 'name' ? name : 'Validation',
        telephone: field === 'telephone' ? telephone : '+1234567890',
      });
    } catch (error) {
      if (error instanceof IdentityValidationError)
        errors[field] = error.message;
      else throw error;
    }
  }
  return errors;
}

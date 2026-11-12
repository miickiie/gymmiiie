export type IdentityField = 'name' | 'telephone' | 'pin';

export const PIN_LENGTH = 4;

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

export interface NormalizedPinIdentity {
  name: string;
  normalizedName: string;
  pin: string;
}

function normalizeName(value: unknown): { name: string; normalizedName: string } {
  if (typeof value !== 'string')
    throw new IdentityValidationError('name', 'Enter your name.');
  const name = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  if (!name || name.length > 100 || /[\p{Cc}\p{Cf}]/u.test(name))
    throw new IdentityValidationError(
      'name',
      'Use a name between 1 and 100 characters.',
    );
  return { name, normalizedName: name.toLowerCase() };
}

export function normalizePinIdentity(input: {
  name: unknown;
  pin: unknown;
}): NormalizedPinIdentity {
  const name = normalizeName(input.name);
  if (typeof input.pin !== 'string')
    throw new IdentityValidationError('pin', 'Enter your 4-digit PIN.');
  const pin = input.pin.trim();
  if (pin.length !== PIN_LENGTH || !/^[0-9]+$/.test(pin))
    throw new IdentityValidationError('pin', 'Use exactly 4 digits for your PIN.');
  return { ...name, pin };
}

/** Telephone is accepted only to enroll an existing account in PIN sign-in. */
export function normalizeIdentity(input: {
  name: unknown;
  telephone: unknown;
}): NormalizedIdentity {
  const name = normalizeName(input.name);
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
  return { ...name, telephone };
}

export function identityFieldErrors(
  name: string,
  telephone: string,
): Partial<Record<IdentityField, string>> {
  return validationErrors(name, telephone, 'telephone');
}

export function pinIdentityFieldErrors(
  name: string,
  pin: string,
): Partial<Record<IdentityField, string>> {
  return validationErrors(name, pin, 'pin');
}

function validationErrors(
  name: string,
  credential: string,
  credentialField: 'telephone' | 'pin',
): Partial<Record<IdentityField, string>> {
  const errors: Partial<Record<IdentityField, string>> = {};
  // Validate independently so both fields can show useful feedback together.
  for (const field of ['name', credentialField] as const) {
    try {
      const validationName = field === 'name' ? name : 'Validation';
      if (credentialField === 'pin')
        normalizePinIdentity({
          name: validationName,
          pin: field === 'pin' ? credential : '0000',
        });
      else
        normalizeIdentity({
          name: validationName,
          telephone: field === 'telephone' ? credential : '+1234567890',
        });
    } catch (error) {
      if (error instanceof IdentityValidationError)
        errors[field] = error.message;
      else throw error;
    }
  }
  return errors;
}

export type IdentityField = 'name' | 'pin';

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

export function pinIdentityFieldErrors(
  name: string,
  pin: string,
): Partial<Record<IdentityField, string>> {
  const errors: Partial<Record<IdentityField, string>> = {};
  // Validate independently so both fields can show useful feedback together.
  for (const field of ['name', 'pin'] as const) {
    try {
      normalizePinIdentity({
        name: field === 'name' ? name : 'Validation',
        pin: field === 'pin' ? pin : '0000',
      });
    } catch (error) {
      if (error instanceof IdentityValidationError)
        errors[field] = error.message;
      else throw error;
    }
  }
  return errors;
}

import { describe, expect, it } from 'vitest';
import { normalizePhone, phoneAuthError } from './phoneAuth';

describe('phone authentication input', () => {
  it('normalizes Indian mobile numbers and common formatting', () => {
    expect(normalizePhone('98765 43210')).toBe('+919876543210');
    expect(normalizePhone('+91 (98765)-43210')).toBe('+919876543210');
  });
  it('preserves international E.164 numbers', () => {
    expect(normalizePhone('+14155552671')).toBe('+14155552671');
  });
  it('rejects malformed numbers instead of sending SMS', () => {
    for (const number of [
      '',
      '1234567890',
      '+910123456789',
      '987654321',
      '+012345678',
      '+919876543210123',
      'call me',
    ])
      expect(() => normalizePhone(number)).toThrow();
  });
  it('explains verification and expired-code failures', () => {
    expect(phoneAuthError({ code: 'auth/invalid-verification-code' })).toContain('incorrect');
    expect(phoneAuthError({ code: 'auth/code-expired' })).toContain('expired');
    expect(phoneAuthError({ code: 'auth/unauthorized-domain' })).toContain('authorized domains');
  });
  it('does not display raw SDK errors or private input', () => {
    expect(phoneAuthError(new Error('sensitive raw response'))).not.toContain('sensitive');
    expect(phoneAuthError(null)).toContain('Unable');
  });
});

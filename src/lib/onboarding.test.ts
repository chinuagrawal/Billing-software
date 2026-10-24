import { describe, expect, it } from 'vitest';
import { applyCommand, businessSetupError } from './billing';
import { emptyWorkspace } from './seed';
const business = {
  ...emptyWorkspace().business,
  name: 'My legal business',
  state: '27',
  gstin: '27AAPFU0939F1ZV',
  address: 'Mumbai 400001',
  email: 'owner@example.com',
  phone: '+919876543210',
  prefix: 'BILL',
  setupCompleted: true,
};
describe('business onboarding', () => {
  it('starts a cloud account without invented business details', () => {
    const blank = emptyWorkspace().business;
    for (const key of ['name', 'state', 'gstin', 'address', 'email', 'phone', 'prefix'] as const)
      expect(blank[key]).toBe('');
    expect(blank.setupCompleted).toBe(false);
  });
  it('accepts actual complete details without requiring bank information', () => {
    expect(businessSetupError(business)).toBe('');
    expect(
      applyCommand(emptyWorkspace(), { type: 'saveBusiness', business }).business.setupCompleted,
    ).toBe(true);
  });
  it('rejects incomplete completion requests on the shared server path', () => {
    for (const key of ['name', 'state', 'gstin', 'address', 'email', 'phone', 'prefix'] as const)
      expect(() =>
        applyCommand(emptyWorkspace(), {
          type: 'saveBusiness',
          business: { ...business, [key]: '' },
        }),
      ).toThrow();
  });
  it('rejects mismatched GST state and partial bank details', () => {
    expect(businessSetupError({ ...business, state: '08' })).toContain('GSTIN');
    expect(businessSetupError({ ...business, bankName: 'My bank' })).toContain('bank');
  });
});

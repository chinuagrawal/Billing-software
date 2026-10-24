import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defaultBusiness } from '../src/lib/seed';
const mocks = vi.hoisted(() => ({ verify: vi.fn(), execute: vi.fn(), remove: vi.fn() }));
vi.mock('./account', () => ({ deleteOwnerAccount: mocks.remove }));
vi.mock('firebase-admin/app', () => ({
  getApps: () => [{ name: 'billing-server' }],
  initializeApp: () => ({}),
  cert: () => ({}),
}));
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifyIdToken: mocks.verify }) }));
vi.mock('firebase-admin/firestore', () => ({ getFirestore: () => ({}) }));
vi.mock('./commands', () => ({
  executeServerCommand: mocks.execute,
  CommandError: class extends Error {},
}));
import handler from '../api/command';
import accountHandler from '../api/account';
async function request(method: string, body: unknown, authorization?: string, endpoint = handler) {
  let output = '';
  const headers = new Map<string, string>();
  const response = {
    statusCode: 200,
    setHeader: (key: string, value: string) => headers.set(key, value),
    end: (text: string) => {
      output = text;
    },
  };
  await endpoint(
    { method, headers: { authorization }, body } as IncomingMessage & { body: unknown },
    response as unknown as ServerResponse,
  );
  return { status: response.statusCode, body: JSON.parse(output), headers };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('FIREBASE_PROJECT_ID', 'test-project');
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-project');
  vi.stubEnv('FIREBASE_CLIENT_EMAIL', 'test@example.com');
  vi.stubEnv('FIREBASE_PRIVATE_KEY', 'test-only');
  mocks.verify.mockResolvedValue({
    uid: 'verified-owner',
    auth_time: Math.floor(Date.now() / 1000),
  });
  mocks.remove.mockResolvedValue(undefined);
  mocks.execute.mockResolvedValue({ replayed: false });
});

describe('account deletion boundary', () => {
  it('requires authentication and a POST request', async () => {
    expect(
      (await request('POST', { confirmation: 'DELETE' }, undefined, accountHandler)).status,
    ).toBe(401);
    expect((await request('GET', {}, 'Bearer valid', accountHandler)).status).toBe(405);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('rejects stale or absent authentication time', async () => {
    for (const auth_time of [Math.floor(Date.now() / 1000) - 301, undefined]) {
      mocks.verify.mockResolvedValue({ uid: 'verified-owner', auth_time });
      expect(
        (await request('POST', { confirmation: 'DELETE' }, 'Bearer valid', accountHandler)).status,
      ).toBe(401);
    }
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('requires explicit confirmation and rejects owner overrides', async () => {
    for (const body of [{ confirmation: 'delete' }, { confirmation: 'DELETE', uid: 'victim' }])
      expect((await request('POST', body, 'Bearer valid', accountHandler)).status).toBe(400);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('only deletes the recently verified token owner', async () => {
    expect(
      (await request('POST', { confirmation: 'DELETE' }, 'Bearer valid', accountHandler)).status,
    ).toBe(200);
    expect(mocks.remove.mock.calls[0][2]).toBe('verified-owner');
    expect(mocks.verify).toHaveBeenCalledWith('valid', true);
  });
});
describe('API authorization boundary', () => {
  it('rejects unauthenticated writes', async () => {
    expect((await request('POST', {})).status).toBe(401);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it('rejects non-POST methods', async () => {
    expect((await request('GET', {})).status).toBe(405);
  });
  it('rejects expired or revoked tokens', async () => {
    mocks.verify.mockRejectedValue(new Error('revoked'));
    expect((await request('POST', {}, 'Bearer expired')).status).toBe(401);
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it('uses the verified token UID as the sole workspace authority', async () => {
    const command = { type: 'saveBusiness', business: defaultBusiness };
    const result = await request('POST', { requestId: 'request-1', command }, 'Bearer valid-token');
    expect(result.status).toBe(200);
    expect(mocks.verify).toHaveBeenCalledWith('valid-token', true);
    expect(mocks.execute).toHaveBeenCalledWith({}, 'verified-owner', 'request-1', command);
    expect(result.headers.get('Cache-Control')).toBe('no-store');
  });
  it('rejects caller-supplied owner overrides and path traversal', async () => {
    expect(
      (
        await request(
          'POST',
          {
            requestId: 'request-1',
            ownerId: 'other-person',
            command: { type: 'saveBusiness', business: defaultBusiness },
          },
          'Bearer valid',
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await request(
          'POST',
          { requestId: 'request-1', command: { type: 'void', id: '../other' } },
          'Bearer valid',
        )
      ).status,
    ).toBe(400);
  });
  it('rejects unknown commands and oversized input', async () => {
    expect(
      (
        await request(
          'POST',
          { requestId: 'request-1', command: { type: 'deleteAll' } },
          'Bearer valid',
        )
      ).status,
    ).toBe(400);
    expect((await request('POST', { padding: 'x'.repeat(200001) }, 'Bearer valid')).status).toBe(
      413,
    );
  });
  it('reports missing server configuration without exposing credentials', async () => {
    vi.stubEnv('FIREBASE_PRIVATE_KEY', '');
    const result = await request('POST', {}, 'Bearer valid');
    expect(result.status).toBe(503);
    expect(result.body.error).not.toContain('test-only');
  });
});

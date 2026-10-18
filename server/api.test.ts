import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { emptyWorkspace } from '../src/lib/seed';
const mocks = vi.hoisted(() => ({ verify: vi.fn(), execute: vi.fn() }));
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
async function request(method: string, body: unknown, authorization?: string) {
  let output = '';
  const headers = new Map<string, string>();
  const response = {
    statusCode: 200,
    setHeader: (key: string, value: string) => headers.set(key, value),
    end: (text: string) => {
      output = text;
    },
  };
  await handler(
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
  mocks.verify.mockResolvedValue({ uid: 'verified-owner' });
  mocks.execute.mockResolvedValue({ replayed: false });
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
    const command = { type: 'saveBusiness', business: emptyWorkspace().business };
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
            command: { type: 'saveBusiness', business: emptyWorkspace().business },
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

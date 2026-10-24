import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import { services, readBody } from './command.js';
import { deleteOwnerAccount } from '../account.js';

const schema = z.object({ confirmation: z.literal('DELETE') }).strict();
export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
) {
  const reply = (code: number, body: object) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(JSON.stringify(body));
  };
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    reply(405, { error: 'Use POST to delete your account.' });
    return;
  }
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) {
    reply(401, { error: 'Sign in before deleting your account.' });
    return;
  }
  let service: ReturnType<typeof services>;
  try {
    service = services();
  } catch {
    reply(503, { error: 'The account service is not configured. Contact your administrator.' });
    return;
  }
  let uid: string;
  try {
    const identity = await service.auth.verifyIdToken(token, true);
    const age = Date.now() / 1000 - identity.auth_time;
    if (!Number.isFinite(age) || age > 300 || age < -60) {
      reply(401, {
        error: 'Verify your identity again before deleting your account.',
        code: 'REAUTH_REQUIRED',
      });
      return;
    }
    uid = identity.uid;
  } catch {
    reply(401, { error: 'Your sign-in expired. Sign in again.' });
    return;
  }
  try {
    if (!schema.safeParse(await readBody(req)).success) {
      reply(400, { error: 'Type DELETE to confirm account deletion.' });
      return;
    }
  } catch {
    reply(400, { error: 'Invalid deletion request.' });
    return;
  }
  try {
    await deleteOwnerAccount(service.database, service.auth, uid);
    reply(200, { ok: true });
  } catch (error) {
    console.error('Account deletion failed', error instanceof Error ? error.name : 'UnknownError');
    reply(500, {
      error:
        'Deletion could not be completed. Some records may already be removed. Retry to finish deleting your account.',
    });
  }
}

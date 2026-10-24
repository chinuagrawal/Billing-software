import type { IncomingMessage, ServerResponse } from 'node:http';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { requestSchema } from '../server/schema';
import { CommandError, executeServerCommand } from '../server/commands';

const MAX_BODY = 200_000;
export function services() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('SERVER_NOT_CONFIGURED');
  if (process.env.VITE_FIREBASE_PROJECT_ID && projectId !== process.env.VITE_FIREBASE_PROJECT_ID)
    throw new Error('SERVER_NOT_CONFIGURED');
  const app =
    getApps().find((a) => a.name === 'billing-server') ||
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }, 'billing-server');
  return { auth: getAuth(app), database: getFirestore(app) };
}
export async function readBody(req: IncomingMessage & { body?: unknown }) {
  if (req.body !== undefined) {
    const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(raw) > MAX_BODY) throw new Error('BODY_TOO_LARGE');
    return JSON.parse(raw);
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY) throw new Error('BODY_TOO_LARGE');
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
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
    reply(405, { error: 'Use POST for workspace changes.' });
    return;
  }
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) {
    reply(401, { error: 'Sign in before changing your workspace.' });
    return;
  }
  let service: ReturnType<typeof services>;
  try {
    service = services();
  } catch {
    reply(503, {
      error:
        'The cloud write service is not configured. Add the Firebase server credentials to your deployment.',
    });
    return;
  }
  let ownerId: string;
  try {
    ownerId = (await service.auth.verifyIdToken(token, true)).uid;
  } catch {
    reply(401, { error: 'Your sign-in has expired. Sign in again.' });
    return;
  }
  let input: unknown;
  try {
    input = await readBody(req);
  } catch (error) {
    reply((error as Error).message === 'BODY_TOO_LARGE' ? 413 : 400, {
      error: 'Invalid request. Submit a valid JSON command under 200 KB.',
    });
    return;
  }
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    reply(400, {
      error: 'Some fields are invalid. Check your dates, text lengths and numeric values.',
    });
    return;
  }
  try {
    const result = await executeServerCommand(
      service.database,
      ownerId,
      parsed.data.requestId,
      parsed.data.command,
    );
    reply(200, { ok: true, ...result });
  } catch (error) {
    if (error instanceof CommandError) {
      reply(422, { error: error.message });
      return;
    }
    console.error('Billing command failed', error instanceof Error ? error.name : 'UnknownError');
    reply(500, {
      error:
        'The change could not be confirmed. Retry the same action; duplicate requests are protected.',
    });
  }
}

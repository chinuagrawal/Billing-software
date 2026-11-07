import type { IncomingMessage, ServerResponse } from 'node:http';
import { readBody, services } from './command.js';
import { validGstin } from '../../src/lib/billing.js';

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
) {
  const reply = (status: number, body: object) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
  };
  if (req.method !== 'POST') return reply(405, { error: 'Use POST.' });
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) return reply(401, { error: 'Sign in to look up GST details.' });
  try {
    const service = services();
    let uid: string;
    try {
      uid = (await service.auth.verifyIdToken(token, true)).uid;
    } catch {
      return reply(401, { error: 'Sign in again to look up GST details.' });
    }
    const body = await readBody(req);
    const gstin = typeof body?.gstin === 'string' ? body.gstin.trim().toUpperCase() : '';
    if (!validGstin(gstin)) return reply(400, { error: 'Enter a valid GSTIN.' });
    const key = process.env.SANDBOX_API_KEY;
    const secret = process.env.SANDBOX_API_SECRET;
    if (!key || !secret)
      return reply(503, {
        error:
          'GST lookup needs Sandbox credentials configured on the server. You can enter customer details manually.',
      });
    const allowed = await service.database.runTransaction(async (tx) => {
      const ref = service.database.collection('gstLookupLimits').doc(uid);
      const snapshot = await tx.get(ref);
      const previous = snapshot.data();
      const now = Date.now();
      const count = previous && now - previous.start < 3600000 ? previous.count : 0;
      if (count >= 30) return false;
      tx.set(ref, { start: count ? previous!.start : now, count: count + 1 });
      return true;
    });
    if (!allowed)
      return reply(429, {
        error: 'GST lookup limit reached. Try again in an hour or enter details manually.',
      });
    const authResponse = await fetch('https://api.sandbox.co.in/authenticate', {
      method: 'POST',
      headers: { 'x-api-key': key, 'x-api-secret': secret, 'x-api-version': '1.0.0' },
      signal: AbortSignal.timeout(12000),
    });
    const authData = await authResponse.json();
    if (!authResponse.ok || !authData.data?.access_token)
      return reply(502, {
        error: 'Sandbox authentication failed. Check the API credentials and plan.',
      });
    const response = await fetch('https://api.sandbox.co.in/gst/compliance/public/gstin/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        authorization: authData.data.access_token,
        'x-api-version': '1.0.0',
        'x-accept-cache': 'true',
      },
      body: JSON.stringify({ gstin }),
      signal: AbortSignal.timeout(12000),
    });
    const result = await response.json();
    const taxpayer = result.data?.data || result.data;
    if (!response.ok || taxpayer?.gstin !== gstin || !taxpayer?.lgnm)
      return reply(502, {
        error:
          'GST details could not be retrieved. Check the GSTIN and Sandbox plan, or enter details manually.',
      });
    const addr = taxpayer.pradr?.addr || {};
    const address = [
      ...new Set(
        [addr.bno, addr.flno, addr.bnm, addr.st, addr.loc, addr.dst, addr.stcd, addr.pncd].filter(
          (v) => typeof v === 'string' && v.trim(),
        ),
      ),
    ].join(', ');
    return reply(200, {
      gstin,
      name: taxpayer.tradeNam || taxpayer.lgnm,
      address,
      state: gstin.slice(0, 2),
      status: taxpayer.sts || '',
    });
  } catch {
    return reply(502, {
      error:
        'GST lookup is temporarily unavailable. Please retry or enter customer details manually.',
    });
  }
}

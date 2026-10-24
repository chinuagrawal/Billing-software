// Test the exact JavaScript deployed to Vercel without Vite/TypeScript resolution.
// No credentials or database mutations are used.
import { createRequire } from 'node:module';
import { generateKeyPairSync, sign, verify } from 'node:crypto';
import assert from 'node:assert/strict';

// Verify the jwks-rsa/jose compatibility override against a real ephemeral RSA
// key, without contacting Firebase or an external key endpoint.
const require = createRequire(import.meta.url);
const jwks = require('jwks-rsa');
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const client = jwks({ jwksUri: 'https://invalid.example/jwks', cache: false, rateLimit: false });
client.getKeys = async () => [
  { ...publicKey.export({ format: 'jwk' }), kid: 'runtime-test', alg: 'RS256', use: 'sig' },
];
const key = await client.getSigningKey('runtime-test');
const payload = Buffer.from('billing-runtime-compatibility-check');
assert(verify('RSA-SHA256', payload, key.getPublicKey(), sign('RSA-SHA256', payload, privateKey)));
console.log('JWKS key conversion and RSA verification OK');
for (const route of ['command', 'account']) {
  const { default: handler } = await import(`../api/${route}.js`);
  for (const [method, expected] of [
    ['GET', 405],
    ['POST', 401],
  ]) {
    const response = { statusCode: 200, setHeader() {}, end() {} };
    await handler({ method, headers: {} }, response);
    if (response.statusCode !== expected)
      throw new Error(`${route}: expected ${expected}, received ${response.statusCode}`);
  }
  console.log(`Native Node runtime OK: /api/${route}`);
}

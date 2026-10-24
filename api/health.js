// Dependency-free deployment probe; no credentials or business data are returned.
export default async function handler(_request, response) {
  const dependencies = {};
  for (const [name, load] of [
    ['firebase-app', () => import('firebase-admin/app')],
    ['firebase-auth', () => import('firebase-admin/auth')],
    ['firebase-firestore', () => import('firebase-admin/firestore')],
    ['validation', () => import('zod')],
  ]) {
    try { await load(); dependencies[name] = { ok: true }; }
    catch (error) { dependencies[name] = { ok: false, code: error.code || error.name, message: String(error.message).slice(0, 400) }; }
  }
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Cache-Control', 'no-store');
  response.statusCode = 200;
  response.end(JSON.stringify({ ok: Object.values(dependencies).every((check) => check.ok), service: 'billing-api', dependencies }));
}

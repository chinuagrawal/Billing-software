// Dependency-free deployment probe; no credentials or business data are returned.
export default function handler(_request, response) {
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Cache-Control', 'no-store');
  response.statusCode = 200;
  response.end(JSON.stringify({ ok: true, service: 'billing-api' }));
}

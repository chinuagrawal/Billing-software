// Test the exact JavaScript deployed to Vercel without Vite/TypeScript resolution.
// No credentials or database mutations are used.
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

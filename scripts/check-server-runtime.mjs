import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// Exercise emitted modules in native Node, without Vite's import resolution.
// Only unauthenticated requests are used; this never mutates Firebase data.
const cache = resolve('node_modules/.cache');
await mkdir(cache, { recursive: true });
const output = await mkdtemp(join(cache, 'billing-runtime-'));
try {
  await writeFile(join(output, 'package.json'), '{"type":"module"}');
  for (const source of [
    'api/command.ts',
    'api/account.ts',
    'server/schema.ts',
    'server/commands.ts',
    'server/account.ts',
    'src/lib/billing.ts',
    'src/lib/seed.ts',
  ]) {
    const file = join(output, source.replace(/\.ts$/, '.js'));
    await mkdir(dirname(file), { recursive: true });
    const result = ts.transpileModule(await readFile(source, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    });
    await writeFile(file, result.outputText);
  }
  for (const route of ['command', 'account']) {
    const { default: handler } = await import(
      pathToFileURL(join(output, 'api', `${route}.js`)).href
    );
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
} finally {
  const target = resolve(output);
  const withinCache = relative(cache, target);
  if (!withinCache || withinCache.startsWith('..') || isAbsolute(withinCache))
    throw new Error('Invalid cleanup path');
  await rm(target, { recursive: true, force: true });
}

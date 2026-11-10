import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

/** Native workerd + SQLite D1, isolated per call. Never loads Wrangler or env files. */
export async function createWorkerTestRuntime({
  registrationPassphrase = 'test-invite',
} = {}) {
  const compiled = await build({
    absWorkingDir: projectRoot,
    entryPoints: ['worker/index.ts'],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    logLevel: 'silent',
  });
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: compiled.outputFiles[0].text,
      compatibilityDate: '2024-12-05',
      d1Databases: { DB: 'gymmiie-tests' },
      bindings:
        registrationPassphrase === undefined || registrationPassphrase === null
          ? {}
          : { REGISTRATION_PASSPHRASE: registrationPassphrase },
      telemetry: { enabled: false },
      serviceBindings: {
        ASSETS: () =>
          new Response('Test assets are served by the Node test server.', {
            status: 404,
          }),
      },
    }),
  );
  try {
    const db = await mf.getD1Database('DB');
    const directory = new URL('../migrations/', import.meta.url);
    for (const file of (await readdir(directory))
      .filter((name) => name.endsWith('.sql'))
      .sort()) {
      // The checked-in migrations contain simple statements, with no SQL triggers.
      const sql = (await readFile(new URL(file, directory), 'utf8')).replace(
        /--[^\n]*/g,
        '',
      );
      // D1.exec treats each newline as one statement. Our migrations have no
      // semicolons inside string literals or triggers; retain statement order.
      await db.exec(
        sql
          .split(';')
          .map((statement) => statement.replace(/\s+/g, ' ').trim())
          .filter(Boolean)
          .join('\n'),
      );
    }
    return { mf, db, dispose: () => mf.dispose() };
  } catch (error) {
    await mf.dispose();
    throw error;
  }
}

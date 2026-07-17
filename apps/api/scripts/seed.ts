import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createPool } from '../src/db/pool.js';
import { defaultMigrationsDir } from '../src/db/migrate.js';

async function main(): Promise<void> {
  const seedPath = path.resolve(defaultMigrationsDir(), '../seed/dev-seed.sql');
  const pool = createPool();
  try {
    await pool.query(await readFile(seedPath, 'utf8'));
    console.log('Dev seed applied');
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

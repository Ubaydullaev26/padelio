import { createPool } from '../src/db/pool.js';
import { defaultMigrationsDir, runMigrations } from '../src/db/migrate.js';

async function main(): Promise<void> {
  const pool = createPool();
  try {
    const applied = await runMigrations(pool, defaultMigrationsDir());
    console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Nothing to migrate');
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

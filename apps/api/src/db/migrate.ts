import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Pool } from 'pg';

/**
 * Минималистичный migration runner: применяет infra/migrations/*.sql по порядку имён,
 * каждый файл — в отдельной транзакции, учёт в schema_migrations.
 * Advisory lock защищает от параллельного запуска (несколько инстансов API на деплое).
 */
const MIGRATIONS_LOCK_KEY = 7264331; // произвольная константа проекта

export async function runMigrations(pool: Pool, migrationsDir: string): Promise<string[]> {
  const applied: string[] = [];
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATIONS_LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`);

    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
    const done = new Set(
      (await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name as string),
    );

    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await readFile(path.join(migrationsDir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        applied.push(file);
      } catch (e) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${(e as Error).message}`, { cause: e });
      }
    }
    return applied;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATIONS_LOCK_KEY]);
    client.release();
  }
}

/** Ищет infra/migrations вверх от текущего каталога (работает из любого пакета монорепо). */
export function defaultMigrationsDir(startDir = process.cwd()): string {
  let dir = startDir;
  for (;;) {
    const candidate = path.join(dir, 'infra', 'migrations');
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error(`infra/migrations not found upward from ${startDir}`);
    dir = parent;
  }
}

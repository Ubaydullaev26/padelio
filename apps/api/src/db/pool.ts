import { Pool } from 'pg';

export function createPool(connectionString = process.env.DATABASE_URL): Pool {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set (see .env.example)');
  }
  return new Pool({ connectionString, max: 10 });
}

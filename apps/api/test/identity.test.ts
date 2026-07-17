import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { createPool } from '../src/db/pool.js';
import { defaultMigrationsDir, runMigrations } from '../src/db/migrate.js';
import {
  buildInitData,
  verifyTelegramInitData,
  InvalidInitDataError,
} from '../src/identity/initdata.js';
import { IdentityService } from '../src/identity/identity.service.js';

const BOT_TOKEN = '1234567890:TEST-FAKE-TOKEN-FOR-SIGNATURES';
const DB_URL = process.env.DATABASE_URL ?? 'postgres://padelio:padelio@localhost:5432/padelio';

describe('verifyTelegramInitData (чистая криптография, без БД)', () => {
  const tgUser = { id: 42, first_name: 'Тимур', username: 'timur', language_code: 'ru' };

  it('валидная подпись проходит и парсит пользователя', () => {
    const initData = buildInitData(BOT_TOKEN, tgUser, new Date(), { start_param: 'club_abc' });
    const verified = verifyTelegramInitData(initData, BOT_TOKEN);
    expect(verified.user.id).toBe(42);
    expect(verified.user.first_name).toBe('Тимур');
    expect(verified.startParam).toBe('club_abc');
  });

  it('подделка данных после подписи отклоняется', () => {
    const initData = buildInitData(BOT_TOKEN, tgUser);
    const tampered = initData.replace(encodeURIComponent('Тимур'), encodeURIComponent('Hacker'));
    expect(() => verifyTelegramInitData(tampered, BOT_TOKEN)).toThrow(InvalidInitDataError);
  });

  it('подпись чужим bot_token отклоняется', () => {
    const initData = buildInitData('999:OTHER-TOKEN', tgUser);
    expect(() => verifyTelegramInitData(initData, BOT_TOKEN)).toThrow(InvalidInitDataError);
  });

  it('просроченная initData (старше 24 ч) отклоняется — анти-replay', () => {
    const old = new Date(Date.now() - 25 * 3600 * 1000);
    const initData = buildInitData(BOT_TOKEN, tgUser, old);
    expect(() => verifyTelegramInitData(initData, BOT_TOKEN)).toThrow(/expired/);
  });
});

describe('IdentityService (upsert + JWT, с БД)', () => {
  let pool: Pool;
  let identity: IdentityService;

  beforeAll(async () => {
    pool = createPool(DB_URL);
    await runMigrations(pool, defaultMigrationsDir());
    identity = new IdentityService(pool, { botToken: BOT_TOKEN, jwtSecret: 'test-secret' });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('первый вход создаёт пользователя, повторный — обновляет, не дублируя', async () => {
    const tgId = Math.floor(Math.random() * 1e12);
    const first = await identity.authenticateTelegram(
      buildInitData(BOT_TOKEN, { id: tgId, first_name: 'Malika', language_code: 'uz' }),
    );
    expect(first.user.language).toBe('uz');
    expect(first.user.referralCode).toBeTruthy();

    const second = await identity.authenticateTelegram(
      buildInitData(BOT_TOKEN, { id: tgId, first_name: 'Malika', username: 'malika_new' }),
    );
    expect(second.user.id).toBe(first.user.id); // тот же аккаунт
    expect(second.user.username).toBe('malika_new'); // профиль обновился

    const { rows } = await pool.query('SELECT count(*)::int AS n FROM users WHERE telegram_id = $1', [tgId]);
    expect(rows[0].n).toBe(1);
  });

  it('выданный JWT проходит verifySession и содержит id пользователя', async () => {
    const tgId = Math.floor(Math.random() * 1e12);
    const auth = await identity.authenticateTelegram(
      buildInitData(BOT_TOKEN, { id: tgId, first_name: 'Test' }),
    );
    expect(identity.verifySession(auth.token).userId).toBe(auth.user.id);
    expect(() => identity.verifySession(auth.token + 'x')).toThrow();
  });

  it('битая initData не создаёт пользователя', async () => {
    await expect(identity.authenticateTelegram(`fake=1&hash=${randomUUID()}`)).rejects.toThrow(
      InvalidInitDataError,
    );
  });
});

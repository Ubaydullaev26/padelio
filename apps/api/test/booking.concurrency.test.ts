import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { createPool } from '../src/db/pool.js';
import { defaultMigrationsDir, runMigrations } from '../src/db/migrate.js';
import { BookingService } from '../src/booking/booking.service.js';
import { SlotUnavailableError } from '../src/booking/errors.js';

/**
 * Критерий готовности MVP (docs/10): double booking невозможен.
 * Тесты гоняются против РЕАЛЬНОГО Postgres (docker compose / CI service) —
 * проверяем EXCLUDE-констрейнт, а не мок.
 */

const DB_URL =
  process.env.DATABASE_URL ?? 'postgres://padelio:padelio@localhost:5432/padelio';

let pool: Pool;
let booking: BookingService;
let userId: string;
let clubId: string;

/** Каждый тест — на своём корте, чтобы не влиять друг на друга. */
async function createCourt(): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO courts (club_id, name) VALUES ($1, $2) RETURNING id`,
    [clubId, `Test court ${randomUUID().slice(0, 8)}`],
  );
  return rows[0]!.id;
}

function slot(hoursFromNow: number, durationMin = 90): { startsAt: Date; endsAt: Date } {
  const startsAt = new Date(Date.now() + hoursFromNow * 3_600_000);
  return { startsAt, endsAt: new Date(startsAt.getTime() + durationMin * 60_000) };
}

beforeAll(async () => {
  pool = createPool(DB_URL);
  await runMigrations(pool, defaultMigrationsDir());
  booking = new BookingService(pool);

  const city = await pool.query<{ id: string }>(
    `INSERT INTO cities (name) VALUES ('Test City') RETURNING id`,
  );
  const club = await pool.query<{ id: string }>(
    `INSERT INTO clubs (city_id, name, slug, status)
     VALUES ($1, 'Test Club', $2, 'active') RETURNING id`,
    [city.rows[0]!.id, `test-club-${randomUUID().slice(0, 8)}`],
  );
  clubId = club.rows[0]!.id;
  const user = await pool.query<{ id: string }>(
    `INSERT INTO users (telegram_id, first_name) VALUES ($1, 'Tester') RETURNING id`,
    [Math.floor(Math.random() * 1e12)],
  );
  userId = user.rows[0]!.id;
});

afterAll(async () => {
  await pool.end();
});

describe('анти-double-booking (EXCLUDE-констрейнт)', () => {
  it('из 100 конкурентных попыток на один слот побеждает ровно одна', async () => {
    const courtId = await createCourt();
    const { startsAt, endsAt } = slot(24);

    const attempts = Array.from({ length: 100 }, (_, i) =>
      booking.createHold({
        courtId,
        userId,
        startsAt,
        endsAt,
        priceTotal: 30_000_000n,
        idempotencyKey: `race-${courtId}-${i}`,
      }),
    );
    const results = await Promise.allSettled(attempts);

    const won = results.filter((r) => r.status === 'fulfilled');
    const lost = results.filter((r) => r.status === 'rejected');

    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(99);
    for (const r of lost) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(SlotUnavailableError);
    }

    // В БД — ровно одна активная бронь на этот интервал
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM reservations
        WHERE court_id = $1 AND status = 'hold'`,
      [courtId],
    );
    expect(rows[0].n).toBe(1);
  });

  it('пересекающийся интервал отклоняется, смежный — проходит (полуоткрытые интервалы)', async () => {
    const courtId = await createCourt();
    const { startsAt, endsAt } = slot(30, 60); // 60 минут

    await booking.createHold({
      courtId, userId, startsAt, endsAt,
      priceTotal: 20_000_000n, idempotencyKey: `base-${courtId}`,
    });

    // Пересечение (сдвиг на 30 минут внутрь) → отказ
    await expect(
      booking.createHold({
        courtId, userId,
        startsAt: new Date(startsAt.getTime() + 30 * 60_000),
        endsAt: new Date(endsAt.getTime() + 30 * 60_000),
        priceTotal: 20_000_000n, idempotencyKey: `overlap-${courtId}`,
      }),
    ).rejects.toBeInstanceOf(SlotUnavailableError);

    // Смежный слот: начинается ровно в конец предыдущего → успех ('[)' -интервалы)
    const adjacent = await booking.createHold({
      courtId, userId,
      startsAt: endsAt,
      endsAt: new Date(endsAt.getTime() + 60 * 60_000),
      priceTotal: 20_000_000n, idempotencyKey: `adjacent-${courtId}`,
    });
    expect(adjacent.status).toBe('hold');
  });

  it('тот же слот на ДРУГОМ корте бронируется свободно', async () => {
    const courtA = await createCourt();
    const courtB = await createCourt();
    const { startsAt, endsAt } = slot(36);

    const a = await booking.createHold({
      courtId: courtA, userId, startsAt, endsAt,
      priceTotal: 20_000_000n, idempotencyKey: `court-a-${courtA}`,
    });
    const b = await booking.createHold({
      courtId: courtB, userId, startsAt, endsAt,
      priceTotal: 20_000_000n, idempotencyKey: `court-b-${courtB}`,
    });
    expect(a.status).toBe('hold');
    expect(b.status).toBe('hold');
  });
});

describe('идемпотентность (E5 из docs/04)', () => {
  it('повтор запроса с тем же idempotency_key возвращает ту же бронь, а не дубль', async () => {
    const courtId = await createCourt();
    const { startsAt, endsAt } = slot(48);
    const key = `idem-${courtId}`;

    const first = await booking.createHold({
      courtId, userId, startsAt, endsAt, priceTotal: 30_000_000n, idempotencyKey: key,
    });
    const retry = await booking.createHold({
      courtId, userId, startsAt, endsAt, priceTotal: 30_000_000n, idempotencyKey: key,
    });

    expect(retry.id).toBe(first.id);
  });
});

describe('жизненный цикл hold', () => {
  it('истёкший hold освобождает слот для следующего игрока', async () => {
    const courtId = await createCourt();
    const { startsAt, endsAt } = slot(60);

    const held = await booking.createHold({
      courtId, userId, startsAt, endsAt,
      priceTotal: 30_000_000n, idempotencyKey: `expire-${courtId}`,
    });

    // Симулируем истечение 10 минут
    await pool.query(`UPDATE reservations SET hold_expires_at = now() - interval '1 second' WHERE id = $1`, [held.id]);
    const expired = await booking.expireHolds();
    expect(expired).toBeGreaterThanOrEqual(1);
    expect((await booking.getById(held.id))?.status).toBe('expired');

    // Слот снова свободен — лист ожидания / другой игрок может забрать
    const next = await booking.createHold({
      courtId, userId, startsAt, endsAt,
      priceTotal: 30_000_000n, idempotencyKey: `after-expire-${courtId}`,
    });
    expect(next.status).toBe('hold');
  });

  it('подтверждение оплаты переводит hold → confirmed и пишет событие', async () => {
    const courtId = await createCourt();
    const { startsAt, endsAt } = slot(72);

    const held = await booking.createHold({
      courtId, userId, startsAt, endsAt,
      priceTotal: 30_000_000n, idempotencyKey: `confirm-${courtId}`,
    });
    const confirmed = await booking.confirm(held.id, null);
    expect(confirmed.status).toBe('confirmed');

    const { rows } = await pool.query(
      `SELECT event FROM reservation_events WHERE reservation_id = $1 ORDER BY id`,
      [held.id],
    );
    expect(rows.map((r) => r.event)).toEqual(['hold_created', 'confirmed']);
  });
});

import type { Pool, PoolClient } from 'pg';
import { canTransition, DEFAULT_HOLD_MINUTES, type ReservationStatus } from '@padelio/shared';
import {
  CourtNotFoundError,
  InvalidSlotError,
  InvalidTransitionError,
  SlotUnavailableError,
} from './errors.js';

export interface CreateHoldInput {
  courtId: string;
  userId: string;
  startsAt: Date;
  endsAt: Date;
  /** Тийины. Расчёт цены по тарифам — отдельный модуль (Sprint 2); здесь принимаем готовую. */
  priceTotal: bigint;
  idempotencyKey: string;
}

export interface Reservation {
  id: string;
  courtId: string;
  clubId: string;
  userId: string | null;
  startsAt: Date;
  endsAt: Date;
  status: ReservationStatus;
  holdExpiresAt: Date | null;
  priceTotal: bigint;
}

interface ReservationRow {
  id: string;
  court_id: string;
  club_id: string;
  user_id: string | null;
  starts_at: Date;
  ends_at: Date;
  status: ReservationStatus;
  hold_expires_at: Date | null;
  price_total: string;
}

function mapRow(row: ReservationRow): Reservation {
  return {
    id: row.id,
    courtId: row.court_id,
    clubId: row.club_id,
    userId: row.user_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    holdExpiresAt: row.hold_expires_at,
    priceTotal: BigInt(row.price_total),
  };
}

function pgErrorCode(e: unknown): { code?: string; constraint?: string } {
  const err = e as { code?: string; constraint?: string };
  return { code: err.code, constraint: err.constraint };
}

/**
 * Ядро бронирования. Инварианты (docs/05 §1, docs/08 ADR-3):
 * - double booking невозможен: EXCLUDE-констрейнт БД, а не логика приложения;
 * - все операции идемпотентны по idempotency_key;
 * - каждое изменение статуса пишет событие в reservation_events (append-only).
 */
export class BookingService {
  constructor(
    private readonly pool: Pool,
    private readonly holdMinutes: number = DEFAULT_HOLD_MINUTES,
  ) {}

  /** Шаг 1 оформления: эксклюзивное удержание слота на время оплаты. */
  async createHold(input: CreateHoldInput): Promise<Reservation> {
    if (input.startsAt >= input.endsAt) throw new InvalidSlotError();

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query<ReservationRow>(
        `WITH court AS (
           SELECT id, club_id FROM courts WHERE id = $1 AND status = 'active'
         )
         INSERT INTO reservations
           (court_id, club_id, user_id, starts_at, ends_at, status,
            hold_expires_at, price_total, price_court, source, idempotency_key)
         SELECT court.id, court.club_id, $2, $3, $4, 'hold',
                now() + make_interval(mins => $5), $6, $6, 'miniapp', $7
         FROM court
         RETURNING *`,
        [
          input.courtId,
          input.userId,
          input.startsAt,
          input.endsAt,
          this.holdMinutes,
          input.priceTotal.toString(),
          input.idempotencyKey,
        ],
      );

      const row = inserted.rows[0];
      if (!row) {
        await client.query('ROLLBACK');
        throw new CourtNotFoundError();
      }
      await this.appendEvent(client, row.id, 'hold_created', 'user', input.userId, {
        holdMinutes: this.holdMinutes,
      });
      await client.query('COMMIT');
      return mapRow(row);
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      const { code, constraint } = pgErrorCode(e);
      // 23P01 exclusion_violation — слот занят конкурентом. Единственный штатный отказ.
      if (code === '23P01' && constraint === 'reservations_no_overlap') {
        throw new SlotUnavailableError();
      }
      // 23505 на idempotency_key — повтор того же запроса: возвращаем исходную бронь.
      if (code === '23505' && constraint === 'reservations_idempotency_key_key') {
        const existing = await this.findByIdempotencyKey(input.idempotencyKey);
        if (existing) return existing;
      }
      throw e;
    } finally {
      client.release();
    }
  }

  /** Подтверждение после успешной онлайн-оплаты (вызовется из модуля payments). */
  async confirm(reservationId: string, actorId: string | null): Promise<Reservation> {
    return this.transition(reservationId, 'confirmed', 'system', actorId, {
      payment_method: 'online',
    });
  }

  /**
   * Освобождение просроченных hold — вызывается фоновым джобом (BullMQ, Sprint 2)
   * каждые ~30 секунд. Возвращает количество освобождённых слотов.
   */
  async expireHolds(): Promise<number> {
    const result = await this.pool.query<{ id: string }>(
      `WITH expired AS (
         UPDATE reservations
            SET status = 'expired', updated_at = now()
          WHERE status = 'hold' AND hold_expires_at < now()
      RETURNING id
       )
       INSERT INTO reservation_events (reservation_id, event, actor_type, payload)
       SELECT id, 'hold_expired', 'system', '{}'::jsonb FROM expired
       RETURNING reservation_id AS id`,
    );
    return result.rowCount ?? 0;
  }

  async getById(id: string): Promise<Reservation | null> {
    const { rows } = await this.pool.query<ReservationRow>(
      'SELECT * FROM reservations WHERE id = $1',
      [id],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  private async findByIdempotencyKey(key: string): Promise<Reservation | null> {
    const { rows } = await this.pool.query<ReservationRow>(
      'SELECT * FROM reservations WHERE idempotency_key = $1',
      [key],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }

  /** Переход конечного автомата с проверкой допустимости (docs/04 §10). */
  private async transition(
    reservationId: string,
    to: ReservationStatus,
    actorType: 'user' | 'club' | 'system' | 'support',
    actorId: string | null,
    extra: Record<string, string> = {},
  ): Promise<Reservation> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query<ReservationRow>(
        'SELECT * FROM reservations WHERE id = $1 FOR UPDATE',
        [reservationId],
      );
      const row = current.rows[0];
      if (!row) throw new CourtNotFoundError('Reservation not found');
      if (!canTransition(row.status, to)) throw new InvalidTransitionError(row.status, to);

      const updated = await client.query<ReservationRow>(
        `UPDATE reservations
            SET status = $2,
                payment_method = COALESCE($3::payment_method, payment_method),
                updated_at = now()
          WHERE id = $1
      RETURNING *`,
        [reservationId, to, extra.payment_method ?? null],
      );
      await this.appendEvent(client, reservationId, to, actorType, actorId, {});
      await client.query('COMMIT');
      return mapRow(updated.rows[0]!);
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  }

  private async appendEvent(
    client: PoolClient,
    reservationId: string,
    event: string,
    actorType: 'user' | 'club' | 'system' | 'support',
    actorId: string | null,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await client.query(
      `INSERT INTO reservation_events (reservation_id, event, actor_type, actor_id, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [reservationId, event, actorType, actorId, JSON.stringify(payload)],
    );
  }
}

/**
 * Статусы брони — единый словарь домена (docs/04 §10, docs/09).
 * Диаграмма переходов: docs/04-user-flows.md, раздел 10.
 */
export const RESERVATION_STATUSES = [
  'hold',
  'pending_club',
  'confirmed',
  'checked_in',
  'completed',
  'cancelled_user',
  'cancelled_club',
  'no_show',
  'expired',
  'rejected',
] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/**
 * Активные статусы занимают слот: участвуют в EXCLUDE-констрейнте БД.
 * Должны совпадать со списком в infra/migrations/0001_core.sql.
 */
export const ACTIVE_RESERVATION_STATUSES = [
  'hold',
  'pending_club',
  'confirmed',
  'checked_in',
] as const satisfies readonly ReservationStatus[];

/** Разрешённые переходы конечного автомата брони. */
export const RESERVATION_TRANSITIONS: Record<ReservationStatus, readonly ReservationStatus[]> = {
  hold: ['confirmed', 'pending_club', 'expired'],
  pending_club: ['confirmed', 'rejected', 'cancelled_user'],
  confirmed: ['checked_in', 'cancelled_user', 'cancelled_club', 'no_show'],
  checked_in: ['completed'],
  completed: [],
  cancelled_user: [],
  cancelled_club: [],
  no_show: [],
  expired: [],
  rejected: [],
};

export function canTransition(from: ReservationStatus, to: ReservationStatus): boolean {
  return RESERVATION_TRANSITIONS[from].includes(to);
}

export const DEFAULT_HOLD_MINUTES = 10;

export const SLOT_DURATIONS_MIN = [60, 90, 120] as const;

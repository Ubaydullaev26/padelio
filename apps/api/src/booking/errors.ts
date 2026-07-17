/** Слот пересекается с активной бронью — единственный «нормальный» отказ конкуренции. */
export class SlotUnavailableError extends Error {
  constructor(message = 'Slot is already taken') {
    super(message);
    this.name = 'SlotUnavailableError';
  }
}

export class InvalidSlotError extends Error {
  constructor(message = 'Invalid slot interval') {
    super(message);
    this.name = 'InvalidSlotError';
  }
}

export class CourtNotFoundError extends Error {
  constructor(message = 'Court not found or inactive') {
    super(message);
    this.name = 'CourtNotFoundError';
  }
}

export class InvalidTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Invalid reservation transition: ${from} -> ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

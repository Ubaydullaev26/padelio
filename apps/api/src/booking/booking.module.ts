import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { createPool } from '../db/pool.js';
import { BookingService } from './booking.service.js';

/**
 * Ядро BookingService — фреймворк-независимый класс (тестируется без Nest),
 * модуль лишь связывает его с DI-контейнером.
 */
@Module({
  providers: [
    { provide: Pool, useFactory: () => createPool() },
    { provide: BookingService, useFactory: (pool: Pool) => new BookingService(pool), inject: [Pool] },
  ],
  exports: [BookingService],
})
export class BookingModule {}

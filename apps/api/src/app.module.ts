import { Module } from '@nestjs/common';
import { BookingModule } from './booking/booking.module.js';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [BookingModule],
  controllers: [HealthController],
})
export class AppModule {}

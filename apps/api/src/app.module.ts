import { Module } from '@nestjs/common';
import { BookingModule } from './booking/booking.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { IdentityModule } from './identity/identity.module.js';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [BookingModule, CatalogModule, IdentityModule],
  controllers: [HealthController],
})
export class AppModule {}

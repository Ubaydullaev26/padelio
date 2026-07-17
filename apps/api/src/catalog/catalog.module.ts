import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { createPool } from '../db/pool.js';
import { CatalogService } from './catalog.service.js';
import { CatalogController } from './catalog.controller.js';

@Module({
  providers: [
    { provide: Pool, useFactory: () => createPool() },
    { provide: CatalogService, useFactory: (pool: Pool) => new CatalogService(pool), inject: [Pool] },
  ],
  controllers: [CatalogController],
})
export class CatalogModule {}

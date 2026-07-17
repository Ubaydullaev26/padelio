import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { createPool } from '../db/pool.js';
import { IdentityService } from './identity.service.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';

function identityConfigFromEnv() {
  const botToken = process.env.BOT_TOKEN ?? '';
  const jwtSecret = process.env.JWT_SECRET ?? '';
  if (!jwtSecret) {
    if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is required');
    console.warn('JWT_SECRET is not set — using insecure dev secret');
  }
  return { botToken, jwtSecret: jwtSecret || 'dev-insecure-secret' };
}

@Module({
  providers: [
    { provide: Pool, useFactory: () => createPool() },
    {
      provide: IdentityService,
      useFactory: (pool: Pool) => new IdentityService(pool, identityConfigFromEnv()),
      inject: [Pool],
    },
    AuthGuard,
  ],
  controllers: [AuthController],
  exports: [IdentityService, AuthGuard],
})
export class IdentityModule {}

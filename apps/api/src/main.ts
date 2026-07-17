import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env.CORS_ORIGIN?.split(',') ?? true });
  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port);
  console.log(`Padelio API listening on :${port}`);
}

void bootstrap();

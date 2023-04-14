import { NestFactory } from '@nestjs/core';
import cors from 'cors';
import express from 'express'
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(express.json({ limit: process.env.NC_REQUEST_BODY_SIZE || '50mb' }));
  app.use(
    cors({
      exposedHeaders: 'xc-db-response',
    }),
  );
  await app.listen(8080);
}
bootstrap();

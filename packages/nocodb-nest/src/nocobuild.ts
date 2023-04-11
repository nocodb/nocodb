import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import express from 'express';

export default async function (app = express()) {
  const nestApp = await NestFactory.create(AppModule);
  await nestApp.init();

  app.use(nestApp.getHttpAdapter().getInstance());

  return app;
}

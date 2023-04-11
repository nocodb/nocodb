import { NestFactory } from '@nestjs/core';
import express from 'express';
import { AppModule } from './app.module';

export default async function (app = express()) {
  const nestApp = await NestFactory.create(AppModule);
  await nestApp.init();

  app.use(nestApp.getHttpAdapter().getInstance());

  return app;
}

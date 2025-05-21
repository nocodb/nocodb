import { NestFactory } from '@nestjs/core';
import { serverConfig } from 'config';
import express from 'express';
import { AppModule } from '~/app.module';

export default async function (app) {
  if (!app) app = express();
  const nestApp = await NestFactory.create(AppModule);
  await nestApp.init();

  const dashboardPath = serverConfig.dashboardUrl;
  app.get('/', (_req, res) => res.redirect(dashboardPath));
  app.use(nestApp.getHttpAdapter().getInstance());

  return app;
}

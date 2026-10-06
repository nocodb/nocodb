import { NestFactory } from '@nestjs/core';
import express from 'express';
import { AppModule } from '~/app.module';

export default async function (app) {
  if (!app) app = express();
  // Only the unit tests boot through here. Nest's default logger prints every level, so a run
  // was mostly route mapping and per-minute workflow debug lines; Noco.init() (prod) logs at info.
  const nestApp = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });
  await nestApp.init();

  const dashboardPath = process.env.NC_DASHBOARD_URL ?? '/';
  if (dashboardPath !== '/') {
    app.get('/', (_req, res) => res.redirect(dashboardPath));
  }
  app.use(nestApp.getHttpAdapter().getInstance());

  return { app, nestApp };
}

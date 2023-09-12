import { NestFactory } from '@nestjs/core';
import express from 'express';
import NcToolGui from 'nc-lib-gui';
import { AppModule } from '~/app.module';

export default async function (app) {
  if (!app) app = express();
  const nestApp = await NestFactory.create(AppModule);
  await nestApp.init();

  const dashboardPath = process.env.NC_DASHBOARD_URL ?? '/dashboard';
  app.use(NcToolGui.expressMiddleware(dashboardPath));
  app.get('/', (_req, res) => res.redirect(dashboardPath));
  app.use(nestApp.getHttpAdapter().getInstance());

  return app;
}

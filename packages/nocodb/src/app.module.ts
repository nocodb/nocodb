import { Module, RequestMethod } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
// @ts-ignore
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule as NestJsEventEmitter } from '@nestjs/event-emitter';
import { SentryModule } from '@ntegral/nestjs-sentry';
import type { MiddlewareConsumer } from '@nestjs/common';
import { NocoModule } from '~/modules/noco.module';
import { AuthModule } from '~/modules/auth/auth.module';
import { GlobalExceptionFilter } from '~/filters/global-exception/global-exception.filter';
import { GlobalMiddleware } from '~/middlewares/global/global.middleware';
import { GuiMiddleware } from '~/middlewares/gui/gui.middleware';
import { EventEmitterModule } from '~/modules/event-emitter/event-emitter.module';
import { JobsModule } from '~/modules/jobs/jobs.module';

import appConfig from '~/app.config';
import { ExtractIdsMiddleware } from '~/middlewares/extract-ids/extract-ids.middleware';

import { packageInfo } from '~/utils/packageVersion';

export const ceModuleConfig = {
  imports: [
    AuthModule,
    NocoModule,
    EventEmitterModule,
    JobsModule,
    NestJsEventEmitter.forRoot(),
    ConfigModule.forRoot({
      load: [() => appConfig],
      isGlobal: true,
    }),
    ...(process.env.NC_SENTRY_DSN
      ? [
          SentryModule.forRoot({
            dsn: process.env.NC_SENTRY_DSN,
            debug: false,
            environment: process.env.NODE_ENV,
            release: packageInfo.version, // must create a release in sentry.io dashboard
            logLevels: ['debug'], //based on sentry.io loglevel //
          }),
        ]
      : []),
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ExtractIdsMiddleware,
    },
  ],
};

@Module(ceModuleConfig)
export class AppModule {
  // Global Middleware
  configure(consumer: MiddlewareConsumer) {
    const dashboardPath = process.env.NC_DASHBOARD_URL ?? '/dashboard';
    consumer
      .apply(GuiMiddleware)
      .forRoutes({ path: `${dashboardPath}*`, method: RequestMethod.GET })
      .apply(GlobalMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}

import { Module, RequestMethod } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
// @ts-ignore
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule as NestJsEventEmitter } from '@nestjs/event-emitter';
import { SentryModule } from '@sentry/nestjs/setup';

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
import { RawBodyMiddleware } from '~/middlewares/raw-body.middleware';
import { JsonBodyMiddleware } from '~/middlewares/json-body.middleware';

import { UrlEncodeMiddleware } from '~/middlewares/url-encode.middleware';
import { OAuthModule } from '~/modules/oauth/oauth.module';
import { backendRouteExcludePatterns } from '~/utils/backend-route-prefixes';

export const ceModuleConfig = {
  imports: [
    AuthModule,
    OAuthModule,
    NocoModule,
    EventEmitterModule,
    JobsModule,
    NestJsEventEmitter.forRoot(),
    ConfigModule.forRoot({
      load: [() => appConfig],
      isGlobal: true,
    }),
    ...(process.env.NC_SENTRY_DSN ? [SentryModule.forRoot()] : []),
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
    GuiMiddleware,
  ],
};

@Module(ceModuleConfig)
export class AppModule {
  // Global Middleware
  configure(consumer: MiddlewareConsumer) {
    // GUI — serve frontend static files + SPA fallback (GET only, non-backend paths)
    consumer
      .apply(GuiMiddleware)
      .exclude(
        ...backendRouteExcludePatterns.map((path) => ({
          path,
          method: RequestMethod.ALL,
        })),
      )
      .forRoutes({ path: '*', method: RequestMethod.GET });

    consumer.apply(RawBodyMiddleware).forRoutes({
      path: '/api/payment/webhook',
      method: RequestMethod.POST,
    });

    consumer.apply(JsonBodyMiddleware).forRoutes('*');

    consumer.apply(UrlEncodeMiddleware).forRoutes('*');

    consumer
      .apply(GlobalMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}

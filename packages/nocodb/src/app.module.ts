import { Module, RequestMethod } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
// @ts-ignore
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule as NestJsEventEmitter } from '@nestjs/event-emitter';
import { SentryModule } from '@ntegral/nestjs-sentry';
import type { MiddlewareConsumer } from '@nestjs/common';
import { GlobalExceptionFilter } from '~/filters/global-exception/global-exception.filter';
import { GlobalMiddleware } from '~/middlewares/global/global.middleware';
import { GuiMiddleware } from '~/middlewares/gui/gui.middleware';
import { DatasModule } from '~/modules/datas/datas.module';
import { EventEmitterModule } from '~/modules/event-emitter/event-emitter.module';
import { AuthService } from '~/services/auth.service';
import { GlobalModule } from '~/modules/global/global.module';
import { LocalStrategy } from '~/strategies/local.strategy';
import { AuthTokenStrategy } from '~/strategies/authtoken.strategy/authtoken.strategy';
import { BaseViewStrategy } from '~/strategies/base-view.strategy/base-view.strategy';
import { MetasModule } from '~/modules/metas/metas.module';
import { JobsModule } from '~/modules/jobs/jobs.module';

import appConfig from '~/app.config';
import { ExtractIdsMiddleware } from '~/middlewares/extract-ids/extract-ids.middleware';

import { HookHandlerService } from '~/services/hook-handler.service';
import { BasicStrategy } from '~/strategies/basic.strategy/basic.strategy';
import { UsersModule } from '~/modules/users/users.module';
import { AuthModule } from '~/modules/auth/auth.module';
import { packageInfo } from '~/utils/packageVersion';

export const ceModuleConfig = {
  imports: [
    GlobalModule,
    UsersModule,
    AuthModule,
    MetasModule,
    DatasModule,
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
    AuthService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ExtractIdsMiddleware,
    },
    LocalStrategy,
    AuthTokenStrategy,
    BaseViewStrategy,
    HookHandlerService,
    BasicStrategy,
  ],
};

@Module(ceModuleConfig)
export class AppModule {
  // Global Middleware
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(GuiMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.GET })
      .apply(GlobalMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}

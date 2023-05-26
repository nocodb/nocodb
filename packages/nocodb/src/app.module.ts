import { Module, RequestMethod } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule as NestJsEventEmitter } from '@nestjs/event-emitter';
import { GlobalExceptionFilter } from './filters/global-exception/global-exception.filter';
import { GlobalMiddleware } from './middlewares/global/global.middleware';
import { GuiMiddleware } from './middlewares/gui/gui.middleware';
import { DatasModule } from './modules/datas/datas.module';
import { EventEmitterModule } from './modules/event-emitter/event-emitter.module';
import { AuthService } from './services/auth.service';
import { UsersModule } from './modules/users/users.module';
import { TestModule } from './modules/test/test.module';
import { GlobalModule } from './modules/global/global.module';
import { HookHandlerService } from './services/hook-handler.service';
import { LocalStrategy } from './strategies/local.strategy';
import { AuthTokenStrategy } from './strategies/authtoken.strategy/authtoken.strategy';
import { BaseViewStrategy } from './strategies/base-view.strategy/base-view.strategy';
import { MetasModule } from './modules/metas/metas.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { AppHooksListenerService } from './services/app-hooks-listener.service';
import { AppInitService } from './services/app-init.service';
import type { MiddlewareConsumer } from '@nestjs/common';

@Module({
  imports: [
    GlobalModule,
    UsersModule,
    ...(process.env['PLAYWRIGHT_TEST'] === 'true' ? [TestModule] : []),
    MetasModule,
    DatasModule,
    EventEmitterModule,
    JobsModule,
    NestJsEventEmitter.forRoot(),
    ...(process.env['NC_REDIS_URL']
      ? [
          BullModule.forRoot({
            redis: process.env.NC_REDIS_URL,
          }),
        ]
      : []),
    TestModule,
  ],
  controllers: [],
  providers: [
    AuthService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    LocalStrategy,
    AuthTokenStrategy,
    BaseViewStrategy,
    HookHandlerService,
    AppHooksListenerService,
    AppInitService,
  ],
})
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

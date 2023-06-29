import { Module, RequestMethod } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
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
import { LocalStrategy } from './strategies/local.strategy';
import { AuthTokenStrategy } from './strategies/authtoken.strategy/authtoken.strategy';
import { BaseViewStrategy } from './strategies/base-view.strategy/base-view.strategy';
import { MetasModule } from './modules/metas/metas.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { WorkspaceUsersModule } from './modules/workspace-users/workspace-users.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { ThrottlerConfigService } from './services/throttler/throttler-config.service';
import { CustomApiLimiterGuard } from './guards/custom-api-limiter.guard';

import appConfig from './app.config';
import { ExtractProjectAndWorkspaceIdMiddleware } from './middlewares/extract-project-and-workspace-id/extract-project-and-workspace-id.middleware';
import { ExecutionTimeCalculatorInterceptor } from './interceptors/execution-time-calculator/execution-time-calculator.interceptor';

import { HookHandlerService } from './services/hook-handler.service';
import type { MiddlewareConsumer } from '@nestjs/common';
import { BasicStrategy } from './strategies/basic.strategy/basic.strategy';

// todo: refactor to use config service
const enableThrottler = !!process.env['NC_THROTTLER_REDIS'];

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

    // todo:combine and move to meta module
    WorkspacesModule,
    WorkspaceUsersModule,
    ConfigModule.forRoot({
      load: [() => appConfig],
      isGlobal: true,
    }),
    ...(enableThrottler
      ? [
          ThrottlerModule.forRootAsync({
            useClass: ThrottlerConfigService,
            imports: [
              ConfigModule.forRoot({
                isGlobal: true,
                load: [() => appConfig],
              }),
            ],
          }),
        ]
      : []),
    TestModule,
  ],
  providers: [
    AuthService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: enableThrottler
        ? CustomApiLimiterGuard
        : ExtractProjectAndWorkspaceIdMiddleware,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ExecutionTimeCalculatorInterceptor,
    },
    LocalStrategy,
    AuthTokenStrategy,
    BaseViewStrategy,
    HookHandlerService,
    BasicStrategy,
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

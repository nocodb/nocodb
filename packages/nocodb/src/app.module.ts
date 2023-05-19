import { Inject, Module, RequestMethod } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { Connection } from './connection/connection';
import { GlobalExceptionFilter } from './filters/global-exception/global-exception.filter';
import NcPluginMgrv2 from './helpers/NcPluginMgrv2';
import { GlobalMiddleware } from './middlewares/global/global.middleware';
import { GuiMiddleware } from './middlewares/gui/gui.middleware';
import { PublicMiddleware } from './middlewares/public/public.middleware';
import { DatasModule } from './modules/datas/datas.module';
import { IEventEmitter } from './modules/event-emitter/event-emitter.interface';
import { EventEmitterModule } from './modules/event-emitter/event-emitter.module';
import { AuthService } from './services/auth.service';
import { UsersModule } from './modules/users/users.module';
import { MetaService } from './meta/meta.service';
import Noco from './Noco';
import { TestModule } from './modules/test/test.module';
import { GlobalModule } from './modules/global/global.module';
import { LocalStrategy } from './strategies/local.strategy';
import { AuthTokenStrategy } from './strategies/authtoken.strategy/authtoken.strategy';
import { BaseViewStrategy } from './strategies/base-view.strategy/base-view.strategy';
import NcConfigFactory from './utils/NcConfigFactory';
import NcUpgrader from './version-upgrader/NcUpgrader';
import { MetasModule } from './modules/metas/metas.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { WorkspaceUsersModule } from './modules/workspace-users/workspace-users.module';
import NocoCache from './cache/NocoCache';
import { ThrottlerConfigService } from './services/throttler/throttler-config.service';
import { CustomApiLimiterGuard } from './guards/custom-api-limiter.guard';

import appConfig from './app.config';
import { ExtractProjectAndWorkspaceIdMiddleware } from './middlewares/extract-project-and-workspace-id/extract-project-and-workspace-id.middleware';
import { ExecutionTimeCalculatorInterceptor } from './interceptors/execution-time-calculator/execution-time-calculator.interceptor';
import type {
  MiddlewareConsumer,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { AppHooksListenerService } from './services/app-hooks-listener.service';

// todo: refactor to use config service
const enableThrottler = !!process.env['NC_THROTTLER_REDIS'];

import { HookHandlerService } from './services/hook-handler.service';
import { TelemetryController } from './controllers/telemetry.controller';

@Module({
  imports: [
    GlobalModule,
    UsersModule,
    ...(process.env['PLAYWRIGHT_TEST'] === 'true' ? [TestModule] : []),
    MetasModule,
    DatasModule,
    TestModule,
    EventEmitterModule,

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
  ],
  controllers: [TelemetryController],
})
export class AppModule implements OnApplicationBootstrap {
  constructor(
    private readonly connection: Connection,
    private readonly metaService: MetaService,
    @Inject('IEventEmitter') private readonly eventEmitter: IEventEmitter,
  ) {}

  // Global Middleware
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(GuiMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.GET })
      .apply(PublicMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.GET })
      .apply(GlobalMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }

  // app init
  async onApplicationBootstrap(): Promise<void> {
    process.env.NC_VERSION = '0105004';

    await NocoCache.init();

    await this.connection.init();

    await NcConfigFactory.metaDbCreateIfNotExist(this.connection.config);

    await this.metaService.init();

    // todo: remove
    // temporary hack
    Noco._ncMeta = this.metaService;
    Noco.config = this.connection.config;
    Noco.eventEmitter = this.eventEmitter;

    // init plugin manager
    await NcPluginMgrv2.init(Noco.ncMeta);
    await Noco.loadEEState();

    // run upgrader
    await NcUpgrader.upgrade({ ncMeta: Noco._ncMeta });
  }
}

import { Injectable, Module, RequestMethod } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Connection } from './connection/connection';
import { GlobalExceptionFilter } from './filters/global-exception/global-exception.filter';
import NcPluginMgrv2 from './helpers/NcPluginMgrv2';
import { GlobalMiddleware } from './middlewares/global/global.middleware';
import { GuiMiddleware } from './middlewares/gui/gui.middleware';
import { PublicMiddleware } from './middlewares/public/public.middleware';
import { DatasModule } from './modules/datas/datas.module';
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
import { DocsModule } from './modules/docs/docs.module';
import { PublicDocsModule } from './modules/public-docs/public-docs.module';
import NocoCache from './cache/NocoCache';
import { ThrottlerConfigService } from './services/throttler-config/throttler-config.service';
import { CustomApiLimiterGuard } from './guards/custom-api-limiter.guard';

import appConfig from './app.config';
import type {
  MiddlewareConsumer,
  OnApplicationBootstrap,
} from '@nestjs/common';

// todo: refactor to use config service
const enableThrottler = !!process.env['NC_THROTTLER_REDIS'];

@Module({
  imports: [
    GlobalModule,
    UsersModule,
    ...(process.env['PLAYWRIGHT_TEST'] === 'true' ? [TestModule] : []),
    MetasModule,
    DatasModule,
    TestModule,

    // todo:combine and move to meta module
    WorkspacesModule,
    WorkspaceUsersModule,
    DocsModule,
    PublicDocsModule,
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
  ],
  providers: [
    AuthService,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    ...(enableThrottler
      ? [
          {
            provide: APP_GUARD,
            useClass: CustomApiLimiterGuard,
          },
        ]
      : []),
    LocalStrategy,
    AuthTokenStrategy,
    BaseViewStrategy,
  ],
})
export class AppModule implements OnApplicationBootstrap {
  constructor(
    private readonly connection: Connection,
    private readonly metaService: MetaService,
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

    // init plugin manager
    await NcPluginMgrv2.init(Noco.ncMeta);
    await Noco.loadEEState();

    // run upgrader
    await NcUpgrader.upgrade({ ncMeta: Noco._ncMeta });
  }
}

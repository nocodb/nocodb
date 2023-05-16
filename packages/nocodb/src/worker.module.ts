import { Inject, Module, RequestMethod } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule as NestJsEventEmitter } from '@nestjs/event-emitter';
import { Connection } from './connection/connection';
import { GlobalExceptionFilter } from './filters/global-exception/global-exception.filter';
import NcPluginMgrv2 from './helpers/NcPluginMgrv2';
import { DatasModule } from './modules/datas/datas.module';
import { IEventEmitter } from './modules/event-emitter/event-emitter.interface';
import { EventEmitterModule } from './modules/event-emitter/event-emitter.module';
import { AuthService } from './services/auth.service';
import { UsersModule } from './modules/users/users.module';
import { MetaService } from './meta/meta.service';
import Noco from './Noco';
import { TestModule } from './modules/test/test.module';
import { GlobalModule } from './modules/global/global.module';
import { HookHandlerService } from './services/hook-handler.service';
import { LocalStrategy } from './strategies/local.strategy';
import { AuthTokenStrategy } from './strategies/authtoken.strategy/authtoken.strategy';
import { BaseViewStrategy } from './strategies/base-view.strategy/base-view.strategy';
import { MetasModule } from './modules/metas/metas.module';
import NocoCache from './cache/NocoCache';
import { JobsModule } from './modules/jobs/jobs.module';
import type { OnApplicationBootstrap } from '@nestjs/common';

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
            url: process.env.NC_REDIS_URL,
          }),
        ]
      : []),
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
  ],
})
export class AppModule implements OnApplicationBootstrap {
  constructor(
    private readonly connection: Connection,
    private readonly metaService: MetaService,
    @Inject('IEventEmitter') private readonly eventEmitter: IEventEmitter,
  ) {}

  // app init
  async onApplicationBootstrap(): Promise<void> {
    process.env.NC_VERSION = '0105004';

    await NocoCache.init();

    // todo: remove
    // temporary hack
    Noco._ncMeta = this.metaService;
    Noco.config = this.connection.config;
    Noco.eventEmitter = this.eventEmitter;

    await NcPluginMgrv2.init(Noco.ncMeta);
  }
}

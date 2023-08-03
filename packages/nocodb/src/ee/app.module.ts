import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppModule as AppCeModule, ceModuleConfig } from 'src/app.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { CustomApiLimiterGuard } from '~/guards/custom-api-limiter.guard';
import { WorkspaceUsersModule } from '~/modules/workspace-users/workspace-users.module';
import { ThrottlerConfigService } from '~/services/throttler/throttler-config.service';
import appConfig from '~/app.config';
import { Model } from '~/models';
import { ExtractIdsMiddleware } from '~/middlewares/extract-ids/extract-ids.middleware';

console.log(Model);

// todo: refactor to use config service
const enableThrottler = !!process.env['NC_THROTTLER_REDIS'];

@Module({
  ...ceModuleConfig,
  imports: [
    ...ceModuleConfig.imports,
    WorkspacesModule,
    WorkspaceUsersModule,
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
    ...ceModuleConfig.providers.map((x) => {
      if (x && x['provide'] === APP_GUARD) {
        return {
          provide: APP_GUARD,
          useClass: enableThrottler
            ? CustomApiLimiterGuard
            : ExtractIdsMiddleware,
        };
      }
      return x;
    }),
  ],
})
export class AppModule extends AppCeModule {
  constructor() {
    super();
  }
}

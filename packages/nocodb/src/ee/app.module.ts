import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { AppModule as AppCeModule, ceModuleConfig } from '../app.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { WorkspaceUsersModule } from '~/modules/workspace-users/workspace-users.module';
import { ThrottlerConfigService } from '~/services/throttler/throttler-config.service';
import appConfig from '~/app.config';
import { Model } from '~/models';


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
})
export class AppModule extends AppCeModule {
  constructor() {
    super();
  }
}

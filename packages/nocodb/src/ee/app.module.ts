import { Module } from '@nestjs/common';
import { AppModule as AppCeModule, ceModuleConfig } from '../app.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { WorkspaceUsersModule } from '~~/common/workspace-users/workspace-users.module';

// todo: refactor to use config service
const enableThrottler = !!process.env['NC_THROTTLER_REDIS'];

@Module({
  ...ceModuleConfig,
  imports: [
    ...ceModuleConfig.imports,
    WorkspacesModule, WorkspaceUsersModule
  ],
})
export class AppModule extends AppCeModule {
  constructor() {
    super();
  }
}

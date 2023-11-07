import { forwardRef, Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module';
import { WorkspaceUsersService } from './workspace-users.service';
import { WorkspaceUsersController } from './workspace-users.controller';

@Module({
  controllers:
    process.env.NC_WORKER_CONTAINER !== 'true'
      ? [WorkspaceUsersController]
      : [],
  providers: [WorkspaceUsersService],
  imports: [forwardRef(() => UsersModule)],
  exports: [WorkspaceUsersService],
})
export class WorkspaceUsersModule {}

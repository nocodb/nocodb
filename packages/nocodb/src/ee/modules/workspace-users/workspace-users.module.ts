import { Module } from '@nestjs/common';
import { WorkspaceUsersService } from './workspace-users.service';
import { WorkspaceUsersController } from './workspace-users.controller';

@Module({
  controllers: [WorkspaceUsersController],
  providers: [WorkspaceUsersService],
})
export class WorkspaceUsersModule {}

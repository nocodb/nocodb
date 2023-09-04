import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { WorkspaceUsersService } from './workspace-users.service';
import { WorkspaceUsersController } from './workspace-users.controller';

@Module({
  controllers: [WorkspaceUsersController],
  providers: [WorkspaceUsersService],
  imports: [UsersModule],
})
export class WorkspaceUsersModule {}

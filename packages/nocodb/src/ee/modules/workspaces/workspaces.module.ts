import { forwardRef, Module } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { MetasModule } from '~/modules/metas/metas.module';
import { WorkspaceUsersModule } from '~/modules/workspace-users/workspace-users.module';

@Module({
  imports: [MetasModule, forwardRef(() => WorkspaceUsersModule)],
  controllers: [WorkspacesController],
  providers: [WorkspacesService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}

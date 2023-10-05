import { forwardRef, Module } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { MetasModule } from '~/modules/metas/metas.module';
import { WorkspaceUsersModule } from '~/modules/workspace-users/workspace-users.module';
import { JobsModule } from '~/modules/jobs/jobs.module';

@Module({
  imports: [MetasModule, JobsModule, forwardRef(() => WorkspaceUsersModule)],
  controllers: [WorkspacesController],
  providers: [WorkspacesService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}

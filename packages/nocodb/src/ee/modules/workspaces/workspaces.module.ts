import { forwardRef, Module } from '@nestjs/common';
import { WorkspacesService } from '~/modules/workspaces/workspaces.service';
import { WorkspacesController } from '~/modules/workspaces/workspaces.controller';
import { MetasModule } from '~/modules/metas/metas.module';
import { WorkspaceUsersModule } from '~/modules/workspace-users/workspace-users.module';
import { JobsModule } from '~/modules/jobs/jobs.module';

@Module({
  imports: [MetasModule, JobsModule, forwardRef(() => WorkspaceUsersModule)],
  controllers:
    process.env.NC_WORKER_CONTAINER !== 'true' ? [WorkspacesController] : [],
  providers: [WorkspacesService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}

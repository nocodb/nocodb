import { forwardRef, Module } from '@nestjs/common';
import {
  JobsModule as JobsModuleCE,
  JobsModuleMetadata,
} from 'src/modules/jobs/jobs.module';
import { UpdateStatsProcessor } from '~/modules/jobs/jobs/update-stats/update-stats.processor';
import { WorkspacesModule } from '~/modules/workspaces/workspaces.module';
import { WorkerController } from '~/modules/jobs/worker/worker.controller';

@Module({
  ...JobsModuleMetadata,
  imports: [...JobsModuleMetadata.imports, forwardRef(() => WorkspacesModule)],
  controllers: [...JobsModuleMetadata.controllers, WorkerController],
  providers: [...JobsModuleMetadata.providers, UpdateStatsProcessor],
})
export class JobsModule extends JobsModuleCE {}

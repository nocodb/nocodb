import { Module } from '@nestjs/common';
import {
  JobsModule as JobsModuleCE,
  JobsModuleMetadata,
} from 'src/modules/jobs/jobs.module';
import { UpdateStatsProcessor } from '~/modules/jobs/jobs/update-stats/update-stats.processor';
import { CleanUpProcessor } from '~/modules/jobs/jobs/clean-up/clean-up.processor';
import { WorkerController } from '~/modules/jobs/worker/worker.controller';
import { HealthCheckProcessor } from '~/modules/jobs/jobs/health-check.processor';

@Module({
  ...JobsModuleMetadata,
  imports: [...JobsModuleMetadata.imports],
  controllers: [...JobsModuleMetadata.controllers, WorkerController],
  providers: [
    ...JobsModuleMetadata.providers,
    UpdateStatsProcessor,
    HealthCheckProcessor,
    CleanUpProcessor,
  ],
})
export class JobsModule extends JobsModuleCE {}

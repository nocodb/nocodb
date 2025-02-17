import { Module } from '@nestjs/common';
import {
  JobsModule as JobsModuleCE,
  JobsModuleMetadata,
} from 'src/modules/jobs/jobs.module';
import { UpdateStatsProcessor } from '~/modules/jobs/jobs/update-stats/update-stats.processor';
import { CleanUpProcessor } from '~/modules/jobs/jobs/clean-up/clean-up.processor';
import { CleanUpController } from '~/modules/jobs/jobs/clean-up/clean-up.controller';
import { WorkerController } from '~/modules/jobs/worker/worker.controller';
import { HealthCheckProcessor } from '~/modules/jobs/jobs/health-check.processor';
import { SnapshotController } from '~/modules/jobs/jobs/snapshot/snapshot.controller';
import { SnapshotProcessor } from '~/modules/jobs/jobs/snapshot/snapshot.processor';
import { RemoteImportService } from '~/modules/jobs/jobs/export-import/remote-import.service';

@Module({
  ...JobsModuleMetadata,
  imports: [...JobsModuleMetadata.imports],
  controllers: [
    ...JobsModuleMetadata.controllers,
    WorkerController,
    CleanUpController,
    SnapshotController,
  ],
  providers: [
    ...JobsModuleMetadata.providers,
    UpdateStatsProcessor,
    HealthCheckProcessor,
    CleanUpProcessor,
    SnapshotProcessor,
    RemoteImportService,
  ],
  exports: [...JobsModuleMetadata.exports, RemoteImportService],
})
export class JobsModule extends JobsModuleCE {}

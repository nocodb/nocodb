import { Module } from '@nestjs/common';
import {
  JobsModule as JobsModuleCE,
  JobsModuleMetadata,
} from 'src/modules/jobs/jobs.module';
import { UpdateStatsProcessor } from '~/modules/jobs/jobs/update-stats/update-stats.processor';

@Module({
  ...JobsModuleMetadata,
  providers: [...JobsModuleMetadata.providers, UpdateStatsProcessor],
})
export class JobsModule extends JobsModuleCE {}

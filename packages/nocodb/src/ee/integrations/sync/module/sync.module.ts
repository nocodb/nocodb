import { forwardRef, Module } from '@nestjs/common';
import { NocoModule } from '~/modules/noco.module';
import { SyncModuleService } from '~/integrations/sync/module/services/sync.service';
import { SyncModuleSyncDataProcessor } from '~/integrations/sync/module/services/sync.processor';
import { SyncModuleSyncScheduleProcessor } from '~/integrations/sync/module/services/sync-schedule.processor';

@Module({
  imports: [forwardRef(() => NocoModule)],
  controllers: [],
  providers: [
    SyncModuleService,
    SyncModuleSyncDataProcessor,
    SyncModuleSyncScheduleProcessor,
  ],
  exports: [
    SyncModuleService,
    SyncModuleSyncDataProcessor,
    SyncModuleSyncScheduleProcessor,
  ],
})
export class NocoSyncModule {}

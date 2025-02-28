import { forwardRef, Module } from '@nestjs/common';
import { NocoModule } from '~/modules/noco.module';
import { SyncModuleService } from '~/integrations/sync/module/services/sync.service';

@Module({
  imports: [forwardRef(() => NocoModule)],
  controllers: [],
  providers: [SyncModuleService],
  exports: [SyncModuleService],
})
export class NocoSyncModule {}

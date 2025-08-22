import { Injectable, Logger } from '@nestjs/common';
import { NOCO_SERVICE_USERS, SyncTrigger } from 'nocodb-sdk';
import { SyncModuleService } from '~/integrations/sync/module/services/sync.service';
import Noco from '~/Noco';
import { SyncConfig } from '~/models';
import { MetaTable } from '~/utils/globals';

@Injectable()
export class SyncModuleSyncScheduleProcessor {
  private logger = new Logger(SyncModuleSyncScheduleProcessor.name);

  constructor(protected readonly syncModuleService: SyncModuleService) {}

  async job() {
    this.logger.log('SyncModuleSyncScheduleProcessor job started');

    const ncMeta = Noco.ncMeta;
    const syncConfigsRaw = await ncMeta
      .knexConnection(MetaTable.SYNC_CONFIGS)
      .where('sync_trigger', SyncTrigger.Schedule)
      .where('next_sync_at', '<=', new Date().toISOString())
      // For timebeing run 10 jobs at a time maximum
      .limit(10);

    const syncConfigs = syncConfigsRaw.map((d) => new SyncConfig(d));

    for (const syncConfig of syncConfigs) {
      const context = {
        workspace_id: syncConfig.fk_workspace_id,
        base_id: syncConfig.base_id,
      };

      const job = await this.syncModuleService.triggerSync(context, {
        syncConfigId: syncConfig.id,
        bulk: true,
        req: {
          user: NOCO_SERVICE_USERS.SYNC_USER,
        } as any,
      });

      this.logger.log(
        `Sync job triggered for ${syncConfig.id} with id ${job.id}`,
      );
    }

    this.logger.log('SyncModuleSyncScheduleProcessor job completed');
  }
}

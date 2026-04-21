import { Injectable, Logger } from '@nestjs/common';
import { NOCO_SERVICE_USERS, ServiceUserType } from 'nocodb-sdk';
import type { Job } from 'bull';
import type { NcContext, NcRequest } from '~/interface/config';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import { BaseTrashService } from '~/services/base-trash/base-trash.service';

const BATCH_SIZE = 50;
const MAX_PER_RUN = 1000;

@Injectable()
export class BaseTrashCleanUpProcessor {
  private readonly logger = new Logger(BaseTrashCleanUpProcessor.name);

  constructor(private readonly baseTrashService: BaseTrashService) {}

  async job(job: Job) {
    this.logger.debug(`Job started for ${job.id}`);

    const now = new Date().toISOString();
    let totalCleaned = 0;

    while (totalCleaned < MAX_PER_RUN) {
      const batch = await Noco.ncMeta
        .knex(MetaTable.TRASH)
        .whereNotNull('cleanup_due_at')
        .where('cleanup_due_at', '<=', now)
        .orderBy('cleanup_due_at', 'asc')
        .select('id', 'fk_workspace_id', 'base_id', 'deleted_by')
        .limit(BATCH_SIZE);

      if (!batch.length) break;

      for (const entry of batch) {
        try {
          const context: NcContext = {
            workspace_id: entry.fk_workspace_id,
            base_id: entry.base_id,
          };

          await this.baseTrashService.permanentDelete(context, {
            trashId: entry.id,
            user: NOCO_SERVICE_USERS[ServiceUserType.TRASH_CLEANUP_USER],
            req: {
              user: NOCO_SERVICE_USERS[ServiceUserType.TRASH_CLEANUP_USER],
            } as NcRequest,
          });

          totalCleaned++;
        } catch (e) {
          this.logger.error(
            `Failed to clean trash entry ${entry.id}: ${e.message}`,
            e.stack,
          );
        }
      }

      if (batch.length < BATCH_SIZE) break;
    }

    if (totalCleaned > 0) {
      this.logger.log(
        `Job completed for ${job.id} — cleaned ${totalCleaned} entries`,
      );
    }
  }
}

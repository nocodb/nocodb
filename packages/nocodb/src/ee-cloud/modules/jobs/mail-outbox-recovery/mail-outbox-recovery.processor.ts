import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import dayjs from 'dayjs';
import { Queue } from 'bull';
import Noco from '~/Noco';
import { JOBS_QUEUE, JobTypes } from '~/interface/Jobs';
import { MetaTable } from '~/utils/globals';

const STUCK_AFTER_MINUTES = 5;
const MAX_RETRY_ATTEMPTS = 5;
const RECOVERY_BATCH = 50;

@Injectable()
export class MailOutboxRecoveryProcessor {
  private logger = new Logger(MailOutboxRecoveryProcessor.name);

  constructor(@InjectQueue(JOBS_QUEUE) private readonly jobsQueue: Queue) {}

  async job() {
    const ncMeta = Noco.ncMeta;

    const stuckBefore = dayjs()
      .subtract(STUCK_AFTER_MINUTES, 'minute')
      .toISOString();

    let stuck: { id: string; attempts: number }[] = [];
    try {
      stuck = await ncMeta
        .knexConnection(MetaTable.MAIL_SENDS)
        .select('id', 'attempts')
        .whereIn('status', ['pending', 'sending'])
        .andWhere('updated_at', '<', stuckBefore)
        .andWhere('attempts', '<', MAX_RETRY_ATTEMPTS)
        .limit(RECOVERY_BATCH);
    } catch (e) {
      this.logger.error('MailOutboxRecovery: query failed', (e as Error).stack);
      return;
    }

    if (!stuck.length) return;

    this.logger.log(
      `MailOutboxRecovery: re-enqueuing ${stuck.length} stuck mail send(s)`,
    );

    for (const row of stuck) {
      try {
        await ncMeta
          .knexConnection(MetaTable.MAIL_SENDS)
          .where({ id: row.id })
          .update({
            status: 'pending',
            updated_at: ncMeta.now(),
          });

        await this.jobsQueue.add(
          { jobName: JobTypes.MailDispatch, mailSendId: row.id },
          { removeOnComplete: true, removeOnFail: 100, attempts: 1 },
        );
      } catch (e) {
        this.logger.error(
          `MailOutboxRecovery: failed to re-enqueue ${row.id}`,
          (e as Error).stack,
        );
      }
    }
  }
}

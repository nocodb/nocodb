import { Injectable } from '@nestjs/common';
import Noco from '~/Noco';


@Injectable()
export class OrderColumnMigration {
  private readonly debugLog = debug('nc:migration-jobs:order-column');

  log = (...msgs: string[]) => {
    console.log('[nc_job_005_order_column]: ', ...msgs);
  }

  async job() {
    try {
      const ncMeta = Noco.ncMeta;

    } catch (error) {
      this.debugLog('Error in job', error);
    }
  }

}
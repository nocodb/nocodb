import debug from 'debug';
import PQueue from 'p-queue';
import { Logger } from '@nestjs/common';

const NC_EXECUTE_OPERATIONS_CONCURRENCY =
  +process.env.NC_EXECUTE_OPERATIONS_CONCURRENCY || 5;

export default class NcHelp {
  public static logger = new Logger('NcHelp');

  public static async executeOperations(
    fns: Array<() => Promise<any>>,
    dbType: string,
  ): Promise<any> {
    const queue = new PQueue({
      concurrency:
        dbType === 'oracledb' || dbType === 'mssql'
          ? 1
          : NC_EXECUTE_OPERATIONS_CONCURRENCY,
    });

    let error = null;

    for (const fn of fns) {
      queue.add(async () => {
        try {
          await fn();
        } catch (e) {
          this.logger.error(e);
          error = e;
        }
      });
    }

    await queue.onIdle();

    if (error) {
      throw error;
    }
  }

  public static enableOrDisableDebugLog(args: {
    [key: string]: boolean;
  }): void {
    const enabledKeys = debug
      .disable()
      .split(',')
      .filter((v) => v.trim());
    for (const [key, enabled] of Object.entries(args)) {
      if (enabled) {
        if (!enabledKeys.includes(key)) {
          enabledKeys.push(key);
        }
      } else {
        const index = enabledKeys.indexOf(key);
        if (index > -1) {
          enabledKeys.splice(index, 1);
        }
      }
    }

    debug.enable(enabledKeys.join(','));
  }
}

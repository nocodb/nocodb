import debug from 'debug';
import PQueue from 'p-queue';
import { Logger } from '@nestjs/common';

const NC_EXECUTE_OPERATIONS_CONCURRENCY =
  parseInt(process.env.NC_EXECUTE_OPERATIONS_CONCURRENCY) || 5;

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

    const errors = [];

    for (const fn of fns) {
      queue.add(async () => {
        if (errors.length) {
          return;
        }

        try {
          await fn();
        } catch (e) {
          this.logger.error(e);
          errors.push(e);
        }
      });
    }

    await queue.onIdle();

    if (errors.length) {
      throw errors[0];
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

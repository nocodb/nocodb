import debug from 'debug';

export default class NcHelp {
  public static async executeOperations(
    fns: Array<() => Promise<any>>,
    dbType: string,
  ): Promise<any> {
    if (dbType === 'oracledb' || dbType === 'mssql') {
      for (const fn of fns) {
        await fn();
      }
    } else {
      await Promise.all(
        fns.map(async (f) => {
          await f();
        }),
      );
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

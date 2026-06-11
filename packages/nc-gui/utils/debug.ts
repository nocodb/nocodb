import { debug } from 'debug'
export class NcDebug {
  private static logger: any

  static initLogger() {
    if (!NcDebug.logger) {
      NcDebug.logger = debug('nc')
    }

    return NcDebug.logger
  }

  static log(...args: any[]) {
    if (!debug.enabled('nc')) {
      return
    }

    const logger = NcDebug.initLogger()

    logger(...args)
  }
}

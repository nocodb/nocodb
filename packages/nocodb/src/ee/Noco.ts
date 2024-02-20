// import { Logger as PinoLogger } from 'nestjs-pino';
import NocoCE from 'src/Noco';
import type { INestApplication } from '@nestjs/common';
import { NcLogger } from '~/utils/logger/NcLogger';

export default class Noco extends NocoCE {
  protected static initCustomLogger(nestApp: INestApplication) {
    this.ee = true;
    nestApp.useLogger(nestApp.get(NcLogger));
  }

  public get ncMeta(): any {
    return Noco._ncMeta;
  }

  public static isEE(): boolean {
    return this.ee;
  }
}

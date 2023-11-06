import { Logger as PinoLogger } from 'nestjs-pino';
import NocoCE from 'src/Noco';
import type { INestApplication } from '@nestjs/common';

export default class Noco extends NocoCE {
  protected static initCustomLogger(nestApp: INestApplication) {
    nestApp.useLogger(nestApp.get(PinoLogger));
  }

  public get ncMeta(): any {
    return Noco._ncMeta;
  }
}

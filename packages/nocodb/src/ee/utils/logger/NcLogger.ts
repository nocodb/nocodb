import { Inject, Injectable } from '@nestjs/common';
import { Logger, Params, PARAMS_PROVIDER_TOKEN, PinoLogger } from 'nestjs-pino';

/**
 * A custom logger that disables all logs from nestjs core modules when initialized.
 * they use one of the following contexts:
 * - `InstanceLoader`
 * - `RoutesResolver`
 * - `RouterExplorer`
 * - `NestFactory`
 */
@Injectable()
export class NcLogger extends Logger {
  static contextsToIgnore = [
    'InstanceLoader',
    'RoutesResolver',
    'RouterExplorer',
    'NestFactory',
  ];

  constructor(
    logger: PinoLogger,
    @Inject(PARAMS_PROVIDER_TOKEN) params: Params,
  ) {
    super(logger, params);
  }

  log(_: any, context?: string): void {
    if (!NcLogger.contextsToIgnore.includes(context)) {
      return super.log(_, context);
    }
  }
}

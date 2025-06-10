import { Catch } from '@nestjs/common';
import { GlobalExceptionFilter as GlobalExceptionFilterCE } from 'src/filters/global-exception/global-exception.filter';
import * as Sentry from '@sentry/nestjs';

@Catch()
export class GlobalExceptionFilter extends GlobalExceptionFilterCE {
  constructor() {
    super();

    process.on('uncaughtExceptionMonitor', (err, origin) => {
      console.error('### UNCAUGHT EXCEPTION ###');
      console.error(origin);
      console.error(err);
      Sentry.captureException(err);
    });
  }

  protected captureException(exception: any, request: any) {
    Sentry.captureException(exception, {
      extra: {
        workspaceId: (request as any).ncWorkspaceId,
        projectId: (request as any).ncBaseId,
        ip: (request as any).clientIp,
        id: (request as any).user?.id,
        path: (request as any).path,
        clientId: (request as any).headers?.['nc-client-id'],
        reqId: (request as any).headers?.['nc-req-id'],
      },
    });
  }

  protected logError(exception: any, request: any) {
    this.logger.error(
      {
        msg: exception.message,
        workspaceId: (request as any).ncWorkspaceId,
        projectId: (request as any).ncBaseId,
        ip: (request as any).clientIp,
        id: (request as any).user?.id,
        path: (request as any).path,
        clientId: (request as any).headers?.['nc-client-id'],
      },
      exception.stack,
    );
  }
}

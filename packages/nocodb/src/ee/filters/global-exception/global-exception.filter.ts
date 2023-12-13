import { Catch, Optional } from '@nestjs/common';
import { InjectSentry, SentryService } from '@ntegral/nestjs-sentry';
import { GlobalExceptionFilter as GlobalExceptionFilterCE } from 'src/filters/global-exception/global-exception.filter';

@Catch()
export class GlobalExceptionFilter extends GlobalExceptionFilterCE {
  constructor(
    @Optional() @InjectSentry() protected readonly sentryClient: SentryService,
  ) {
    super(sentryClient);

    process.on('uncaughtExceptionMonitor', (err, origin) => {
      console.error('### UNCAUGHT EXCEPTION ###');
      console.error(origin);
      console.error(err);

      this.sentryClient?.instance()?.captureException(err);
    });
  }

  protected captureException(exception: any, request: any) {
    this.sentryClient?.instance()?.captureException(exception, {
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

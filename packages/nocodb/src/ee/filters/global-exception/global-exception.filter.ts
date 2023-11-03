import { Catch, Optional } from '@nestjs/common';
import { InjectSentry, SentryService } from '@ntegral/nestjs-sentry';
import { GlobalExceptionFilter as GlobalExceptionFilterCE } from 'src/filters/global-exception/global-exception.filter';
import type { ArgumentsHost } from '@nestjs/common';
import type { Request, Response } from 'express';

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

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // set request id in response header
    response.header('nc-req-id', (request as any).id);

    return super.catch(exception, host);
  }
  protected captureException(exception: any, request: any) {
    this.sentryClient?.instance()?.captureException(exception, {
      extra: {
        workspaceId: (request as any).ncWorkspaceId,
        projectId: (request as any).ncProjectId,
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
        projectId: (request as any).ncProjectId,
        ip: (request as any).clientIp,
        id: (request as any).user?.id,
        path: (request as any).path,
        clientId: (request as any).headers?.['nc-client-id'],
      },
      exception.stack,
    );
  }
}

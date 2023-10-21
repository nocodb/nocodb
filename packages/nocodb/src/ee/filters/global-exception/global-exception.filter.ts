import { Catch, Optional } from '@nestjs/common';
import { InjectSentry, SentryService } from '@ntegral/nestjs-sentry';
import { GlobalExceptionFilter as GlobalExceptionFilterCE } from 'src/filters/global-exception/global-exception.filter';

@Catch()
export class GlobalExceptionFilter extends GlobalExceptionFilterCE {
  constructor(
    @Optional() @InjectSentry() protected readonly sentryClient: SentryService,
  ) {
    super(sentryClient);
  }

  protected captureException(exception: any, request: any) {
    this.sentryClient?.instance()?.captureException(exception, {
      extra: {
        workspaceId: (request as any).ncWorkspaceId,
        projectId: (request as any).ncProjectId,
        ip: (request as any).clientIp,
        email: (request as any).user?.email,
      },
    });
  }
}

import { Catch } from '@nestjs/common';
import { GlobalExceptionFilter as GlobalExceptionFilterCE } from 'src/filters/global-exception/global-exception.filter';
import * as Sentry from '@sentry/nestjs';
import type { Plan } from '~/models';
import { TelemetryService } from '~/services/telemetry.service';

@Catch()
export class GlobalExceptionFilter extends GlobalExceptionFilterCE {
  constructor(private readonly telemetryService: TelemetryService) {
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

    const workspacePlan = (request as any).ncWorkspace?.payment?.plan as Plan;

    if (workspacePlan && !workspacePlan.free) {
      this.telemetryService
        .sendSystemEvent({
          event_type: 'priority_error',
          error_trigger: 'global_exception',
          error_type: exception?.name,
          message: exception?.message,
          error_details: exception?.stack,
          affected_resources: [
            request?.user?.email,
            request?.user?.id,
            request?.ncWorkspaceId,
            request?.ncBaseId,
            request?.path,
          ],
        })
        .catch((err) => {
          console.error('Error sending telemetry event:', err);
        });
    }
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

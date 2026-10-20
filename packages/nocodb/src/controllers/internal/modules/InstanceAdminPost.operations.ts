import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { AbuseReportsService } from '~/services/abuse-reports.service';

/** Instance-level moderation. Self-hosted only: cloud filters this module out. */
@Injectable()
export class InstanceAdminPostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  constructor(protected readonly abuseReportsService: AbuseReportsService) {}

  operations = [
    'abuseReportUpdate' as const,
    'abuseReportDisableResource' as const,
    'orgUserBlock' as const,
    'orgUserUnblock' as const,
  ];
  httpMethod = 'POST' as const;

  async handle(
    _context: NcContext,
    {
      operation,
      payload,
      req,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload: any;
      req: NcRequest;
    },
  ): InternalPOSTResponseType {
    switch (operation) {
      case 'abuseReportUpdate':
        return this.abuseReportsService.adminUpdateStatus({
          reportId: payload?.reportId,
          status: payload?.status,
          req,
        });
      case 'abuseReportDisableResource':
        return this.abuseReportsService.adminDisableResource({
          reportId: payload?.reportId,
          req,
        });
      case 'orgUserBlock':
        return this.abuseReportsService.blockUser({
          userId: payload?.userId,
          reason: payload?.reason,
          req,
        });
      case 'orgUserUnblock':
        return this.abuseReportsService.unblockUser({
          userId: payload?.userId,
          req,
        });
    }
  }
}

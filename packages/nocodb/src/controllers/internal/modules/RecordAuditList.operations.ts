import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import { AuditsService } from '~/services/audits.service';

@Injectable()
export class RecordAuditListOperations
  implements InternalApiModule<InternalGETResponseType>
{
  constructor(protected readonly auditsService: AuditsService) {}
  operations = ['recordAuditList' as const];
  httpMethod = 'GET' as const;

  // Security improvement: `recordAuditList` returns raw audit rows (admin email,
  // IP, user-agent, full old/new cell-edit history). It must never be reachable
  // by a public shared-base session, so the internal dispatcher denies it the
  // same way the REST controllers deny their sensitive endpoints.
  publicBaseBlockedOperations = ['recordAuditList' as const];

  async handle(
    context: NcContext,
    {
      req,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload: any;
      req: NcRequest;
    },
  ): InternalGETResponseType {
    return await this.auditsService.recordAuditList(context, {
      row_id: req.query.row_id as string,
      fk_model_id: req.query.fk_model_id as string,
      cursor: req.query.cursor as string,
    });
  }
}

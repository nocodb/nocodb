import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalApiResponse,
} from '~/controllers/internal/types';
import { AuditsService } from '~/services/audits.service';

@Injectable()
export class RecordAuditListOperation implements InternalApiModule {
  constructor(protected readonly auditsService: AuditsService) {}
  operation: 'recordAuditList';
  httpMethod: 'GET';

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
  ): Promise<InternalApiResponse> {
    return await this.auditsService.recordAuditList(context, {
      row_id: req.query.row_id as string,
      fk_model_id: req.query.fk_model_id as string,
      cursor: req.query.cursor as string,
    });
  }
}

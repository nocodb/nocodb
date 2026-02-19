import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import { RlsService } from '~/services/rls.service';

@Injectable()
export class RlsGetOperations
  implements InternalApiModule<InternalGETResponseType>
{
  constructor(private readonly rlsService: RlsService) {}

  operations = ['rlsPolicyList', 'rlsPolicyGet'] as (keyof typeof OPERATION_SCOPES)[];
  httpMethod = 'GET' as const;

  async handle(
    context: NcContext,
    {
      payload,
      operation,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload: any;
      req: NcRequest;
    },
  ): InternalGETResponseType {
    switch (operation) {
      case 'rlsPolicyList':
        return (
          await this.rlsService.listPolicies(context, {
            tableId: payload.tableId,
          })
        ).list as any;

      case 'rlsPolicyGet':
        return (await this.rlsService.getPolicy(context, {
          policyId: payload.policyId,
        })) as any;
    }
  }
}

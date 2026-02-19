import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import { RlsService } from '~/services/rls.service';
import { FiltersService } from '~/services/filters.service';
import { PagedResponseImpl } from '~/helpers/PagedResponse';

@Injectable()
export class RlsGetOperations
  implements InternalApiModule<InternalGETResponseType>
{
  constructor(
    private readonly rlsService: RlsService,
    private readonly filtersService: FiltersService,
  ) {}

  operations = [
    'rlsPolicyList',
    'rlsPolicyGet',
    'rlsPolicyFilterList',
  ] as (keyof typeof OPERATION_SCOPES)[];
  httpMethod = 'GET' as const;

  async handle(
    context: NcContext,
    {
      req,
      operation,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      req: NcRequest;
    },
  ): InternalGETResponseType {
    switch (operation) {
      case 'rlsPolicyList':
        return (
          await this.rlsService.listPolicies(context, {
            tableId: req.query.tableId as string,
          })
        ).list;

      case 'rlsPolicyGet':
        return await this.rlsService.getPolicy(context, {
          policyId: req.query.policyId as string,
        });

      case 'rlsPolicyFilterList':
        return new PagedResponseImpl(
          await this.filtersService.rlsPolicyFilterList(context, {
            rlsPolicyId: req.query.rlsPolicyId as string,
          }),
        );
    }
  }
}

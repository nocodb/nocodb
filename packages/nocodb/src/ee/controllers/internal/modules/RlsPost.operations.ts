import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { RlsService } from '~/services/rls.service';
import { FiltersService } from '~/services/filters.service';

@Injectable()
export class RlsPostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  constructor(
    private readonly rlsService: RlsService,
    private readonly filtersService: FiltersService,
  ) {}

  operations = [
    'rlsPolicyCreate',
    'rlsPolicyUpdate',
    'rlsPolicyDelete',
    'rlsPolicySetSubjects',
    'rlsPolicyFilterCreate',
  ] as (keyof typeof OPERATION_SCOPES)[];
  httpMethod = 'POST' as const;

  async handle(
    context: NcContext,
    {
      payload,
      operation,
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
      case 'rlsPolicyCreate':
        return (await this.rlsService.createPolicy(context, {
          body: payload,
          userId: req.user?.id,
          req,
        })) as any;

      case 'rlsPolicyUpdate':
        return (await this.rlsService.updatePolicy(context, {
          body: payload,
          userId: req.user?.id,
          req,
        })) as any;

      case 'rlsPolicyDelete':
        return (await this.rlsService.deletePolicy(context, {
          policyId: payload.policyId,
          userId: req.user?.id,
          req,
        })) as any;

      case 'rlsPolicySetSubjects':
        return (await this.rlsService.setSubjects(context, {
          policyId: payload.policyId,
          subjects: payload.subjects,
          userId: req.user?.id,
          req,
        })) as any;

      case 'rlsPolicyFilterCreate':
        return (await this.filtersService.rlsPolicyFilterCreate(context, {
          filter: payload,
          rlsPolicyId: payload.fk_rls_policy_id,
          user: req.user,
          req,
        })) as any;
    }
  }
}

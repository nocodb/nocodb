import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import { getBaseListAll } from '~/helpers/baseListAllHelpers';
import { getPatResourceFilter } from '~/helpers/patResourceFilter';

@Injectable()
export class BaseListAllGetOperations
  implements InternalApiModule<InternalGETResponseType>
{
  operations = ['baseListAll' as const];
  httpMethod = 'GET' as const;

  async handle(
    _context: NcContext,
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
    const result = await getBaseListAll(req.user.id);

    // Apply PAT resource filter if request is from a scoped API token.
    const patFilter = await getPatResourceFilter(req);
    if (!patFilter) return result;

    const baseIdSet = new Set(patFilter.baseIds);
    const wsIdSet = new Set(patFilter.workspaceIds);

    return {
      workspaces: result.workspaces
        .map((ws) => ({
          ...ws,
          bases: wsIdSet.has(ws.id)
            ? ws.bases
            : ws.bases.filter((b) => baseIdSet.has(b.id)),
        }))
        .filter((ws) => ws.bases.length > 0 || wsIdSet.has(ws.id)),
    };
  }
}

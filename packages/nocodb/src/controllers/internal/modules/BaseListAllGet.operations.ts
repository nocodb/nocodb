import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import { getBaseListAll } from '~/helpers/baseListAllHelpers';

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
    return await getBaseListAll(req.user.id);
  }
}

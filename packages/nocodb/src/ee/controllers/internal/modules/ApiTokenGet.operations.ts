import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import { ApiTokensV3Service } from '~/services/v3/api-tokens-v3.service';

@Injectable()
export class ApiTokenGetOperations
  implements InternalApiModule<InternalGETResponseType>
{
  operations = ['apiTokenListWithScopes' as const];
  httpMethod = 'GET' as const;

  constructor(private readonly apiTokensV3Service: ApiTokensV3Service) {}

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
    return await this.apiTokensV3Service.list({ cookie: req });
  }
}

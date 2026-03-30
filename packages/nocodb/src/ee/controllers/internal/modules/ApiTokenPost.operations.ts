import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { ApiTokensV3Service } from '~/services/v3/api-tokens-v3.service';

@Injectable()
export class ApiTokenPostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  operations = [
    'apiTokenCreateWithScopes' as const,
    'apiTokenUpdateWithScopes' as const,
  ];
  httpMethod = 'POST' as const;

  constructor(private readonly apiTokensV3Service: ApiTokensV3Service) {}

  async handle(
    _context: NcContext,
    {
      req,
      operation,
      payload,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload: any;
      req: NcRequest;
    },
  ): InternalPOSTResponseType {
    switch (operation) {
      case 'apiTokenCreateWithScopes':
        return await this.apiTokensV3Service.create({
          body: payload,
          cookie: req,
        });
      case 'apiTokenUpdateWithScopes':
        return await this.apiTokensV3Service.update({
          id: payload.tokenId,
          body: payload,
          cookie: req,
        });
    }
  }
}

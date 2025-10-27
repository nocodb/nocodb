import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import { McpTokenService } from '~/services/mcp.service';

@Injectable()
export class McpGetOperations
  implements InternalApiModule<InternalGETResponseType>
{
  constructor(protected readonly mcpService: McpTokenService) {}
  operations = ['mcpList' as const, 'mcpGet' as const, 'mcpRootList' as const];
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
      payload: any;
      req: NcRequest;
    },
  ): InternalGETResponseType {
    switch (operation) {
      case 'mcpList':
        return await this.mcpService.list(context, req);
      case 'mcpGet':
        return await this.mcpService.get(context, req.query.tokenId as string);
      case 'mcpRootList':
        return await this.mcpService.listByUserId(context, req);
    }
  }
}

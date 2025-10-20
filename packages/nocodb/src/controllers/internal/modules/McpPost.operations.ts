import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalApiResponse,
} from '~/controllers/internal/types';
import { McpTokenService } from '~/services/mcp.service';

@Injectable()
export class McpPostOperations implements InternalApiModule {
  constructor(protected readonly mcpService: McpTokenService) {}
  operations: ['mcpCreate', 'mcpUpdate', 'mcpDelete'];
  httpMethod: 'POST';

  async handle(
    context: NcContext,
    {
      payload,
      req,
      operation,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload: any;
      req: NcRequest;
    },
  ): Promise<InternalApiResponse> {
    switch (operation) {
      case 'mcpCreate':
        return await this.mcpService.create(context, payload, req);
      case 'mcpUpdate':
        return await this.mcpService.regenerateToken(
          context,
          payload.tokenId,
          payload,
        );
      case 'mcpDelete':
        return await this.mcpService.delete(context, payload.tokenId);
    }
  }
}

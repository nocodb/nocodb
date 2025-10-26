import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalApiResponse,
} from '~/controllers/internal/types';
import { McpTokenService } from '~/services/mcp.service';

@Injectable()
export class McpRootListOperation implements InternalApiModule {
  constructor(protected readonly mcpService: McpTokenService) {}
  operation: 'mcpRootList';
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
    return await this.mcpService.listByUserId(context, req);
  }
}

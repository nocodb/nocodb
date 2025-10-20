import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalApiResponse,
} from '~/controllers/internal/types';
import { McpTokenService } from '~/services/mcp.service';

@Injectable()
export class McpCreateOperation implements InternalApiModule {
  constructor(protected readonly mcpService: McpTokenService) {}
  operation: 'mcpCreate';
  httpMethod: 'POST';

  async handle(
    context: NcContext,
    {
      payload,
      req,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload: any;
      req: NcRequest;
    },
  ): Promise<InternalApiResponse> {
    return await this.mcpService.create(context, payload, req);
  }
}

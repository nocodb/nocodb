import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';

export const INTERNAL_API_MODULE_PROVIDER_KEY = 'INTERNAL_API_MODULE';

// TODO: replace any with better type
export type InternalApiResponse = any;

export interface InternalApiModule {
  operation: keyof typeof OPERATION_SCOPES;
  httpMethod: 'GET' | 'POST';
  handle(
    context: NcContext,
    param: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload?: any;
      req: NcRequest;
    },
  ): Promise<InternalApiResponse>;
}

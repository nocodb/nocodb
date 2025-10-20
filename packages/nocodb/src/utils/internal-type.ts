import type { NcContext, NcRequest } from 'nocodb-sdk';
import type { PagedResponseImpl } from '~/helpers/PagedResponse';
import type { MCPToken, OAuthClient } from '~/models';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';

export type InternalGETResponseType = Promise<
  | void
  | MCPToken
  | MCPToken[]
  | PagedResponseImpl<any>
  | OAuthClient
  | OAuthClient[]
>;

export type InternalPOSTResponseType = Promise<
  void | boolean | MCPToken | OAuthClient | OAuthClient[] | { msg: string }
>;

export const INTERNAL_API_MODULE_PROVIDER_KEY = 'INTERNAL_API_MODULE';

export interface InternalApiModule<
  T extends InternalGETResponseType | InternalPOSTResponseType,
> {
  operations: (keyof typeof OPERATION_SCOPES)[];
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
  ): T;
}

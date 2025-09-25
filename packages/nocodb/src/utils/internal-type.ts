import type { NcContext, NcRequest } from 'nocodb-sdk';
import type { PagedResponseImpl } from '~/helpers/PagedResponse';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type {
  Column,
  Filter,
  Hook,
  HookLog,
  MCPToken,
  Model,
  OAuthClient,
  Sort,
  View,
} from '~/models';
import type { DataReflection, Script } from '~/models';

export type InternalGETResponseType = Promise<
  | void
  | DataReflection
  | MCPToken
  | MCPToken[]
  | Script
  | Script[]
  | PagedResponseImpl<any>
  | Model[]
  | Column[]
  | View[]
  | Filter[]
  | Sort[]
  | Hook[]
  | HookLog[]
  | { hash: string }
  | OAuthClient
  | OAuthClient[]
>;

export type InternalPOSTResponseType = Promise<
  | void
  | boolean
  | DataReflection
  | MCPToken
  | Script
  | { id: string; secret?: string }
  | { msg: string }
  | { failedOps: any[] }
  | Model
  | Column
  | View
  | Filter
  | Sort
  | Hook
  | OAuthClient
  | OAuthClient[]
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

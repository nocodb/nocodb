import type { DependencyTableType, NcContext, NcRequest } from 'nocodb-sdk';
import type { PagedResponseImpl } from '~/helpers/PagedResponse';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { Dashboard, Workflow } from '~/models';
import type {
  Column,
  DataReflection,
  Extension,
  Filter,
  Hook,
  HookLog,
  MCPToken,
  Model,
  OAuthClient,
  Script,
  Sort,
  View,
} from '~/models';

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
  | Extension
  | Extension[]
>;

export type InternalPOSTResponseType = Promise<
  | void
  | boolean
  | MCPToken
  | OAuthClient
  | OAuthClient[]
  | { msg: string }
  | {
      hasBreakingChanges: boolean;
      entities: {
        type: DependencyTableType;
        entity: Dashboard | Workflow;
      }[];
    }
  | DataReflection
  | MCPToken
  | Script
  | { id: string; secret?: string }
  | { failedOps: any[] }
  | Model
  | Column
  | View
  | Filter
  | Sort
  | Hook
  | Extension
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

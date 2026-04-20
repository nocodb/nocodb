import type { DependencyTableType, NcContext, NcRequest } from 'nocodb-sdk';
import type { PagedResponseImpl } from '~/helpers/PagedResponse';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { Dashboard, Workflow } from '~/models';
import type {
  Column,
  DataReflection,
  Document,
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
  | Document
  | Document[]
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
  | { workspaces: any[] }
  | { totalRows: number; counts: Record<string, number> }
  | { count: number }
  | {
      tables: {
        id: string;
        title: string;
        trash_disabled: boolean | null;
        trash_retention_days: number | null;
        is_meta: boolean;
        has_deleted_column: boolean;
      }[];
      defaultRetentionDays: number;
    }
  | {
      totalWorkspaces: number;
      totalBases: number;
      totalUsers: number;
      editorCount: number;
    }
>;

export type InternalPOSTResponseType = Promise<
  | void
  | boolean
  | Document
  | MCPToken
  | OAuthClient
  | OAuthClient[]
  | { msg: string }
  | {
      hasBreakingChanges: boolean;
      entities: {
        type: DependencyTableType;
        entity: Dashboard | Workflow | Model;
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
  | { added: boolean; reaction: any }
  | {
      link: (string | number | Record<string, any>)[];
      unlink: (string | number | Record<string, any>)[];
    }[]
  | { message: string }
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

import type {
  BaseVariableType,
  DependencyTableType,
  NcContext,
  NcRequest,
  NodeExecutionResult,
  ProseMirrorDoc,
  RowColoringInfo,
} from 'nocodb-sdk';
import type { TestConnectionResponse } from '@noco-local-integrations/core';
import type { JobTypes } from 'src/interface/Jobs';
import type { PagedResponseImpl } from '~/helpers/PagedResponse';
import type {
  Column,
  Document,
  Filter,
  Hook,
  HookLog,
  Integration,
  MCPToken,
  Model,
  OAuthClient,
  Sort,
  SyncConfig,
  View,
  Workflow,
} from '~/models';
import type { Dashboard, DataReflection, Script, Widget } from '~/models';
import type { JobId } from 'bull';
import type {
  TeamDetailV3Type,
  TeamMemberV3ResponseType,
  TeamV3ResponseType,
} from '~/services/v3/teams-v3.types';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { UndoRedoResult } from '~/services/undo-redo.service';
import type { BaseMetaDiff } from '~/helpers/baseMetaHelpers';
import type RlsPolicy from '~/models/RlsPolicy';

export { INTERNAL_API_MODULE_PROVIDER_KEY } from 'src/utils/internal-type';
import type {
  BaseTeamDetailV3Type,
  BaseTeamListV3Type,
  BaseTeamV3ResponseType,
} from '~/services/v3/base-teams-v3.types';
import type {
  WorkspaceTeamDetailV3Type,
  WorkspaceTeamListV3Type,
  WorkspaceTeamV3ResponseType,
} from '~/services/v3/workspace-teams-v3.types';

export type InternalGETResponseType = Promise<
  | void
  | RowColoringInfo
  | null
  | DataReflection
  | Document
  | Document[]
  | MCPToken
  | MCPToken[]
  | Script
  | Script[]
  | Dashboard
  | Dashboard[]
  | Widget
  | OAuthClient
  | OAuthClient[]
  | Widget[]
  | Workflow
  | Workflow[]
  | { list: TeamV3ResponseType[] }
  | TeamDetailV3Type
  | BaseTeamListV3Type
  | BaseTeamDetailV3Type
  | WorkspaceTeamListV3Type
  | WorkspaceTeamDetailV3Type
  | {
      data: any;
    }
  | {
      user: {
        id: string;
        email: string;
        display_name: string;
        avatar: string;
      };
      accounts: {
        email: boolean;
        google: boolean;
      };
    }
  | { nodes: any[] }
  | { list: any[]; nextCursor: string | null }
  | PagedResponseImpl<any>
  | Model
  | Column[]
  | View[]
  | Filter[]
  | Sort[]
  | Hook[]
  | HookLog[]
  | SyncConfig[]
  | { hash: string }
  | { path?: string; url?: string }
  | { diff: BaseMetaDiff }
  | (RlsPolicy & { filters: Filter[] })
  | (RlsPolicy & { filters: Filter[] })[]
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
  | { pm: ProseMirrorDoc | null; markdown: string | null }
>;

export type InternalPOSTResponseType = Promise<
  | void
  | boolean
  | Document
  | DataReflection
  | MCPToken
  | Script
  | Dashboard
  | Widget
  | Widget[]
  | OAuthClient
  | Workflow
  | { id: JobId; secret?: string }
  | { id: string; secret?: string }
  | { msg: string }
  | { failedOps: any[] }
  | Model
  | Column
  | View
  | Filter
  | Sort
  | Hook
  | TestConnectionResponse
  | { id: JobId; name?: JobTypes }
  | { syncConfig: SyncConfig; integration: Integration }
  | { label: string; value: string }[]
  | TeamV3ResponseType
  | TeamMemberV3ResponseType[]
  | {
      integration: Integration;
      syncConfig: SyncConfig;
      job: { id: JobId; secret?: string };
    }
  | {
      syncConfig: SyncConfig;
      integrations: Integration[];
    }
  | TestConnectionResponse
  | {
      value: string;
      label: string;
    }[]
  | {
      data: any;
    }
  | { id: JobId; name?: string }
  | { msg: string }
  | TeamV3ResponseType
  | TeamMemberV3ResponseType[]
  | BaseTeamV3ResponseType
  | BaseTeamV3ResponseType[]
  | WorkspaceTeamV3ResponseType
  | WorkspaceTeamV3ResponseType[]
  | NodeExecutionResult
  | {
      hasBreakingChanges: boolean;
      entities: {
        type: DependencyTableType;
        entity: Dashboard | Workflow | Model;
      }[];
    }
  | {
      link: any[];
      unlink: any;
    }
  | {
      link: (string | number)[];
      unlink: (string | number)[];
    }
  | { success: boolean }
  | (RlsPolicy & { filters: Filter[] })
  | BaseVariableType
  | BaseVariableType[]
  | { added: boolean; reaction: any }
  | { [key: string]: string }[]
  | {
      sheets: {
        name?: string;
        columns: any[];
        previewData: any[];
        totalSampleRows: number;
        totalRows: number;
        detectedDelimiter?: string;
      }[];
    }
  | {
      link: (string | number | Record<string, any>)[];
      unlink: (string | number | Record<string, any>)[];
    }[]
  | { message: string }
  | { deleted: number; failed: { id: string; error: string }[] }
  | { job_id: string }
  | { pm: ProseMirrorDoc | null; markdown: string | null }
  | UndoRedoResult
  | { uuid: string | null; include_subtree: boolean; password: boolean }
>;

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

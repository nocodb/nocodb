import type { NcContext, NcRequest } from 'nocodb-sdk';
import type { TestConnectionResponse } from '@noco-local-integrations/core';
import type { JobTypes } from 'src/interface/Jobs';
import type { PagedResponseImpl } from '~/helpers/PagedResponse';
import type {
  Column,
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
} from '~/models';
import type { Dashboard, DataReflection, Script, Widget } from '~/models';
import type { JobId } from 'bull';
import type {
  TeamDetailV3Type,
  TeamMemberV3ResponseType,
  TeamV3ResponseType,
} from '~/services/v3/teams-v3.types';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';

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
  | DataReflection
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
>;

export type InternalPOSTResponseType = Promise<
  | void
  | boolean
  | DataReflection
  | MCPToken
  | Script
  | Dashboard
  | Widget
  | Widget[]
  | OAuthClient
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
      integration: Integration;
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

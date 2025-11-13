import type { NcContext, NcRequest } from 'nocodb-sdk';
import type { TestConnectionResponse } from '@noco-local-integrations/core';
import type { PagedResponseImpl } from '~/helpers/PagedResponse';
import type {
  DataReflection,
  Integration,
  MCPToken,
  OAuthClient,
  Script,
  SyncConfig,
  Workflow,
} from '~/models';
import type Dashboard from '~/models/Dashboard';
import type Widget from '~/models/Widget';
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
  | MCPToken
  | MCPToken[]
  | DataReflection
  | SyncConfig[]
  | Script[]
  | Script
  | PagedResponseImpl<any>
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
>;

export type InternalPOSTResponseType = Promise<
  | void
  | boolean
  | MCPToken
  | DataReflection
  | Dashboard
  | Widget
  | OAuthClient
  | Workflow
  | { id: JobId; secret?: string }
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

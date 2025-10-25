import type { TestConnectionResponse } from '@noco-local-integrations/core';
import type { PagedResponseImpl } from '~/helpers/PagedResponse';
import type {
  DataReflection,
  Integration,
  MCPToken,
  OAuthClient,
  Script,
  SyncConfig,
} from '~/models';
import type Dashboard from '~/models/Dashboard';
import type Widget from '~/models/Widget';
import type { JobId } from 'bull';
import type {
  TeamDetailV3Type,
  TeamMemberV3ResponseType,
  TeamV3ResponseType,
} from '~/services/v3/teams-v3.types';

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
  | { list: TeamV3ResponseType[] }
  | TeamDetailV3Type
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
>;

export type InternalPOSTResponseType = Promise<
  | void
  | boolean
  | MCPToken
  | DataReflection
  | Dashboard
  | Widget
  | OAuthClient
  | { id: JobId; secret?: string }
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
  | { msg: string }
>;

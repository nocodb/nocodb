import type { TestConnectionResponse } from '@noco-local-integrations/core';
import type { PagedResponseImpl } from '~/helpers/PagedResponse';
import type {
  DataReflection,
  Integration,
  MCPToken,
  Script,
  SyncConfig,
} from '~/models';
import type Dashboard from '~/models/Dashboard';
import type Widget from '~/models/Widget';
import type { JobId } from 'bull';

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
  | Widget[]
  | {
      data: any;
    }
>;

export type InternalPOSTResponseType = Promise<
  | void
  | boolean
  | MCPToken
  | DataReflection
  | Dashboard
  | Widget
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
>;

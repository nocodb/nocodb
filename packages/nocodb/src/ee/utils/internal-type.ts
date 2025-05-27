import type { TestConnectionResponse } from '@noco-local-integrations/core';
import type { PagedResponseImpl } from '~/helpers/PagedResponse';
import type {
  DataReflection,
  Integration,
  MCPToken,
  Script,
  SyncConfig,
} from '~/models';
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
>;

export type InternalPOSTResponseType = Promise<
  | void
  | boolean
  | MCPToken
  | DataReflection
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
>;

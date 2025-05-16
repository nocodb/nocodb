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
>;

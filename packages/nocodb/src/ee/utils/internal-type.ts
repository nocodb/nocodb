import type {
  DataReflection,
  Integration,
  MCPToken,
  SyncConfig,
} from '~/models';
import type { JobId } from 'bull';

export type InternalGETResponseType = Promise<
  void | MCPToken | MCPToken[] | DataReflection | SyncConfig[]
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
>;

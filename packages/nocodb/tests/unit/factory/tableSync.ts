import { TableSyncStatus } from 'nocodb-sdk';
import { internalGet, internalPost } from '~test/factory/internal';
import TableSync from '~/models/TableSync';

/**
 * Test fixtures for the realtime table-sync feature.
 * Thin wrappers over {@link internalGet}/{@link internalPost} keyed to the
 * `tableSync*` internal operations.
 */

type Ctx = { app: any; xc_token: string; tabId?: string };
type Env = { workspaceId: string; baseId: string };

export interface CreateTableSyncBody {
  title: string;
  source_workspace_id: string;
  source_base_id: string;
  source_table_id: string;
  source_view_id: string;
  selected_fields?: string[] | null;
  link_view_by_column?: Record<string, string>;
  on_delete_action?: string;
  sync_trigger?: string;
  source_input_mode?: string;
  password?: string;
}

export const tableSyncCreate = (
  ctx: Ctx,
  env: Env,
  body: CreateTableSyncBody,
) => internalPost(ctx, env, { operation: 'tableSyncCreate' }, body);

export const tableSyncList = (ctx: Ctx, env: Env) =>
  internalGet(ctx, env, { operation: 'tableSyncList' });

export const tableSyncGet = (ctx: Ctx, env: Env, syncId: string) =>
  internalGet(ctx, env, { operation: 'tableSyncGet', tableSyncId: syncId });

export const tableSyncSourceSchema = (ctx: Ctx, env: Env, syncId: string) =>
  internalGet(ctx, env, {
    operation: 'tableSyncSourceSchema',
    tableSyncId: syncId,
  });

export const tableSyncUpdate = (
  ctx: Ctx,
  env: Env,
  syncId: string,
  body: Record<string, any>,
) =>
  internalPost(
    ctx,
    env,
    { operation: 'tableSyncUpdate', tableSyncId: syncId },
    body,
  );

export const tableSyncFreeze = (ctx: Ctx, env: Env, syncId: string) =>
  internalPost(ctx, env, {
    operation: 'tableSyncFreeze',
    tableSyncId: syncId,
  });

export const tableSyncResume = (ctx: Ctx, env: Env, syncId: string) =>
  internalPost(ctx, env, {
    operation: 'tableSyncResume',
    tableSyncId: syncId,
  });

export const tableSyncDelete = (
  ctx: Ctx,
  env: Env,
  syncId: string,
  { dropTables = false }: { dropTables?: boolean } = {},
) =>
  internalPost(
    ctx,
    env,
    { operation: 'tableSyncDelete', tableSyncId: syncId },
    { dropTables },
  );

/**
 * Poll the TableSync row until its status leaves `syncing` — the processor
 * flips it to `active` on success and `error` on failure. Returns the final
 * sync. Throws after `timeoutMs` to avoid hanging tests on a stuck job.
 *
 * Default ceiling is generous (60s): the resync is a real async job, and a
 * loaded box (parallel suites, shared Postgres) routinely pushes a healthy
 * job past 30s. A genuinely stuck job still fails — just later — and every
 * caller carries a >=120s mocha timeout to absorb it.
 */
export const waitForSyncSettled = async (
  env: Env,
  syncId: string,
  { timeoutMs = 60_000, pollMs = 50 }: { timeoutMs?: number; pollMs?: number } = {},
): Promise<TableSync> => {
  const ctx = { workspace_id: env.workspaceId, base_id: env.baseId };
  const deadline = Date.now() + timeoutMs;
  let last: TableSync | null = null;
  while (Date.now() < deadline) {
    last = await TableSync.get(ctx, syncId);
    if (last && last.status !== TableSyncStatus.Syncing) return last;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(
    `Sync ${syncId} did not settle within ${timeoutMs}ms · last status: ${last?.status} · last_error: ${last?.last_error}`,
  );
};

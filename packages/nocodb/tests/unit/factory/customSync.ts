import { knex as createKnex } from 'knex';
import {
  IntegrationsType,
  SyncCategory,
  SyncTrigger,
} from 'nocodb-sdk';
import request from 'supertest';
import { internalGet, internalPost } from '~test/factory/internal';
import { SyncConfig } from '~/models';
import type { Knex } from 'knex';
import type { OnDeleteAction, SyncType } from 'nocodb-sdk';

/**
 * Test fixtures for custom (external-DB) sync — the EE app-sync flavour driven
 * by `SyncConfig`/`SyncMapping` + a `postgres-sync` integration. The "external"
 * source is a throwaway schema created inside the unit-test PG itself, accessed
 * through a real `postgres-auth` integration, so the whole pipeline
 * (introspection → table creation → job-based data sync) runs exactly as in
 * production.
 *
 * NOTE: the postgres-auth SSRF guard rejects localhost — suites must set
 * `process.env.NC_ALLOW_LOCAL_EXTERNAL_DBS = 'true'` before creating syncs.
 */

type Ctx = { app: any; xc_token: string };
type Env = { workspaceId: string; baseId: string };

/** Connection params of the unit-test PG (meta DB) — used as the sync source. */
export function sourceConnection(context: any) {
  return context.dbConfig.connection as {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
}

/** Knex handle on the unit-test PG for seeding/mutating the sync SOURCE schema. */
export function sourceKnex(context: any): Knex {
  return createKnex({
    client: 'pg',
    connection: sourceConnection(context),
    pool: { min: 1, max: 2 },
  });
}

/** Create a `postgres-auth` integration pointing back at the unit-test PG. */
export async function createPgAuthIntegration(
  context: any,
  title = 'CustomSyncAuth',
) {
  const conn = sourceConnection(context);

  const res = await request(context.app)
    .post(`/api/v2/meta/workspaces/${context.fk_workspace_id}/integrations`)
    .set('xc-auth', context.token)
    .send({
      title,
      type: IntegrationsType.Auth,
      sub_type: 'postgres',
      config: {
        host: conn.host,
        port: conn.port,
        username: conn.user,
        password: conn.password,
        database: conn.database,
      },
    })
    .expect(201);

  return res.body as { id: string };
}

/** The `IntegrationReqType`-shaped sync-integration config createSync expects. */
export function buildSyncIntegrationConfig(args: {
  authIntegrationId: string;
  schema: string;
  tables: string[];
  custom_schema?: Record<string, any>;
  title?: string;
}) {
  const { title, ...config } = args;

  return {
    type: IntegrationsType.Sync,
    sub_type: 'postgres',
    title: title ?? `CustomSync ${args.schema}`,
    config,
  };
}

/**
 * Introspect the source via the same internal op the UI's schema-mapping step
 * uses. Returns the `custom_schema` (incl. auto-detected `systemFields`).
 */
export async function fetchDestinationSchema(
  ctx: Ctx,
  env: Env,
  integration: ReturnType<typeof buildSyncIntegrationConfig>,
): Promise<Record<string, any>> {
  const res = await internalPost(
    ctx,
    env,
    { operation: 'syncIntegrationFetchDestinationSchema' },
    { integration },
  ).expect(200);

  return res.body;
}

export async function createCustomSync(
  ctx: Ctx,
  env: Env,
  args: {
    title: string;
    sync_type: SyncType;
    on_delete_action: OnDeleteAction;
    integration: ReturnType<typeof buildSyncIntegrationConfig>;
  },
) {
  const res = await internalPost(
    ctx,
    env,
    { operation: 'createSync' },
    {
      title: args.title,
      sync_type: args.sync_type,
      sync_trigger: SyncTrigger.Manual,
      on_delete_action: args.on_delete_action,
      sync_category: SyncCategory.CUSTOM,
      configs: [args.integration],
      meta: { sync_all_models: true, sync_excluded_models: [] },
    },
  ).expect(200);

  return res.body as { syncConfig: any; job: { id: string } };
}

export async function readSyncConfig(ctx: Ctx, env: Env, syncConfigId: string) {
  const res = await internalGet(ctx, env, {
    operation: 'readSync',
    id: syncConfigId,
  }).expect(200);

  return res.body;
}

export async function listSyncConfigs(ctx: Ctx, env: Env) {
  const res = await internalGet(ctx, env, { operation: 'listSync' }).expect(
    200,
  );

  return res.body as any[];
}

/**
 * Poll the SyncConfig row until a sync run COMPLETES: the processor stamps
 * `last_sync_at` and clears `sync_job_id` only at the end of a successful run.
 * Pass the pre-run `last_sync_at` so re-runs wait for a NEW completion instead
 * of matching the previous one. Throws on timeout (which is also how a failed
 * run surfaces — errors clear `sync_job_id` without advancing `last_sync_at`).
 */
export async function waitForSyncRun(
  env: Env,
  syncConfigId: string,
  prevLastSyncAt: string | null,
  { timeoutMs = 60_000, pollMs = 100 }: { timeoutMs?: number; pollMs?: number } = {},
): Promise<SyncConfig> {
  const ctx = { workspace_id: env.workspaceId, base_id: env.baseId };
  const deadline = Date.now() + timeoutMs;
  let last: SyncConfig | null = null;

  while (Date.now() < deadline) {
    last = await SyncConfig.get(ctx, syncConfigId);
    if (
      last &&
      !last.sync_job_id &&
      last.last_sync_at &&
      `${last.last_sync_at}` !== `${prevLastSyncAt}`
    ) {
      return last;
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }

  throw new Error(
    `Custom sync ${syncConfigId} did not complete within ${timeoutMs}ms ` +
      `(sync_job_id=${last?.sync_job_id}, last_sync_at=${last?.last_sync_at}, prev=${prevLastSyncAt})`,
  );
}

/** Trigger a manual sync run and wait for it to complete. */
export async function triggerSyncAndWait(
  ctx: Ctx,
  env: Env,
  syncConfigId: string,
) {
  const before = await SyncConfig.get(
    { workspace_id: env.workspaceId, base_id: env.baseId },
    syncConfigId,
  );

  await internalPost(
    ctx,
    env,
    { operation: 'triggerSync' },
    { id: syncConfigId, bulk: true },
  ).expect(200);

  return waitForSyncRun(env, syncConfigId, before?.last_sync_at ?? null);
}

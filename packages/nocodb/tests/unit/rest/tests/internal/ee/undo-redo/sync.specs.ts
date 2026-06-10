import { expect } from 'chai';
import request from 'supertest';
import { ViewTypes } from 'nocodb-sdk';
import type { Context, RoundTripSpec, TestEnv } from './harness';
import { createProject } from '~test/factory/base';
import { createTable } from '~test/factory/table';
import { createView } from '~test/factory/view';
import {
  tableSyncCreate,
  tableSyncDelete,
  waitForSyncSettled,
} from '~test/factory/tableSync';
import { isPgData } from '~test/init/db';
import TableSync from '~/models/TableSync';
import { baseScope } from '~test/rest/tests/internal/ee/undo-redo/shared';

/**
 * Matrix-layer smoke for Table Sync undo/redo: create + delete round-trips,
 * uniform with the rest of the per-entity matrix. The deep cases (field-level
 * update, drop-tables, freeze/resume) live in the dedicated
 * `ee/tableSyncUndoRedo.test.ts`, which has more room for the two-base +
 * shared-view fixture and custom assertions.
 *
 * `env` (the harness base) is the sync DESTINATION; `setup` spins up a separate
 * SOURCE base + table + share-enabled grid view. Table sync is PG-only, so each
 * spec skips on a non-PG data DB. App Sync (integration-based) isn't covered —
 * it needs a live external integration to drive `custom_schema`, which the unit
 * harness can't stand up.
 */

interface SyncSourceFx {
  sourceWorkspaceId: string;
  sourceBaseId: string;
  sourceTableId: string;
  sourceViewId: string;
}

/** Create a SOURCE base + table + share-enabled grid view (the sync source).
 *  Runs untraced (via the harness), so it never pollutes the undo stack. */
async function setupSyncSource(
  ctx: Context,
  env: TestEnv,
): Promise<SyncSourceFx> {
  const sourceBase = await createProject(ctx, { title: `SyncSrc_${Date.now()}` });
  const sourceTable = await createTable(ctx, sourceBase, {
    table_name: `Src_${Date.now()}`,
    title: `Src_${Date.now()}`,
  });
  const sourceView = await createView(ctx, {
    title: 'SyncFeed',
    table: sourceTable,
    type: ViewTypes.GRID,
  });
  // Enabling allow_sync auto-shares the grid view (assigns a uuid) so it can be
  // used as a sync source.
  await request(ctx.app)
    .patch(`/api/v2/meta/views/${sourceView.id}`)
    .set('xc-auth', ctx.token)
    .send({ allow_sync: true })
    .expect(200);

  return {
    sourceWorkspaceId: env.workspaceId,
    sourceBaseId: sourceBase.id,
    sourceTableId: sourceTable.id,
    sourceViewId: sourceView.id,
  };
}

function createBody(fx: SyncSourceFx, title: string) {
  return {
    title,
    source_workspace_id: fx.sourceWorkspaceId,
    source_base_id: fx.sourceBaseId,
    source_table_id: fx.sourceTableId,
    source_view_id: fx.sourceViewId,
  };
}

async function syncExists(env: TestEnv, syncId: string): Promise<boolean> {
  // `TableSync.get` returns null for a soft-deleted (trashed) sync, so this
  // doubles as the "is it in trash" check after a delete/undo.
  const sync = await TableSync.get(
    { workspace_id: env.workspaceId, base_id: env.baseId },
    syncId,
  ).catch(() => null);
  return !!sync;
}

const skipOnNonPg = (ctx: Context) => !isPgData(ctx);

// ── Create → undo (delete to trash) → redo (restore from trash, id-stable) ──
export const tableSyncCreateSpec: RoundTripSpec<SyncSourceFx> = {
  forward_op: 'tableSyncCreate',
  skipIf: skipOnNonPg,
  setup: setupSyncSource,
  forward: async (ctx, env, fx) => {
    const res = await tableSyncCreate(ctx, env, createBody(fx, `Sync_${Date.now()}`));
    if (res.status === 200 || res.status === 201) {
      // The dest mirror table is created by a job — wait so the create is fully
      // applied before the undo trashes it.
      await waitForSyncSettled(env, res.body.id);
    }
    return res;
  },
  entityId: (r) => r.body.id,
  scope: (env) => baseScope(env),
  // create-redo restores the sync from trash (consumes the trash entry).
  skipDoubleCycle: true,
  assertExists: async (_ctx, env, _fx, id) => {
    expect(await syncExists(env, id), `sync ${id} should exist`).to.equal(true);
  },
  assertGone: async (_ctx, env, _fx, id) => {
    expect(await syncExists(env, id), `sync ${id} should be gone`).to.equal(false);
  },
};

interface SyncDeleteFx extends SyncSourceFx {
  syncId: string;
}

async function setupExistingSync(
  ctx: Context,
  env: TestEnv,
): Promise<SyncDeleteFx> {
  const fx = await setupSyncSource(ctx, env);
  const res = await tableSyncCreate(ctx, env, createBody(fx, `SyncDel_${Date.now()}`));
  expect(
    res.status,
    `setup tableSyncCreate: ${JSON.stringify(res.body).slice(0, 300)}`,
  ).to.be.oneOf([200, 201]);
  await waitForSyncSettled(env, res.body.id);
  return { ...fx, syncId: res.body.id };
}

// ── Delete (soft, keep tables) → undo (restore from trash) → redo (delete) ──
export const tableSyncDeleteSpec: RoundTripSpec<SyncDeleteFx> = {
  forward_op: 'tableSyncDelete',
  forwardIsDelete: true,
  skipIf: skipOnNonPg,
  setup: setupExistingSync,
  forward: (ctx, env, fx) =>
    tableSyncDelete(ctx, env, fx.syncId, { dropTables: false }),
  entityId: (_r, fx) => fx.syncId,
  scope: (env) => baseScope(env),
  // delete → undo(trashRestore) consumes the trash entry.
  skipDoubleCycle: true,
  assertExists: async (_ctx, env, fx) => {
    expect(
      await syncExists(env, fx.syncId),
      `sync ${fx.syncId} should exist`,
    ).to.equal(true);
  },
  assertGone: async (_ctx, env, fx) => {
    expect(
      await syncExists(env, fx.syncId),
      `sync ${fx.syncId} should be soft-deleted`,
    ).to.equal(false);
  },
};

export const syncSpecs: RoundTripSpec<any>[] = [
  tableSyncCreateSpec,
  tableSyncDeleteSpec,
];

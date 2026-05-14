import { expect } from 'chai';
import type { Context, RoundTripSpec, TestEnv } from './harness';
import { internalPost } from '~test/factory/internal';
import { createTable } from '~test/factory/v3';
import { Permission } from '~/models';
import {
  PermissionEntity,
  PermissionGrantedType,
  PermissionKey,
  PermissionRole,
} from 'nocodb-sdk';

export const permissionSetSpec: RoundTripSpec<{ tableId: string }> = {
  forward_op: 'permissionSet',
  setup: async (ctx, env) => {
    const t = await createTable(ctx, env, `ptbl_${Date.now()}`);
    return { tableId: t.id };
  },
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'setPermission' },
      {
        entity: PermissionEntity.TABLE,
        entity_id: fx.tableId,
        permission: PermissionKey.TABLE_RECORD_ADD,
        granted_type: PermissionGrantedType.ROLE,
        granted_role: PermissionRole.EDITOR,
      }
    ),
  entityId: (_r, fx) => fx.tableId,
  // PermissionSetContract's undo.scope returns scopeBase — the log row sits on
  // the base stack, not the table stack.
  scope: (env) => [{ type: 'base', id: env.baseId }],
  // First-set inverse is permissionDrop. On redo, the row is re-created.
  // Double-cycle then re-runs the original permissionSet, which hits the
  // `prev` branch (because the row exists at that point) — the inverse is
  // now another permissionSet, not permissionDrop. assertGone after the
  // second undo would still find the row (restored to prev state), not be
  // absent. Skip double-cycle.
  skipDoubleCycle: true,
  assertExists: async (_ctx, env, fx) => {
    const p = await Permission.getByEntity(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      PermissionEntity.TABLE,
      fx.tableId,
      PermissionKey.TABLE_RECORD_ADD,
    );
    expect(!!p).to.equal(true);
  },
  assertGone: async (_ctx, env, fx) => {
    const p = await Permission.getByEntity(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      PermissionEntity.TABLE,
      fx.tableId,
      PermissionKey.TABLE_RECORD_ADD,
    );
    expect(!!p).to.equal(false);
  },
};

interface PermissionDropFx {
  tableId: string;
}

async function setupSeededPermission(
  ctx: Context,
  env: TestEnv,
): Promise<PermissionDropFx> {
  const t = await createTable(ctx, env, `pdtbl_${Date.now()}`);
  const r = await internalPost(
    ctx,
    env,
    { operation: 'setPermission' },
    {
      entity: PermissionEntity.TABLE,
      entity_id: t.id,
      permission: PermissionKey.TABLE_RECORD_ADD,
      granted_type: PermissionGrantedType.ROLE,
      granted_role: PermissionRole.EDITOR,
    },
  );
  expect(r.status, `seed setPermission: ${JSON.stringify(r.body)}`).to.eq(200);
  return { tableId: t.id };
}

export const permissionDropSpec: RoundTripSpec<PermissionDropFx> = {
  forward_op: 'permissionDrop',
  forwardIsDelete: true,
  setup: setupSeededPermission,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'dropPermission' },
      {
        entity: PermissionEntity.TABLE,
        entity_id: fx.tableId,
        permission: PermissionKey.TABLE_RECORD_ADD,
      },
    ),
  entityId: (_r, fx) => fx.tableId,
  // PermissionDropContract.undo.scope returns scopeBase.
  scope: (env) => [{ type: 'base', id: env.baseId }],
  // Same reason as permissionSetSpec: prev state becomes the inverse,
  // and re-running the drop after redo would hit the no-op (no row) and
  // skip_if would prevent recording. Single cycle is enough.
  skipDoubleCycle: true,
  assertExists: async (_ctx, env, fx) => {
    const p = await Permission.getByEntity(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      PermissionEntity.TABLE,
      fx.tableId,
      PermissionKey.TABLE_RECORD_ADD,
    );
    expect(!!p, '[permissionDrop] row exists pre-forward').to.equal(true);
  },
  assertGone: async (_ctx, env, fx) => {
    const p = await Permission.getByEntity(
      { workspace_id: env.workspaceId, base_id: env.baseId },
      PermissionEntity.TABLE,
      fx.tableId,
      PermissionKey.TABLE_RECORD_ADD,
    );
    expect(!!p, '[permissionDrop] row gone post-forward').to.equal(false);
  },
};

interface PermissionBulkDropFx {
  tableId: string;
  permissionIds: string[];
}

async function setupTwoSeededPermissions(
  ctx: Context,
  env: TestEnv,
): Promise<PermissionBulkDropFx> {
  const t = await createTable(ctx, env, `pbtbl_${Date.now()}`);
  const ids: string[] = [];
  for (const key of [
    PermissionKey.TABLE_RECORD_ADD,
    PermissionKey.TABLE_RECORD_DELETE,
  ]) {
    const r = await internalPost(
      ctx,
      env,
      { operation: 'setPermission' },
      {
        entity: PermissionEntity.TABLE,
        entity_id: t.id,
        permission: key,
        granted_type: PermissionGrantedType.ROLE,
        granted_role: PermissionRole.EDITOR,
      },
    );
    expect(r.status, `seed setPermission ${key}: ${JSON.stringify(r.body)}`).to.eq(200);
    ids.push(r.body.id);
  }
  return { tableId: t.id, permissionIds: ids };
}

export const permissionBulkDropSpec: RoundTripSpec<PermissionBulkDropFx> = {
  forward_op: 'permissionBulkDrop',
  forwardIsDelete: true,
  setup: setupTwoSeededPermissions,
  forward: (ctx, env, fx) =>
    internalPost(
      ctx,
      env,
      { operation: 'bulkDropPermissions' },
      { permissionIds: fx.permissionIds },
    ),
  entityId: (_r, fx) => fx.permissionIds[0],
  expectNullEntityId: true,
  scope: (env) => [{ type: 'base', id: env.baseId }],
  skipDoubleCycle: true,
  assertExists: async (_ctx, env, fx) => {
    // After undo: both restored.
    for (const key of [
      PermissionKey.TABLE_RECORD_ADD,
      PermissionKey.TABLE_RECORD_DELETE,
    ]) {
      const p = await Permission.getByEntity(
        { workspace_id: env.workspaceId, base_id: env.baseId },
        PermissionEntity.TABLE,
        fx.tableId,
        key,
      );
      expect(!!p, `[permissionBulkDrop] ${key} restored`).to.equal(true);
    }
  },
  assertGone: async (_ctx, env, fx) => {
    // After forward: both gone.
    for (const key of [
      PermissionKey.TABLE_RECORD_ADD,
      PermissionKey.TABLE_RECORD_DELETE,
    ]) {
      const p = await Permission.getByEntity(
        { workspace_id: env.workspaceId, base_id: env.baseId },
        PermissionEntity.TABLE,
        fx.tableId,
        key,
      );
      expect(!!p, `[permissionBulkDrop] ${key} dropped`).to.equal(false);
    }
  },
};

export const permissionSpecs: RoundTripSpec<any>[] = [
  permissionSetSpec,
  permissionDropSpec,
  permissionBulkDropSpec,
];

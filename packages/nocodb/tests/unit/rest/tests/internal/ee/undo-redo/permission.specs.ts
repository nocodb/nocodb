import { expect } from 'chai';
import type { RoundTripSpec } from './harness';
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

export const permissionSpecs: RoundTripSpec<any>[] = [permissionSetSpec];

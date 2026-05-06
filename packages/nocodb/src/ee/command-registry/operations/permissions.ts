import { PermissionEntity } from 'nocodb-sdk';
import type {
  PermissionGrantedType,
  PermissionKey,
  PermissionRole,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { OperationContract } from '~/command-registry/types';
import type { PermissionsService } from '~/ee/services/permissions.service';
import { OperationName } from '~/command-registry/op-names';
import { OperationRegistry } from '~/command-registry/registry';
import {
  makeReplayReq,
  registerForward,
} from '~/command-registry/replay-context';
import { MetaTable } from '~/utils/globals';
import { Column, Model, Permission } from '~/models';
import Document from '~/ee/models/Document';
import { permissionActions } from '~/decorators/trace-command-descriptions';
import {
  permissionBulkDropSchema,
  permissionBulkRestoreSchema,
  permissionIdentitySchema,
  permissionSetSchema,
} from '~/command-registry/operations/_schemas/permission';

interface PermissionPrev {
  granted_type: PermissionGrantedType;
  granted_role?: PermissionRole | null;
  enforce_for_automation?: boolean;
  enforce_for_form?: boolean;
  subjects?: Array<{
    type: 'user' | 'team';
    id: string;
    hierarchy_scope?: 'self_only' | 'self_and_descendants';
  }>;
}

interface PermissionExtra {
  entity?: PermissionEntity;
  prev?: PermissionPrev;
}

async function resolveEntityTitle(
  context: NcContext,
  entity: string,
  entity_id: string,
): Promise<string | undefined> {
  try {
    if (entity === PermissionEntity.TABLE) {
      const table = await Model.get(context, entity_id);
      return table?.title;
    }
    if (entity === PermissionEntity.FIELD) {
      const column = await Column.get(context, { colId: entity_id });
      return column?.title;
    }
    if (entity === PermissionEntity.DOCUMENT) {
      const doc = await Document.getMeta(context, entity_id);
      return doc?.title;
    }
  } catch {
    // best-effort lookup; titles only feed audit/changelog descriptions
  }
  return undefined;
}

function snapshotPrev(
  perm: Permission | null | undefined,
): PermissionPrev | undefined {
  if (!perm) return undefined;
  return {
    granted_type: perm.granted_type,
    granted_role: perm.granted_role ?? null,
    enforce_for_automation: perm.enforce_for_automation,
    enforce_for_form: perm.enforce_for_form,
    subjects: perm.subjects,
  };
}

export const PermissionSetContract: OperationContract<
  typeof permissionSetSchema,
  PermissionExtra,
  Permission | undefined
> = {
  name: OperationName.permissionSet,
  entity: MetaTable.PERMISSIONS,
  schema: permissionSetSchema,
  entry: {
    entity_id: (params) => params.entity_id,
    description: permissionActions.set,
    before: async (context, params) => {
      const existing = await Permission.getByEntity(
        context,
        params.entity,
        params.entity_id,
        params.permission,
      );
      const entityTitle = await resolveEntityTitle(
        context,
        params.entity,
        params.entity_id,
      );
      return {
        entityTitle,
        extra: {
          entity: params.entity,
          ...(existing ? { prev: snapshotPrev(existing) } : {}),
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prev;
      if (prev) {
        return {
          name: OperationName.permissionSet,
          params: {
            entity: params.entity,
            entity_id: params.entity_id,
            permission: params.permission,
            granted_type: prev.granted_type,
            granted_role: prev.granted_role,
            enforce_for_automation: prev.enforce_for_automation,
            enforce_for_form: prev.enforce_for_form,
            subjects: prev.subjects,
          },
        };
      }
      return {
        name: OperationName.permissionDrop,
        params: {
          entity: params.entity,
          entity_id: params.entity_id,
          permission: params.permission,
        },
      };
    },
  },
};

// Restored permissions get fresh ids on undo, so we capture the
// (entity, entity_id, permission) triple and re-resolve current ids on
// redo — using the original PK list would no-op after undo→redo.
interface PermissionBulkExtra {
  prev?: Array<{
    entity: PermissionEntity;
    entity_id: string;
    permission: PermissionKey;
    granted_type: PermissionGrantedType;
    granted_role?: PermissionRole | null;
    enforce_for_automation?: boolean;
    enforce_for_form?: boolean;
    subjects?: Array<{
      type: 'user' | 'team';
      id: string;
      hierarchy_scope?: 'self_only' | 'self_and_descendants';
    }>;
  }>;
}

export const PermissionBulkDropContract: OperationContract<
  typeof permissionBulkDropSchema,
  PermissionBulkExtra,
  void
> = {
  name: OperationName.permissionBulkDrop,
  entity: MetaTable.PERMISSIONS,
  schema: permissionBulkDropSchema,
  entry: {
    description: permissionActions.bulkDrop,
    before: async (context, params) => {
      if (!params.permissionIds?.length) return {};
      const all = await Permission.list(context, context.base_id);
      const targets = all.filter(
        (p) => p.id && params.permissionIds.includes(p.id),
      );
      if (!targets.length) return {};

      // Land triples in forward_params; service ignores extra fields.
      params.permissions = targets.map((p) => ({
        entity: p.entity,
        entity_id: p.entity_id,
        permission: p.permission,
      }));

      return {
        extra: {
          prev: targets.map((p) => ({
            entity: p.entity,
            entity_id: p.entity_id,
            permission: p.permission,
            granted_type: p.granted_type,
            granted_role: p.granted_role ?? null,
            enforce_for_automation: p.enforce_for_automation,
            enforce_for_form: p.enforce_for_form,
            subjects: p.subjects,
          })),
        },
      };
    },
    skip_if: (_context, _params, _result, resolved) =>
      !resolved?.extra?.prev?.length,
  },
  undo: {
    inverse: (_context, _params, _result, resolved) => {
      const prev = resolved?.extra?.prev;
      if (!prev?.length) return null;
      return {
        name: OperationName.permissionBulkRestore,
        params: { permissions: prev },
      };
    },
  },
};

export const PermissionBulkRestoreContract: OperationContract<
  typeof permissionBulkRestoreSchema,
  Record<string, any>,
  void
> = {
  name: OperationName.permissionBulkRestore,
  entity: MetaTable.PERMISSIONS,
  schema: permissionBulkRestoreSchema,
  entry: {
    description: permissionActions.bulkRestore,
  },
};

export const PermissionDropContract: OperationContract<
  typeof permissionIdentitySchema,
  PermissionExtra,
  void
> = {
  name: OperationName.permissionDrop,
  entity: MetaTable.PERMISSIONS,
  schema: permissionIdentitySchema,
  entry: {
    entity_id: (params) => params.entity_id,
    description: permissionActions.drop,
    before: async (context, params) => {
      const existing = await Permission.getByEntity(
        context,
        params.entity,
        params.entity_id,
        params.permission,
      );
      const entityTitle = await resolveEntityTitle(
        context,
        params.entity,
        params.entity_id,
      );
      return {
        entityTitle,
        extra: {
          entity: params.entity,
          ...(existing ? { prev: snapshotPrev(existing) } : {}),
        },
      };
    },
    // Drop with no existing row is a no-op — skip recording so undo stack stays clean.
    skip_if: (_context, _params, _result, resolved) => !resolved?.extra?.prev,
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prev;
      if (!prev) return null;
      return {
        name: OperationName.permissionSet,
        params: {
          entity: params.entity,
          entity_id: params.entity_id,
          permission: params.permission,
          granted_type: prev.granted_type,
          granted_role: prev.granted_role,
          enforce_for_automation: prev.enforce_for_automation,
          enforce_for_form: prev.enforce_for_form,
          subjects: prev.subjects,
        },
      };
    },
  },
};

interface SnapshottedPermission {
  entity: PermissionEntity;
  entity_id: string;
  permission: PermissionKey;
  granted_type: PermissionGrantedType;
  granted_role?: PermissionRole | null;
  enforce_for_automation?: boolean;
  enforce_for_form?: boolean;
  subjects?: Array<{
    type: 'user' | 'team';
    id: string;
    hierarchy_scope?: 'self_only' | 'self_and_descendants';
  }>;
}

export function registerPermissionHandlers(svc: PermissionsService): void {
  registerForward(PermissionSetContract, (context, params) =>
    svc.setPermission(context, params),
  );
  registerForward(PermissionDropContract, (context, params) =>
    svc.dropPermission(context, params),
  );

  OperationRegistry.register(
    PermissionBulkDropContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      let permissionIds = params.permissionIds ?? [];
      if (params.permissions?.length) {
        const all = await Permission.list(context, context.base_id);
        permissionIds = params.permissions
          .map(
            (t) =>
              all.find(
                (p) =>
                  p.entity === t.entity &&
                  p.entity_id === t.entity_id &&
                  p.permission === t.permission,
              )?.id,
          )
          .filter((id): id is string => !!id);
      }
      return svc.bulkDropPermissions(context, { permissionIds, req });
    },
  );

  OperationRegistry.register(
    PermissionBulkRestoreContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      const perms = params.permissions as SnapshottedPermission[];
      for (const perm of perms) {
        await svc.setPermission(context, {
          entity: perm.entity,
          entity_id: perm.entity_id,
          permission: perm.permission,
          granted_type: perm.granted_type,
          granted_role: perm.granted_role ?? undefined,
          enforce_for_automation: perm.enforce_for_automation ?? true,
          enforce_for_form: perm.enforce_for_form ?? true,
          subjects: perm.subjects,
          req,
        });
      }
    },
  );
}

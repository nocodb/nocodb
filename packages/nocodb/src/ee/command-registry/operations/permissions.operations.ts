import { z } from 'zod';
import {
  PermissionEntity,
  PermissionGrantedType,
  PermissionKey,
  PermissionRole,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { OperationContract } from 'src/command-registry/types';
import { OperationName } from '~/command-registry/op-names';
import { MetaTable } from '~/utils/globals';
import { Column, Model, Permission } from '~/models';
import Document from '~/ee/models/Document';
import { permissionActions } from '~/decorators/trace-command-descriptions';

const subjectSchema = z.object({
  type: z.enum(['user', 'team']),
  id: z.string(),
  hierarchy_scope: z.enum(['self_only', 'self_and_descendants']).optional(),
});

const permissionIdentitySchema = z.object({
  entity: z.nativeEnum(PermissionEntity),
  entity_id: z.string(),
  permission: z.nativeEnum(PermissionKey),
});

const permissionSetSchema = permissionIdentitySchema.extend({
  granted_type: z.nativeEnum(PermissionGrantedType),
  granted_role: z.nativeEnum(PermissionRole).optional().nullable(),
  enforce_for_automation: z.boolean().optional(),
  enforce_for_form: z.boolean().optional(),
  subjects: z.array(subjectSchema).optional(),
});

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
  PermissionExtra
> = {
  name: OperationName.permissionSet,
  version: 1,
  entity: MetaTable.PERMISSIONS,
  schema: permissionSetSchema,
  entityId: (p) => p.entity_id,
  description: permissionActions.set,
  resolveCtx: async (context, param) => {
    const existing = await Permission.getByEntity(
      context,
      param.entity,
      param.entity_id,
      param.permission,
    );
    const entityTitle = await resolveEntityTitle(
      context,
      param.entity,
      param.entity_id,
    );
    return {
      entityTitle,
      extra: {
        entity: param.entity,
        ...(existing ? { prev: snapshotPrev(existing) } : {}),
      },
    };
  },
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prev;
    if (prev) {
      return {
        name: OperationName.permissionSet,
        version: 1,
        params: {
          entity: p.entity,
          entity_id: p.entity_id,
          permission: p.permission,
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
      version: 1,
      params: {
        entity: p.entity,
        entity_id: p.entity_id,
        permission: p.permission,
      },
    };
  },
};

// ─── Bulk drop / restore ──────────────────────────────────────────────────
//
// `bulkDropPermissions` accepts an array of `nc_permissions.id` PK values.
// After undo restores the rows, they get fresh ids — so storing only the
// original ids in `forward_params` would make redo a no-op. To round-trip
// cleanly we capture the (entity, entity_id, permission) triple for every
// targeted row in `resolveCtx` and stash it on `param` so it lands in
// `forward_params`. The forward handler then re-resolves current ids by
// triple before calling the service.

const permissionTripleSchema = z.object({
  entity: z.nativeEnum(PermissionEntity),
  entity_id: z.string(),
  permission: z.nativeEnum(PermissionKey),
});

const permissionBulkDropSchema = z.object({
  permissionIds: z.array(z.string()),
  permissions: z.array(permissionTripleSchema).optional(),
});

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
  PermissionBulkExtra
> = {
  name: OperationName.permissionBulkDrop,
  version: 1,
  entity: MetaTable.PERMISSIONS,
  schema: permissionBulkDropSchema,
  description: permissionActions.bulkDrop,
  resolveCtx: async (context, param) => {
    if (!param.permissionIds?.length) return {};
    const all = await Permission.list(context, context.base_id);
    const targets = all.filter(
      (p) => p.id && param.permissionIds.includes(p.id),
    );
    if (!targets.length) return {};

    // Mutate the captured param so triples land in forward_params; the
    // service ignores extra fields and only reads `permissionIds`.
    (param as { permissions?: unknown }).permissions = targets.map((p) => ({
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
  // Nothing to undo when no rows actually matched.
  skipIf: (_ctx, _p, _r, resolved) => !resolved?.extra?.prev?.length,
  buildInverse: (_ctx, _p, _r, resolved) => {
    const prev = resolved?.extra?.prev;
    if (!prev?.length) return null;
    return {
      name: OperationName.permissionBulkRestore,
      version: 1,
      params: { permissions: prev },
    };
  },
};

const permissionBulkRestoreSchema = z.object({
  permissions: z.array(permissionSetSchema),
});

// Inverse-only contract — never invoked directly from the FE, only as the
// undo target of `permissionBulkDrop`. No `buildInverse`: when the user redoes
// after this, the dispatcher replays the original `permissionBulkDrop`
// forward op (whose handler re-resolves ids by triple).
export const PermissionBulkRestoreContract: OperationContract<
  typeof permissionBulkRestoreSchema
> = {
  name: OperationName.permissionBulkRestore,
  version: 1,
  entity: MetaTable.PERMISSIONS,
  schema: permissionBulkRestoreSchema,
  description: permissionActions.bulkRestore,
};

export const PermissionDropContract: OperationContract<
  typeof permissionIdentitySchema,
  PermissionExtra
> = {
  name: OperationName.permissionDrop,
  version: 1,
  entity: MetaTable.PERMISSIONS,
  schema: permissionIdentitySchema,
  entityId: (p) => p.entity_id,
  description: permissionActions.drop,
  resolveCtx: async (context, param) => {
    const existing = await Permission.getByEntity(
      context,
      param.entity,
      param.entity_id,
      param.permission,
    );
    const entityTitle = await resolveEntityTitle(
      context,
      param.entity,
      param.entity_id,
    );
    return {
      entityTitle,
      extra: {
        entity: param.entity,
        ...(existing ? { prev: snapshotPrev(existing) } : {}),
      },
    };
  },
  // Drop with no existing row is a no-op — skip recording so undo stack stays clean.
  skipIf: (_ctx, _p, _r, resolved) => !resolved?.extra?.prev,
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prev;
    if (!prev) return null;
    return {
      name: OperationName.permissionSet,
      version: 1,
      params: {
        entity: p.entity,
        entity_id: p.entity_id,
        permission: p.permission,
        granted_type: prev.granted_type,
        granted_role: prev.granted_role,
        enforce_for_automation: prev.enforce_for_automation,
        enforce_for_form: prev.enforce_for_form,
        subjects: prev.subjects,
      },
    };
  },
};

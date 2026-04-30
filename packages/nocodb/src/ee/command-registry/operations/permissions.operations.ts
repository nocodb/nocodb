import { z } from 'zod';
import type { OperationContract } from 'src/command-registry/_types';
import { OperationName } from '~/command-registry/_op-names';
import { MetaTable } from '~/utils/globals';
import { permissionActions } from '~/decorators/trace-command-descriptions';

// ─── permissionSet ────────────────────────────────────────────────────────────

const permissionSetSchema = z.object({
  permission: z.record(z.unknown()),
});

export const PermissionSetContract: OperationContract<
  typeof permissionSetSchema
> = {
  name: OperationName.permissionSet,
  version: 1,
  entity: MetaTable.PERMISSIONS,
  schema: permissionSetSchema,
  idField: 'permission',
  entityId: (_p, r) => r?.id,
  entityTitle: (p) => (p?.permission as any)?.permission,
  parentId: (p) => (p?.permission as any)?.entity_id,
  description: permissionActions.set,
};

// ─── permissionDrop ───────────────────────────────────────────────────────────

const permissionDropSchema = z.object({
  permission: z.record(z.unknown()),
});

export const PermissionDropContract: OperationContract<
  typeof permissionDropSchema
> = {
  name: OperationName.permissionDrop,
  version: 1,
  entity: MetaTable.PERMISSIONS,
  schema: permissionDropSchema,
  entityId: (p) => (p?.permission as any)?.id,
  entityTitle: (p) => (p?.permission as any)?.permission,
  description: permissionActions.drop,
};

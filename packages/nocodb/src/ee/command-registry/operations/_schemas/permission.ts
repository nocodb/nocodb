import { z } from 'zod';
import {
  PermissionEntity,
  PermissionGrantedType,
  PermissionKey,
  PermissionRole,
} from 'nocodb-sdk';

const subjectSchema = z
  .object({
    type: z.enum(['user', 'team']),
    id: z.string(),
    hierarchy_scope: z.enum(['self_only', 'self_and_descendants']).optional(),
  })
  .strict();

/** Triple that uniquely identifies a permission row by entity + key. */
export const permissionIdentitySchema = z
  .object({
    entity: z.nativeEnum(PermissionEntity),
    entity_id: z.string(),
    permission: z.nativeEnum(PermissionKey),
  })
  .strict();

/** Full set body — extends the identity triple with grant + subjects. */
export const permissionSetSchema = permissionIdentitySchema
  .extend({
    granted_type: z.nativeEnum(PermissionGrantedType),
    granted_role: z.nativeEnum(PermissionRole).nullable().optional(),
    enforce_for_automation: z.boolean().optional(),
    enforce_for_form: z.boolean().optional(),
    subjects: z.array(subjectSchema).optional(),
  })
  .strict();

export const permissionDropSchema = permissionIdentitySchema;

export const permissionBulkDropSchema = z
  .object({
    permissionIds: z.array(z.string()),
    permissions: z.array(permissionIdentitySchema).optional(),
  })
  .strict();

export const permissionBulkRestoreSchema = z
  .object({
    permissions: z.array(permissionSetSchema),
  })
  .strict();

import { z } from 'zod';
import { OnDeleteAction, SyncTrigger, SyncType } from 'nocodb-sdk';

export const appSyncDeleteSchema = z
  .object({
    syncConfigId: z.string(),
    dropTables: z.boolean().optional(),
    skipTrash: z.boolean().optional(),
  })
  .strict();

const appSyncUpdatePayloadSchema = z.object({
  title: z.string().optional(),
  sync_type: z.nativeEnum(SyncType).optional(),
  sync_trigger: z.nativeEnum(SyncTrigger).optional(),
  sync_trigger_cron: z.string().nullable().optional(),
  on_delete_action: z.nativeEnum(OnDeleteAction).optional(),
  config: z.any().optional(),
});

export const appSyncUpdateSchema = z
  .object({
    syncConfigId: z.string(),
    payload: appSyncUpdatePayloadSchema,
  })
  .strict();

export const appSyncConfigUpdateSchema = z
  .object({
    syncConfigId: z.string(),
    payload: appSyncUpdatePayloadSchema,
  })
  .strict();

export const appSyncCreateSchema = z.object({
  title: z.string().optional(),
  sync_category: z.string().optional(),
  sync_type: z.nativeEnum(SyncType).optional(),
  sync_trigger: z.nativeEnum(SyncTrigger).optional(),
  sync_trigger_cron: z.string().nullable().optional(),
  on_delete_action: z.nativeEnum(OnDeleteAction).optional(),
});

export const appSyncDetachTableSchema = z
  .object({
    modelId: z.string(),
  })
  .strict();

export const appSyncAttachTableSchema = z
  .object({
    modelId: z.string(),
    syncConfigId: z.string(),
    targetTable: z.string(),
    readonlyColIds: z.array(z.string()),
    customSchemaEntry: z.unknown().optional(),
    junctions: z
      .array(
        z.object({
          junctionId: z.string(),
          relatedReadonlyColIds: z.array(z.string()),
        }),
      )
      .optional(),
  })
  .strict();

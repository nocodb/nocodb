import { z } from 'zod';
import { filterBodySchema } from './filter';

const HOOK_EVENTS = ['view', 'field', 'after', 'before', 'manual'] as const;
const HOOK_OPERATIONS = ['insert', 'update', 'delete', 'trigger'] as const;

const boolType = z.union([z.boolean(), z.literal(0), z.literal(1)]);

const notificationSchema = z.union([z.string(), z.record(z.unknown())]);

export const hookBodySchema = z
  .object({
    // Required-by-API fields (SDK marks these mandatory):
    title: z.string().optional(),
    event: z.enum(HOOK_EVENTS).optional(),
    operation: z.array(z.enum(HOOK_OPERATIONS)).optional(),
    notification: notificationSchema.optional(),

    // Optional API fields:
    description: z.string().nullable().optional(),
    env: z.string().optional(),
    fk_model_id: z.string().optional(),
    type: z.string().nullable().optional(),
    async: boolType.optional(),
    active: boolType.optional(),
    condition: boolType.optional(),
    trigger_field: z.boolean().optional(),
    trigger_fields: z.array(z.string()).optional(),
    retries: z.number().int().nonnegative().optional(),
    retry_interval: z.number().int().nonnegative().optional(),
    timeout: z.number().int().nonnegative().optional(),
    /** SDK declares `version` for HookType but not HookReqType. Hook.ts
     *  treats it as a string column ('v2' | 'v3' in practice). */
    version: z.string().optional(),

    // Top-level columns flat-set by the v1 webhook UI; the v2 API folds
    // them into `notification`, but `Hook.update`/`Hook.insert` still
    // extract them when present (see `extractProps` lists in `Hook.ts`).
    /** Webhook target URL (v1 / direct-set form). */
    url: z.string().nullable().optional(),
    /** Webhook headers (text JSON). */
    headers: z.string().nullable().optional(),
    /** Webhook payload template (text). */
    payload: z.string().nullable().optional(),

    // Replay-time injection (idField: 'hook'):
    id: z.string().optional(),

    // Atomic save — bundled filter rows attached to this hook on create.
    // Used by `HookCreateContract.capture: ['filters']`.
    filters: z.array(filterBodySchema).optional(),
  })
  .strict();

export const hookCreateSchema = z
  .object({
    tableId: z.string(),
    hook: hookBodySchema,
  })
  .strict();

export const hookUpdateSchema = z
  .object({
    hookId: z.string(),
    hook: hookBodySchema,
  })
  .strict();

export const hookDeleteSchema = z
  .object({
    hookId: z.string(),
    skipTrash: z.boolean().optional(),
  })
  .strict();

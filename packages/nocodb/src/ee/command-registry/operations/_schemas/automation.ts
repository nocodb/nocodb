import { z } from 'zod';
import { AutomationTypes } from 'nocodb-sdk';

const boolType = z.union([z.boolean(), z.literal(0), z.literal(1), z.null()]);

const jsonOrText = z.union([z.record(z.unknown()), z.string(), z.null()]);

/** `nodes`/`edges`/`draft` are arrays of node/edge objects when parsed,
 *  text JSON when stored. Schema accepts either form. */
const arrayJsonOrText = z.union([
  z.array(z.unknown()),
  z.record(z.unknown()),
  z.string(),
  z.null(),
]);

const automationCommonFields = {
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  meta: jsonOrText.optional(),
  order: z.number().optional(),
  type: z.nativeEnum(AutomationTypes).optional(),

  // Replay-time injection (idField: 'body'):
  id: z.string().optional(),
};

export const scriptBodySchema = z
  .object({
    ...automationCommonFields,
    /** Script source (DB `script` column, text). */
    script: z.string().nullable().optional(),
    /** Script runtime config (DB `config` column, text — JSON blob). */
    config: jsonOrText.optional(),
  })
  .strict();

export const scriptCreateSchema = z
  .object({
    body: scriptBodySchema,
  })
  .strict();

export const scriptUpdateSchema = z
  .object({
    scriptId: z.string(),
    body: scriptBodySchema.optional(),
  })
  .strict();

export const scriptDeleteSchema = z
  .object({
    scriptId: z.string(),
    skipTrash: z.boolean().optional(),
  })
  .strict();

// ── Workflow ─────────────────────────────────────────────────────

export const workflowBodySchema = z
  .object({
    ...automationCommonFields,
    enabled: boolType.optional(),
    /** Workflow graph nodes (DB `nodes` column, text — JSON blob). */
    nodes: arrayJsonOrText.optional(),
    /** Workflow graph edges (DB `edges` column, text). */
    edges: arrayJsonOrText.optional(),
    /** Draft workflow state (DB `draft` column, text). */
    draft: arrayJsonOrText.optional(),
  })
  .strict();

export const workflowCreateSchema = z
  .object({
    body: workflowBodySchema.optional(),
  })
  .strict();

export const workflowUpdateSchema = z
  .object({
    workflowId: z.string(),
    body: workflowBodySchema.optional(),
  })
  .strict();

export const workflowDeleteSchema = z
  .object({
    workflowId: z.string(),
    skipTrash: z.boolean().optional(),
  })
  .strict();

export const workflowDuplicateSchema = z
  .object({
    workflowId: z.string(),
  })
  .strict();

export const workflowPublishSchema = z
  .object({
    workflowId: z.string(),
    cancelPendingExecutions: z.boolean().optional(),
  })
  .strict();

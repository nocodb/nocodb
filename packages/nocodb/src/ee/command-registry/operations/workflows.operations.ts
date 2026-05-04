import { z } from 'zod';
import type { OperationContract } from 'src/command-registry/types';
import { OperationName } from '~/command-registry/op-names';
import { MetaTable } from '~/utils/globals';
import { Workflow } from '~/models';
import {
  bWorkflow,
  workflowActions,
} from '~/decorators/trace-command-descriptions';

const workflowBodySchema = z.record(z.any()).optional();

const createSchema = z.object({
  body: workflowBodySchema,
});

export const WorkflowCreateContract: OperationContract<typeof createSchema> = {
  name: OperationName.workflowCreate,
  version: 1,
  entity: MetaTable.AUTOMATIONS,
  schema: createSchema,
  idField: 'body',
  entityId: 'id',
  entityTitle: 'title',
  description: workflowActions.add,
  buildInverse: (_ctx, _p, r) => {
    const newId = (r as { id?: string } | undefined)?.id;
    if (!newId) return null;
    return {
      name: OperationName.workflowDelete,
      version: 1,
      params: { workflowId: newId },
    };
  },
};

const WORKFLOW_PREV_FIELDS = [
  'title',
  'description',
  'enabled',
  'nodes',
  'edges',
  'meta',
  'draft',
  'order',
] as const;

interface WorkflowUpdateExtra {
  oldTitle?: string;
  prev?: Partial<Record<(typeof WORKFLOW_PREV_FIELDS)[number], unknown>>;
}

const updateSchema = z.object({
  workflowId: z.string(),
  body: workflowBodySchema,
});

export const WorkflowUpdateContract: OperationContract<
  typeof updateSchema,
  WorkflowUpdateExtra
> = {
  name: OperationName.workflowUpdate,
  version: 1,
  entity: MetaTable.AUTOMATIONS,
  schema: updateSchema,
  entityId: (p) => p.workflowId,
  entityTitle: (_p, r) => r?.title,
  description: (ctx) =>
    ctx.extra?.oldTitle && ctx.extra.oldTitle !== ctx.entityTitle
      ? workflowActions.rename(ctx)
      : workflowActions.edit(ctx),
  resolveCtx: async (context, param) => {
    const wf = await Workflow.get(context, param.workflowId);
    if (!wf) return {};
    const src = wf as unknown as Record<string, unknown>;
    const prev: Record<string, unknown> = {};
    for (const k of WORKFLOW_PREV_FIELDS) prev[k] = src[k];
    return { extra: { oldTitle: wf.title, prev } };
  },
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prev;
    if (!prev) return null;
    return {
      name: OperationName.workflowUpdate,
      version: 1,
      params: { workflowId: p.workflowId, body: prev as any },
    };
  },
};

const deleteSchema = z.object({
  workflowId: z.string(),
  skipTrash: z.boolean().optional(),
});

export const WorkflowDeleteContract: OperationContract<typeof deleteSchema> = {
  name: OperationName.workflowDelete,
  version: 1,
  entity: MetaTable.AUTOMATIONS,
  schema: deleteSchema,
  entityId: (p) => p.workflowId,
  description: workflowActions.delete,
  resolveCtx: async (context, param) => {
    const wf = await Workflow.get(context, param.workflowId);
    return { entityTitle: wf?.title };
  },
  buildInverse: (_ctx, p) => {
    if (p.skipTrash) return null;
    return {
      name: OperationName.trashRestore,
      version: 1,
      params: { resourceType: 'workflow', resourceId: p.workflowId },
    };
  },
};

const duplicateWorkflowSchema = z.object({
  workflowId: z.string(),
});

export const WorkflowDuplicateContract: OperationContract<
  typeof duplicateWorkflowSchema
> = {
  name: OperationName.workflowDuplicate,
  version: 1,
  entity: MetaTable.AUTOMATIONS,
  schema: duplicateWorkflowSchema,
  entityId: (_p, r) => r?.id,
  entityTitle: (_p, r) => r?.title,
  description: ({ entityTitle }) =>
    `Duplicate ${bWorkflow(entityTitle)} workflow`,
  resolveCtx: async (context, param) => {
    const wf = await Workflow.get(context, param.workflowId);
    return { entityTitle: wf?.title };
  },
  buildInverse: (_ctx, _p, r) => {
    const newId = (r as { id?: string } | undefined)?.id;
    if (!newId) return null;
    return {
      name: OperationName.workflowDelete,
      version: 1,
      params: { workflowId: newId },
    };
  },
};

const publishSchema = z.object({
  workflowId: z.string(),
  cancelPendingExecutions: z.boolean().optional(),
});

export const WorkflowPublishContract: OperationContract<typeof publishSchema> =
  {
    name: OperationName.workflowPublish,
    version: 1,
    entity: MetaTable.AUTOMATIONS,
    schema: publishSchema,
    entityId: (p) => p.workflowId,
    description: ({ entityTitle }) =>
      `Publish ${bWorkflow(entityTitle)} workflow`,
    resolveCtx: async (context, param) => {
      const wf = await Workflow.get(context, param.workflowId);
      return { entityTitle: wf?.title };
    },
  };

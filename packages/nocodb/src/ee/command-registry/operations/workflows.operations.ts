import { z } from 'zod';
import type { OperationContract } from 'src/command-registry/_types';
import { OperationName } from '~/command-registry/_op-names';
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
};

const updateSchema = z.object({
  workflowId: z.string(),
  body: workflowBodySchema,
});

export const WorkflowUpdateContract: OperationContract<typeof updateSchema> = {
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
    return { extra: { oldTitle: wf?.title } };
  },
};

const deleteSchema = z.object({
  workflowId: z.string(),
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

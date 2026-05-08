import type { OperationContract } from '~/command-registry/types';
import type { WorkflowsService } from '~/services/workflows.service';
import type { BaseTrashService } from '~/services/base-trash/base-trash.service';
import BaseTrash from '~/models/BaseTrash';
import { OperationName } from '~/command-registry/op-names';
import { OperationRegistry } from '~/command-registry/registry';
import {
  makeReplayReq,
  registerForward,
} from '~/command-registry/replay-context';
import { isReplay, setReplay } from '~/helpers/replayScope';
import { MetaTable } from '~/utils/globals';
import { Workflow } from '~/models';
import { pickFields } from '~/utils/tsUtils';
import {
  bWorkflow,
  workflowActions,
} from '~/decorators/trace-command-descriptions';
import {
  workflowCreateSchema,
  workflowDeleteSchema,
  workflowDuplicateSchema,
  workflowPublishSchema,
  workflowUpdateSchema,
} from '~/command-registry/operations/_schemas/automation';

export const WorkflowCreateContract: OperationContract<
  typeof workflowCreateSchema
> = {
  name: OperationName.workflowCreate,
  entity: MetaTable.AUTOMATIONS,
  schema: workflowCreateSchema,
  entry: {
    entity_id: 'id',
    entity_title: 'title',
    description: workflowActions.add,
  },
  sandbox: { id_field: 'body' },
  undo: {
    inverse: (_context, _params, result) => {
      const newId = (result as { id?: string } | undefined)?.id;
      if (!newId) return null;
      return {
        name: OperationName.workflowDelete,
        params: { workflowId: newId },
      };
    },
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
] as const satisfies readonly (keyof Workflow)[];

type WorkflowPrev = Pick<Workflow, (typeof WORKFLOW_PREV_FIELDS)[number]>;

interface WorkflowUpdateExtra {
  oldTitle?: string;
  prev?: WorkflowPrev;
}

export const WorkflowUpdateContract: OperationContract<
  typeof workflowUpdateSchema,
  WorkflowUpdateExtra
> = {
  name: OperationName.workflowUpdate,
  entity: MetaTable.AUTOMATIONS,
  schema: workflowUpdateSchema,
  entry: {
    entity_id: (params) => params.workflowId,
    entity_title: (_params, result) =>
      (result as { title?: string } | undefined)?.title,
    description: (context) =>
      context.extra?.oldTitle && context.extra.oldTitle !== context.entityTitle
        ? workflowActions.rename(context)
        : workflowActions.edit(context),
    before: async (context, params) => {
      const wf = await Workflow.get(context, params.workflowId);
      if (!wf) return {};
      return {
        extra: {
          oldTitle: wf.title,
          prev: pickFields(wf, WORKFLOW_PREV_FIELDS),
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prev;
      if (!prev) return null;
      return {
        name: OperationName.workflowUpdate,
        params: { workflowId: params.workflowId, body: prev },
      };
    },
  },
};

export const WorkflowDeleteContract: OperationContract<
  typeof workflowDeleteSchema
> = {
  name: OperationName.workflowDelete,
  entity: MetaTable.AUTOMATIONS,
  schema: workflowDeleteSchema,
  entry: {
    entity_id: (params) => params.workflowId,
    description: workflowActions.delete,
    before: async (context, params) => {
      const wf = await Workflow.get(context, params.workflowId);
      return { entityTitle: wf?.title };
    },
  },
  undo: {
    inverse: (_context, params) => {
      if (params.skipTrash) return null;
      return {
        name: OperationName.trashRestore,
        params: { resourceType: 'workflow', resourceId: params.workflowId },
      };
    },
  },
};

export const WorkflowDuplicateContract: OperationContract<
  typeof workflowDuplicateSchema
> = {
  name: OperationName.workflowDuplicate,
  entity: MetaTable.AUTOMATIONS,
  schema: workflowDuplicateSchema,
  entry: {
    entity_id: (_params, result) => (result as { id?: string } | undefined)?.id,
    entity_title: (_params, result) =>
      (result as { title?: string } | undefined)?.title,
    description: ({ entityTitle }) =>
      `Duplicate ${bWorkflow(entityTitle)} workflow`,
    before: async (context, params) => {
      const wf = await Workflow.get(context, params.workflowId);
      return { entityTitle: wf?.title };
    },
  },
  undo: {
    inverse: (_context, _params, result) => {
      const newId = (result as { id?: string } | undefined)?.id;
      if (!newId) return null;
      return {
        name: OperationName.workflowDelete,
        params: { workflowId: newId },
      };
    },
  },
};

export const WorkflowPublishContract: OperationContract<
  typeof workflowPublishSchema
> = {
  name: OperationName.workflowPublish,
  entity: MetaTable.AUTOMATIONS,
  schema: workflowPublishSchema,
  entry: {
    entity_id: (params) => params.workflowId,
    description: ({ entityTitle }) =>
      `Publish ${bWorkflow(entityTitle)} workflow`,
    before: async (context, params) => {
      const wf = await Workflow.get(context, params.workflowId);
      return { entityTitle: wf?.title };
    },
  },
};

export function registerWorkflowHandlers(
  svc: WorkflowsService,
  baseTrashSvc: BaseTrashService,
): void {
  OperationRegistry.register(
    WorkflowCreateContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      if (isReplay() && meta.entityId) {
        const trashEntry = await BaseTrash.getByResourceId(
          context,
          'workflow',
          meta.entityId,
        );
        if (trashEntry?.id) {
          await baseTrashSvc.restore(context, {
            trashId: trashEntry.id,
            user: req.user,
            req,
          });
          return { id: meta.entityId };
        }
      }
      return svc.createWorkflow(context, {
        ...params,
        req,
      } as unknown as Parameters<typeof svc.createWorkflow>[1]);
    },
  );

  registerForward(WorkflowUpdateContract, (context, params) =>
    svc.updateWorkflow(context, params),
  );
  registerForward(WorkflowDeleteContract, (context, params) =>
    svc.deleteWorkflow(context, params),
  );
  registerForward(WorkflowPublishContract, (context, params) =>
    svc.publishWorkflow(context, params),
  );

  OperationRegistry.register(
    WorkflowDuplicateContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      if (isReplay() && meta.entityId) {
        const trashEntry = await BaseTrash.getByResourceId(
          context,
          'workflow',
          meta.entityId,
        );
        if (trashEntry?.id) {
          await baseTrashSvc.restore(context, {
            trashId: trashEntry.id,
            user: req.user,
            req,
          });
          return { id: meta.entityId };
        }
      }
      // Sandbox replay threads the changelog entity_id via ALS so the
      // duplicated workflow on production keeps the same ID as on sandbox.
      if (isReplay() && meta.entityId) {
        setReplay('replayDuplicateId', meta.entityId);
      }
      return svc.duplicateWorkflow(context, {
        workflowId: params.workflowId,
        req,
      });
    },
  );
}

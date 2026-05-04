import {
  WorkflowCreateContract,
  WorkflowDeleteContract,
  WorkflowDuplicateContract,
  WorkflowPublishContract,
  WorkflowUpdateContract,
} from '../operations/workflows.operations';
import type { WorkflowsService } from '~/services/workflows.service';
import type { BaseTrashService } from '~/services/base-trash/base-trash.service';
import BaseTrash from '~/models/BaseTrash';
import { OperationRegistry } from '~/command-registry/registry';
import {
  makeReplayReq,
  registerForward,
} from '~/command-registry/replay-context';

export function registerWorkflowHandlers(
  svc: WorkflowsService,
  baseTrashSvc: BaseTrashService,
): void {
  OperationRegistry.register(
    WorkflowCreateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      if (ctx.additionalContext?.is_replay && meta.entityId) {
        const trashEntry = await BaseTrash.getByResourceId(
          ctx,
          'workflow',
          meta.entityId,
        );
        if (trashEntry?.id) {
          await baseTrashSvc.restore(ctx, {
            trashId: trashEntry.id,
            user: req.user,
            req,
          });
          return { id: meta.entityId };
        }
      }
      return svc.createWorkflow(ctx, { ...params, req } as any);
    },
  );

  registerForward(WorkflowUpdateContract, (ctx, p) =>
    svc.updateWorkflow(ctx, p),
  );
  registerForward(WorkflowDeleteContract, (ctx, p) =>
    svc.deleteWorkflow(ctx, p),
  );
  registerForward(WorkflowPublishContract, (ctx, p) =>
    svc.publishWorkflow(ctx, p),
  );

  OperationRegistry.register(
    WorkflowDuplicateContract,
    async (ctx, p, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      if (ctx.additionalContext?.is_replay && meta.entityId) {
        const trashEntry = await BaseTrash.getByResourceId(
          ctx,
          'workflow',
          meta.entityId,
        );
        if (trashEntry?.id) {
          await baseTrashSvc.restore(ctx, {
            trashId: trashEntry.id,
            user: req.user,
            req,
          });
          return { id: meta.entityId };
        }
      }
      return svc.duplicateWorkflow(ctx, {
        workflowId: p.workflowId,
        req,
        ...(meta.entityId ? { _replayWorkflowId: meta.entityId } : {}),
      });
    },
  );
}

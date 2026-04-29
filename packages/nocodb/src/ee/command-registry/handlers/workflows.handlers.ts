import { OperationRegistry } from '~/command-registry/_registry';
import { makeReplayReq } from '~/command-registry/_replay-context';
import {
  WorkflowCreateContract,
  WorkflowUpdateContract,
  WorkflowDeleteContract,
  WorkflowPublishContract,
} from '../operations/workflows.operations';
import type { WorkflowsService } from 'src/ee/services/workflows.service';

export function registerWorkflowHandlers(svc: WorkflowsService): void {
  OperationRegistry.register(
    WorkflowCreateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.createWorkflow(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    WorkflowUpdateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.updateWorkflow(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    WorkflowDeleteContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.deleteWorkflow(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    WorkflowPublishContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.publishWorkflow(ctx, { ...params, req } as any);
    },
  );
}

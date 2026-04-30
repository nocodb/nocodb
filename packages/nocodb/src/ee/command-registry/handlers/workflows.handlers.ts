import {
  WorkflowCreateContract,
  WorkflowDeleteContract,
  WorkflowPublishContract,
  WorkflowUpdateContract,
} from '../operations/workflows.operations';
import type { WorkflowsService } from '~/services/workflows.service';
import { registerForward } from '~/command-registry/replay-context';

export function registerWorkflowHandlers(svc: WorkflowsService): void {
  registerForward(WorkflowCreateContract, (ctx, p) =>
    svc.createWorkflow(ctx, p),
  );
  registerForward(WorkflowUpdateContract, (ctx, p) =>
    svc.updateWorkflow(ctx, p),
  );
  registerForward(WorkflowDeleteContract, (ctx, p) =>
    svc.deleteWorkflow(ctx, { ...p, skipTrash: true }),
  );
  registerForward(WorkflowPublishContract, (ctx, p) =>
    svc.publishWorkflow(ctx, p),
  );
}

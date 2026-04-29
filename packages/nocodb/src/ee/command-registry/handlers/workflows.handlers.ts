import { registerForward } from '~/command-registry/_replay-context';
import {
  WorkflowCreateContract,
  WorkflowUpdateContract,
  WorkflowDeleteContract,
  WorkflowPublishContract,
} from '../operations/workflows.operations';
import type { WorkflowsService } from 'src/ee/services/workflows.service';

export function registerWorkflowHandlers(svc: WorkflowsService): void {
  registerForward(WorkflowCreateContract, (ctx, p) => svc.createWorkflow(ctx, p));
  registerForward(WorkflowUpdateContract, (ctx, p) => svc.updateWorkflow(ctx, p));
  registerForward(WorkflowDeleteContract, (ctx, p) => svc.deleteWorkflow(ctx, p));
  registerForward(WorkflowPublishContract, (ctx, p) => svc.publishWorkflow(ctx, p));
}

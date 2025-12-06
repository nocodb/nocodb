import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import { WorkflowsService } from '~/services/workflows.service';
import { WorkflowExecutionService } from '~/services/workflow-execution.service';

@Injectable()
export class WorkflowGetOperations
  implements InternalApiModule<InternalGETResponseType>
{
  constructor(
    private readonly workflowsService: WorkflowsService,
    private readonly workflowExecutionService: WorkflowExecutionService,
  ) {}
  operations = [
    'workflowList' as const,
    'workflowGet' as const,
    'workflowExecutionList' as const,
    'workflowNodes' as const,
  ];
  httpMethod = 'GET' as const;

  async handle(
    context: NcContext,
    {
      req,
      operation,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload: any;
      req: NcRequest;
    },
  ): InternalGETResponseType {
    switch (operation) {
      case 'workflowList':
        return await this.workflowsService.listWorkflows(context);
      case 'workflowGet':
        return await this.workflowsService.getWorkflow(
          context,
          req.query.workflowId as string,
        );
      case 'workflowExecutionList':
        return await this.workflowsService.listExecutions(context, {
          workflowId: req.query.workflowId as string,
          limit: req.query.limit
            ? parseInt(req.query.limit as string, 10) || 25
            : 25,
          offset: req.query.offset
            ? parseInt(req.query.offset as string, 10) || 0
            : 0,
        });
      case 'workflowNodes':
        return await this.workflowExecutionService.getWorkflowNodes(context);
    }
  }
}

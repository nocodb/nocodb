import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { WorkflowsService } from '~/services/workflows.service';

@Injectable()
export class WorkflowPostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  constructor(private readonly workflowsService: WorkflowsService) {}
  operations = [
    'workflowCreate' as const,
    'workflowUpdate' as const,
    'workflowDelete' as const,
    'workflowDuplicate' as const,
    'workflowExecute' as const,
    'workflowNodeIntegrationFetchOptions' as const,
    'workflowTestNode' as const,
    'workflowPublish' as const,
  ];
  httpMethod = 'POST' as const;

  async handle(
    context: NcContext,
    {
      payload,
      req,
      operation,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload: any;
      req: NcRequest;
    },
  ): InternalPOSTResponseType {
    switch (operation) {
      case 'workflowCreate':
        return await this.workflowsService.createWorkflow(
          context,
          payload,
          req,
        );
      case 'workflowUpdate':
        return await this.workflowsService.updateWorkflow(
          context,
          payload.workflowId,
          payload,
          req,
        );
      case 'workflowDelete':
        return await this.workflowsService.deleteWorkflow(
          context,
          payload.workflowId,
          req,
        );

      case 'workflowDuplicate':
        return await this.workflowsService.duplicateWorkflow(
          context,
          payload.workflowId,
          req,
        );
      case 'workflowExecute':
        return await this.workflowsService.execute(
          context,
          payload.workflowId,
          {
            triggerData: payload.triggerData,
            triggerNodeTitle: payload.triggerNodeTitle,
          },
          req,
        );
      case 'workflowNodeIntegrationFetchOptions':
        return await this.workflowsService.integrationFetchOptions(context, {
          integration: payload.integration,
          key: payload.key,
        });
      case 'workflowTestNode':
        return await this.workflowsService.testExecuteNode(
          context,
          payload.workflowId,
          {
            nodeId: payload.nodeId,
            testTriggerData: payload.testTriggerData,
          },
        );
      case 'workflowPublish':
        return await this.workflowsService.publishWorkflow(
          context,
          payload.workflowId,
          req,
        );
    }
  }
}

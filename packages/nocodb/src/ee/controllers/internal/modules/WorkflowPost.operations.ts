import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { WorkflowsService } from '~/services/workflows.service';
import { WorkflowSubscribersService } from '~/services/workflow-subscribers.service';

@Injectable()
export class WorkflowPostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  constructor(
    private readonly workflowsService: WorkflowsService,
    private readonly workflowSubscribersService: WorkflowSubscribersService,
  ) {}
  operations = [
    'workflowCreate' as const,
    'workflowUpdate' as const,
    'workflowDelete' as const,
    'workflowDuplicate' as const,
    'workflowExecute' as const,
    'workflowNodeIntegrationFetchOptions' as const,
    'workflowTestNode' as const,
    'workflowPublish' as const,
    'workflowAddSubscribers' as const,
    'workflowRemoveSubscriber' as const,
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
          searchQuery: payload.searchQuery,
        });
      case 'workflowTestNode':
        return await this.workflowsService.testExecuteNode(
          context,
          payload.workflowId,
          {
            nodeId: payload.nodeId,
            testTriggerData: payload.testTriggerData,
            testMode: payload.testMode,
          },
          req,
        );
      case 'workflowPublish':
        return await this.workflowsService.publishWorkflow(
          context,
          payload.workflowId,
          req,
          {
            cancelPendingExecutions: payload.cancelPendingExecutions,
          },
        );
      case 'workflowAddSubscribers':
        return await this.workflowSubscribersService.addSubscribers(
          context,
          payload.workflowId,
          payload.userIds,
        );
      case 'workflowRemoveSubscriber':
        return await this.workflowSubscribersService.removeSubscriber(
          context,
          payload.subscriberId,
        );
    }
  }
}

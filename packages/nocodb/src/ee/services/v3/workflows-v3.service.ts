import { Injectable } from '@nestjs/common';
import { PlanFeatureTypes } from 'nocodb-sdk';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  WorkflowExecutionV3GetResponseType,
  WorkflowExecutionV3ListResponseType,
  WorkflowV3CreateReqType,
  WorkflowV3ExecuteReqType,
  WorkflowV3GetResponseType,
  WorkflowV3ListResponseType,
  WorkflowV3TestNodeReqType,
  WorkflowV3UpdateReqType,
} from '~/services/v3/workflows-v3.types';
import type { Workflow, WorkflowExecution } from '~/models';
import { WorkflowsService } from '~/services/workflows.service';
import { builderGenerator } from '~/utils/api-v3-data-transformation.builder';
import { validatePayload } from '~/helpers';
import { checkForFeature } from '~/helpers/paymentHelpers';
import { NcError } from '~/helpers/catchError';

const workflowBuilder = builderGenerator<Workflow, WorkflowV3GetResponseType>({
  allowed: [
    'id',
    'title',
    'description',
    'base_id',
    'fk_workspace_id',
    'enabled',
    'nodes',
    'edges',
    'draft',
    'meta',
    'order',
    'created_at',
    'updated_at',
    'created_by',
    'updated_by',
  ],
  mappings: {
    fk_workspace_id: 'workspace_id',
  },
});

const workflowListItemBuilder = builderGenerator<
  Workflow,
  WorkflowV3ListResponseType['list']
>({
  allowed: [
    'id',
    'title',
    'description',
    'base_id',
    'fk_workspace_id',
    'enabled',
    'order',
    'created_at',
    'updated_at',
    'created_by',
    'updated_by',
  ],
  mappings: {
    fk_workspace_id: 'workspace_id',
  },
});

const executionBuilder = builderGenerator<
  WorkflowExecution,
  WorkflowExecutionV3GetResponseType
>({
  allowed: [
    'id',
    'fk_workflow_id',
    'status',
    'execution_data',
    'started_at',
    'finished_at',
    'created_at',
  ],
  mappings: {
    fk_workflow_id: 'workflow_id',
  },
});

const executionListItemBuilder = builderGenerator<
  WorkflowExecution,
  WorkflowExecutionV3ListResponseType['list']
>({
  allowed: [
    'id',
    'fk_workflow_id',
    'status',
    'started_at',
    'finished_at',
    'created_at',
  ],
  mappings: {
    fk_workflow_id: 'workflow_id',
  },
});

@Injectable()
export class WorkflowsV3Service {
  constructor(private readonly workflowsService: WorkflowsService) {}

  private async validateFeatureAccess(context: NcContext) {
    await checkForFeature(
      context,
      PlanFeatureTypes.FEATURE_API_WORKFLOW_MANAGEMENT,
    );
  }

  private validateNoTestResult(
    context: NcContext,
    nodes?: { data?: { testResult?: unknown } }[],
  ) {
    if (!nodes) return;

    for (const node of nodes) {
      if (node?.data?.testResult !== undefined) {
        NcError.get(context).invalidRequestBody(
          'testResult is a read-only field and cannot be set via API',
        );
      }
    }
  }

  async workflowList(context: NcContext): Promise<WorkflowV3ListResponseType> {
    await this.validateFeatureAccess(context);

    const workflows = await this.workflowsService.listWorkflows(context);

    return {
      list: workflowListItemBuilder().build(workflows),
    };
  }

  async workflowGet(
    context: NcContext,
    id: string,
  ): Promise<WorkflowV3GetResponseType> {
    await this.validateFeatureAccess(context);

    const workflow = await this.workflowsService.getWorkflow(context, id);

    return workflowBuilder().build(workflow);
  }

  async workflowCreate(
    context: NcContext,
    body: WorkflowV3CreateReqType,
    req: NcRequest,
  ): Promise<WorkflowV3GetResponseType> {
    await this.validateFeatureAccess(context);

    validatePayload(
      'swagger-v3.json#/components/schemas/WorkflowCreateReq',
      body,
      true,
      context,
    );

    this.validateNoTestResult(context, body.nodes);

    const workflow = await this.workflowsService.createWorkflow(
      context,
      body,
      req,
    );

    return workflowBuilder().build(workflow);
  }

  async workflowUpdate(
    context: NcContext,
    id: string,
    body: WorkflowV3UpdateReqType,
    req: NcRequest,
  ): Promise<WorkflowV3GetResponseType> {
    await this.validateFeatureAccess(context);

    validatePayload(
      'swagger-v3.json#/components/schemas/WorkflowUpdateReq',
      body,
      true,
      context,
    );

    this.validateNoTestResult(context, body.nodes);
    this.validateNoTestResult(context, (body.draft as any)?.nodes);

    const workflow = await this.workflowsService.updateWorkflow(
      context,
      id,
      body,
      req,
    );

    return workflowBuilder().build(workflow);
  }

  async workflowDelete(
    context: NcContext,
    id: string,
    req: NcRequest,
  ): Promise<boolean> {
    await this.validateFeatureAccess(context);

    return await this.workflowsService.deleteWorkflow(context, id, req);
  }

  async workflowDuplicate(
    context: NcContext,
    id: string,
    req: NcRequest,
  ): Promise<WorkflowV3GetResponseType> {
    await this.validateFeatureAccess(context);

    const workflow = await this.workflowsService.duplicateWorkflow(
      context,
      id,
      req,
    );

    return workflowBuilder().build(workflow);
  }

  async workflowPublish(
    context: NcContext,
    id: string,
    req: NcRequest,
  ): Promise<WorkflowV3GetResponseType> {
    await this.validateFeatureAccess(context);

    const workflow = await this.workflowsService.publishWorkflow(
      context,
      id,
      req,
    );

    return workflowBuilder().build(workflow);
  }

  async workflowExecute(
    context: NcContext,
    id: string,
    body: WorkflowV3ExecuteReqType,
    req: NcRequest,
  ): Promise<{ id: string }> {
    await this.validateFeatureAccess(context);

    const result = await this.workflowsService.execute(
      context,
      id,
      {
        triggerData: body?.trigger_data,
      },
      req,
    );

    return { id: String(result.id) };
  }

  async workflowTestNode(
    context: NcContext,
    id: string,
    body: WorkflowV3TestNodeReqType,
    req: NcRequest,
  ): Promise<{ id: string }> {
    await this.validateFeatureAccess(context);

    validatePayload(
      'swagger-v3.json#/components/schemas/WorkflowTestNodeReq',
      body,
      true,
      context,
    );

    const result = await this.workflowsService.testExecuteNode(context, id, {
      nodeId: body.node_id,
      testTriggerData: body.test_trigger_data,
      testMode: body.test_mode,
    }, req);

    return { id: String(result.id) };
  }

  async workflowExecutionList(
    context: NcContext,
    workflowId: string,
    params: { limit?: number; offset?: number },
  ): Promise<WorkflowExecutionV3ListResponseType> {
    await this.validateFeatureAccess(context);

    const executions = await this.workflowsService.listExecutions(context, {
      workflowId,
      limit: params.limit,
      offset: params.offset,
    });

    return {
      list: executionListItemBuilder().build(executions),
    };
  }

  async workflowExecutionGet(
    context: NcContext,
    workflowId: string,
    executionId: string,
  ): Promise<WorkflowExecutionV3GetResponseType> {
    await this.validateFeatureAccess(context);

    const execution = await this.workflowsService.getExecution(context, {
      workflowId,
      executionId,
    });

    return executionBuilder().build(execution);
  }
}

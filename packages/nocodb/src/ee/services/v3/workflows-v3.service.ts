import { Injectable } from '@nestjs/common';
import { PlanFeatureTypes } from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import type { NcContext, NcRequest, WorkflowGeneralEdge } from 'nocodb-sdk';
import type {
  WorkflowExecutionV3GetResponseType,
  WorkflowExecutionV3ListResponseType,
  WorkflowNodeV3CreateReqType,
  WorkflowNodeV3ListResponseType,
  WorkflowNodeV3ResponseType,
  WorkflowNodeV3UpdateReqType,
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
    meta: 'options',
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

  // TODO: reenable when better flow has been found
  // async workflowCreate(
  //   context: NcContext,
  //   body: WorkflowV3CreateReqType,
  //   req: NcRequest,
  // ): Promise<WorkflowV3GetResponseType> {
  //   await this.validateFeatureAccess(context);

  //   validatePayload(
  //     'swagger-v3.json#/components/schemas/WorkflowCreateReq',
  //     body,
  //     true,
  //     context,
  //   );

  //   const { options, ...rest } = body;

  //   const workflow = await this.workflowsService.createWorkflow(
  //     context,
  //     { ...rest, ...(options !== undefined ? { meta: options } : {}) },
  //     req,
  //   );

  //   return workflowBuilder().build(workflow);
  // }

  // async workflowUpdate(
  //   context: NcContext,
  //   id: string,
  //   body: WorkflowV3UpdateReqType,
  //   req: NcRequest,
  // ): Promise<WorkflowV3GetResponseType> {
  //   await this.validateFeatureAccess(context);

  //   validatePayload(
  //     'swagger-v3.json#/components/schemas/WorkflowUpdateReq',
  //     body,
  //     true,
  //     context,
  //   );

  //   const { options, ...rest } = body;

  //   const workflow = await this.workflowsService.updateWorkflow(
  //     context,
  //     id,
  //     { ...rest, ...(options !== undefined ? { meta: options } : {}) },
  //     req,
  //   );

  //   return workflowBuilder().build(workflow);
  // }

  // async workflowDelete(
  //   context: NcContext,
  //   id: string,
  //   req: NcRequest,
  // ): Promise<boolean> {
  //   await this.validateFeatureAccess(context);

  //   return await this.workflowsService.deleteWorkflow(context, id, req);
  // }

  // async workflowPublish(
  //   context: NcContext,
  //   id: string,
  //   req: NcRequest,
  // ): Promise<WorkflowV3GetResponseType> {
  //   await this.validateFeatureAccess(context);

  //   const workflow = await this.workflowsService.publishWorkflow(
  //     context,
  //     id,
  //     req,
  //   );

  //   return workflowBuilder().build(workflow);
  // }

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

  // TODO: reenable when better flow has been found
  // async workflowTestNode(
  //   context: NcContext,
  //   id: string,
  //   body: WorkflowV3TestNodeReqType,
  //   req: NcRequest,
  // ): Promise<{ id: string }> {
  //   await this.validateFeatureAccess(context);

  //   validatePayload(
  //     'swagger-v3.json#/components/schemas/WorkflowTestNodeReq',
  //     body,
  //     true,
  //     context,
  //   );

  //   const result = await this.workflowsService.testExecuteNode(
  //     context,
  //     id,
  //     {
  //       nodeId: body.node_id,
  //       testTriggerData: body.test_trigger_data,
  //       testMode: body.test_mode,
  //     },
  //     req,
  //   );

  //   return { id: String(result.id) };
  // }

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

  // --- Node CRUD methods ---

  private toNodeResponse(node: any): WorkflowNodeV3ResponseType {
    return {
      id: node.id,
      type: node.type,
      position: node.position,
      data: node.data,
      targetPosition: node.targetPosition,
      sourcePosition: node.sourcePosition,
    };
  }

  private getDraftNodes(workflow: Workflow): any[] {
    return (workflow.draft as any)?.nodes || [];
  }

  private getDraftEdges(workflow: Workflow): WorkflowGeneralEdge[] {
    return (workflow.draft as any)?.edges || [];
  }

  async workflowNodeList(
    context: NcContext,
    workflowId: string,
  ): Promise<WorkflowNodeV3ListResponseType> {
    await this.validateFeatureAccess(context);

    const workflow = await this.workflowsService.getWorkflow(
      context,
      workflowId,
    );

    return {
      nodes: this.getDraftNodes(workflow).map((n) => this.toNodeResponse(n)),
      edges: this.getDraftEdges(workflow),
    };
  }

  async workflowNodeGet(
    context: NcContext,
    workflowId: string,
    nodeId: string,
  ): Promise<WorkflowNodeV3ResponseType> {
    await this.validateFeatureAccess(context);

    const workflow = await this.workflowsService.getWorkflow(
      context,
      workflowId,
    );

    const node = this.getDraftNodes(workflow).find((n) => n.id === nodeId);

    if (!node) {
      NcError.get(context).workflowNodeNotFound(nodeId);
    }

    return this.toNodeResponse(node);
  }

  async workflowNodeCreate(
    context: NcContext,
    workflowId: string,
    body: WorkflowNodeV3CreateReqType,
    req: NcRequest,
  ): Promise<WorkflowNodeV3ResponseType> {
    await this.validateFeatureAccess(context);

    validatePayload(
      'swagger-v3.json#/components/schemas/WorkflowNodeCreateReq',
      body,
      true,
      context,
    );

    this.validateNoTestResult(context, [body as any]);

    const workflow = await this.workflowsService.getWorkflow(
      context,
      workflowId,
    );

    const nodes = this.getDraftNodes(workflow);
    const edges = this.getDraftEdges(workflow);

    const nodeId = uuidv4();

    const newNode = {
      id: nodeId,
      type: body.type,
      position: body.position,
      data: body.data || {},
      targetPosition: body.targetPosition || 'top',
      sourcePosition: body.sourcePosition || 'bottom',
    };

    nodes.push(newNode);

    if (body.edges?.length) {
      edges.push(...body.edges);
    }

    await this.workflowsService.updateWorkflow(
      context,
      workflowId,
      { draft: { nodes, edges } },
      req,
    );

    return this.toNodeResponse(newNode);
  }

  async workflowNodeUpdate(
    context: NcContext,
    workflowId: string,
    nodeId: string,
    body: WorkflowNodeV3UpdateReqType,
    req: NcRequest,
  ): Promise<WorkflowNodeV3ResponseType> {
    await this.validateFeatureAccess(context);

    validatePayload(
      'swagger-v3.json#/components/schemas/WorkflowNodeUpdateReq',
      body,
      true,
      context,
    );

    if (body.data) {
      this.validateNoTestResult(context, [{ data: body.data } as any]);
    }

    const workflow = await this.workflowsService.getWorkflow(
      context,
      workflowId,
    );

    const nodes = this.getDraftNodes(workflow);
    const nodeIndex = nodes.findIndex((n) => n.id === nodeId);

    if (nodeIndex === -1) {
      NcError.get(context).workflowNodeNotFound(nodeId);
    }

    const existing = nodes[nodeIndex];

    if (body.type !== undefined) existing.type = body.type;
    if (body.position !== undefined) existing.position = body.position;
    if (body.data !== undefined) existing.data = body.data;
    if (body.targetPosition !== undefined)
      existing.targetPosition = body.targetPosition;
    if (body.sourcePosition !== undefined)
      existing.sourcePosition = body.sourcePosition;

    nodes[nodeIndex] = existing;

    await this.workflowsService.updateWorkflow(
      context,
      workflowId,
      { draft: { nodes, edges: this.getDraftEdges(workflow) } },
      req,
    );

    return this.toNodeResponse(existing);
  }

  async workflowNodeDelete(
    context: NcContext,
    workflowId: string,
    nodeId: string,
    req: NcRequest,
  ): Promise<boolean> {
    await this.validateFeatureAccess(context);

    const workflow = await this.workflowsService.getWorkflow(
      context,
      workflowId,
    );

    const nodes = this.getDraftNodes(workflow);
    const nodeIndex = nodes.findIndex((n) => n.id === nodeId);

    if (nodeIndex === -1) {
      NcError.get(context).workflowNodeNotFound(nodeId);
    }

    nodes.splice(nodeIndex, 1);

    // Remove all edges connected to this node
    const edges = this.getDraftEdges(workflow).filter(
      (e) => e.source !== nodeId && e.target !== nodeId,
    );

    await this.workflowsService.updateWorkflow(
      context,
      workflowId,
      { draft: { nodes, edges } },
      req,
    );

    return true;
  }
}

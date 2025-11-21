import { Injectable } from '@nestjs/common';
import { AppEvents, EventType, generateUniqueCopyName } from 'nocodb-sdk';
import type { IntegrationReqType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { WorkflowNodeIntegration } from '@noco-local-integrations/core';
import { WorkflowExecutionService } from '~/services/workflow-execution.service';
import { NcError } from '~/helpers/catchError';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { Integration, Workflow, Workspace } from '~/models';
import { checkLimit, PlanLimitTypes } from '~/helpers/paymentHelpers';
import NocoSocket from '~/socket/NocoSocket';

@Injectable()
export class WorkflowsService {
  constructor(
    protected readonly appHooksService: AppHooksService,
    protected readonly workflowExecutionService: WorkflowExecutionService,
  ) {}

  async listWorkflows(context: NcContext) {
    return await Workflow.list(context, context.base_id);
  }

  async getWorkflow(context: NcContext, workflowId: string) {
    const workflow = await Workflow.get(context, workflowId);

    if (!workflow) {
      NcError.get(context).workflowNotFound(workflowId);
    }

    return workflow;
  }

  async createWorkflow(
    context: NcContext,
    workflowBody: Partial<Workflow>,
    req: NcRequest,
  ) {
    const workspace = await Workspace.get(context.workspace_id);

    await checkLimit({
      workspace,
      type: PlanLimitTypes.LIMIT_WORKFLOW_PER_WORKSPACE,
      message: ({ limit }) =>
        `You have reached the limit of ${limit} workflows for your plan.`,
    });

    workflowBody.title = workflowBody.title?.trim();

    const workflow = await Workflow.insert(context, {
      ...workflowBody,
      base_id: context.base_id,
      fk_workspace_id: context.workspace_id,
      created_by: req.user.id,
    });

    this.appHooksService.emit(AppEvents.WORKFLOW_CREATE, {
      workflow,
      req,
      context,
      user: req.user,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.WORKFLOW_EVENT,
        payload: {
          id: workflow.id,
          action: 'create',
          payload: workflow,
        },
      },
      context.socket_id,
    );

    return workflow;
  }

  async updateWorkflow(
    context: NcContext,
    workflowId: string,
    workflowBody: Partial<Workflow>,
    req: NcRequest,
  ) {
    const workflow = await Workflow.get(context, workflowId);

    if (!workflow) {
      NcError.get(context).workflowNotFound(workflowId);
    }

    if (workflowBody.title) {
      workflowBody.title = workflowBody.title.trim();
    }

    const updatedWorkflow = await Workflow.update(context, workflowId, {
      ...workflowBody,
      updated_by: req.user.id,
    });

    this.appHooksService.emit(AppEvents.WORKFLOW_UPDATE, {
      workflow: updatedWorkflow,
      oldWorkflow: workflow,
      context,
      user: req.user,
      req,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.WORKFLOW_EVENT,
        payload: {
          id: workflowId,
          action: 'update',
          payload: updatedWorkflow,
        },
      },
      context.socket_id,
    );

    return updatedWorkflow;
  }

  async deleteWorkflow(context: NcContext, workflowId: string, req: NcRequest) {
    const workflow = await Workflow.get(context, workflowId);

    if (!workflow) {
      NcError.get(context).workflowNotFound(workflowId);
    }

    await Workflow.delete(context, workflowId);

    this.appHooksService.emit(AppEvents.WORKFLOW_DELETE, {
      workflow,
      context,
      req,
      user: req.user,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.WORKFLOW_EVENT,
        payload: {
          id: workflowId,
          action: 'delete',
          payload: workflow,
        },
      },
      context.socket_id,
    );

    return true;
  }

  async duplicateWorkflow(
    context: NcContext,
    workflowId: string,
    req: NcRequest,
  ) {
    const workflow = await Workflow.get(context, workflowId);

    if (!workflow) {
      NcError.get(context).workflowNotFound(workflowId);
    }

    await checkLimit({
      workspaceId: context.workspace_id,
      type: PlanLimitTypes.LIMIT_WORKFLOW_PER_WORKSPACE,
      message: ({ limit }) =>
        `You have reached the limit of ${limit} workflows for your plan.`,
    });

    const existingWorkflow = await Workflow.list(context, workflow.base_id);

    const newTitle = generateUniqueCopyName(workflow.title, existingWorkflow, {
      accessor: (item) => item.title,
    });

    const newWorkflow = await Workflow.insert(context, {
      title: newTitle,
      meta: workflow.meta,
      nodes: workflow.nodes,
      edges: workflow.edges,
      description: workflow.description,
      created_by: req.user.id,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.WORKFLOW_EVENT,
        payload: {
          id: newWorkflow.id,
          action: 'create',
          payload: newWorkflow,
        },
      },
      context.socket_id,
    );

    this.appHooksService.emit(AppEvents.WORKFLOW_DUPLICATE, {
      sourceWorkflow: workflow,
      destWorkflow: newWorkflow,
      context,
      req: req,
      user: context.user,
    });

    return newWorkflow;
  }

  async execute(
    context: NcContext,
    workflowId: string,
    payload?: { triggerData?: any; triggerNodeTitle?: string },
    req?: NcRequest,
  ) {
    const workflow = await Workflow.get(context, workflowId);

    if (!workflow) {
      NcError.get(context).workflowNotFound(workflowId);
    }

    // Execute the workflow
    const executionState = await this.workflowExecutionService.executeWorkflow(
      context,
      workflow,
      payload?.triggerData,
      payload?.triggerNodeTitle,
    );

    // Emit event
    this.appHooksService.emit(AppEvents.WORKFLOW_EXECUTE, {
      workflow,
      context,
      req,
      user: req.user,
    });

    return executionState;
  }

  async integrationFetchOptions(
    context: NcContext,
    param: {
      integration: IntegrationReqType;
      key: string;
    },
  ) {
    const { integration, key } = param;

    const wfNodeWrapper = this.workflowExecutionService.getNodeWrapper(
      context,
      integration.sub_type,
      integration.config,
    );

    if (!wfNodeWrapper) {
      NcError.get(context).workflowNodeNotFound(integration.sub_type);
    }

    return await wfNodeWrapper.fetchOptions(key);
  }
}

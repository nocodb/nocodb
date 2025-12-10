import { Inject, Injectable } from '@nestjs/common';
import {
  AppEvents,
  DependencyTableType,
  EventType,
  GeneralNodeID,
  generateUniqueCopyName,
  hasWorkflowDraftChanges,
  isTriggerNode,
  TriggerActivationType,
} from 'nocodb-sdk';
import { nanoid } from 'nanoid';
import { CronExpressionParser } from 'cron-parser';
import type { OnModuleInit } from '@nestjs/common';
import type { IntegrationReqType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { extractWorkflowDependencies } from '~/services/workflows/extractDependency';
import { WorkflowExecutionService } from '~/services/workflow-execution.service';
import { NcError } from '~/helpers/catchError';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import {
  DependencyTracker,
  Workflow,
  WorkflowExecution,
  Workspace,
} from '~/models';
import { checkLimit, PlanLimitTypes } from '~/helpers/paymentHelpers';
import NocoSocket from '~/socket/NocoSocket';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { JobTypes } from '~/interface/Jobs';
import { NocoJobsService } from '~/services/noco-jobs.service';

@Injectable()
export class WorkflowsService implements OnModuleInit {
  constructor(
    protected readonly appHooksService: AppHooksService,
    protected readonly workflowExecutionService: WorkflowExecutionService,
    @Inject('JobsService') private readonly jobsService: IJobsService,
    protected readonly nocoJobsService: NocoJobsService,
  ) {}

  async onModuleInit() {
    this.nocoJobsService.jobsQueue.add(
      {
        jobName: JobTypes.WorkflowCronSchedule,
      },
      {
        jobId: JobTypes.WorkflowCronSchedule,
        repeat: { cron: '* * * * *' },
      },
    );
  }

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

    try {
      const dependencies = extractWorkflowDependencies(workflow.nodes || []);
      await DependencyTracker.trackDependencies(
        context,
        DependencyTableType.Workflow,
        workflow.id,
        dependencies,
      );
    } catch (error) {
      console.error('Failed to track workflow dependencies:', error);
    }

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

    try {
      await this.callOnDeactivateHooks(context, workflow);
    } catch (error) {
      console.error('Failed to trigger deactivation hooks:', error);
    }

    try {
      await DependencyTracker.clearDependencies(
        context,
        DependencyTableType.Workflow,
        workflowId,
      );
    } catch (error) {
      console.error('Failed to clear workflow dependencies:', error);
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

    try {
      const dependencies = extractWorkflowDependencies(newWorkflow.nodes || []);
      await DependencyTracker.trackDependencies(
        context,
        DependencyTableType.Workflow,
        newWorkflow.id,
        dependencies,
      );
    } catch (error) {
      console.error('Failed to track workflow dependencies:', error);
    }

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

  async testExecuteNode(
    context: NcContext,
    workflowId: string,
    payload: { nodeId: string; testTriggerData?: any },
  ) {
    const workflow = await Workflow.get(context, workflowId);

    if (!workflow) {
      NcError.get(context).workflowNotFound(workflowId);
    }

    return await this.workflowExecutionService.testExecuteNode(
      context,
      workflow,
      payload.nodeId,
      payload.testTriggerData,
    );
  }

  async listExecutions(
    context: NcContext,
    params: {
      workflowId?: string;
      limit?: number;
      offset?: number;
      cursorId?: string;
    },
  ) {
    const { workflowId } = params;

    if (!workflowId) {
      NcError.get(context).badRequest('Workflow ID is required');
    }

    const workflow = await Workflow.get(context, workflowId);

    if (!workflow) {
      NcError.get(context).workflowNotFound(workflowId);
    }

    return await WorkflowExecution.list(context, params);
  }

  async publishWorkflow(
    context: NcContext,
    workflowId: string,
    req: NcRequest,
  ) {
    const workflow = await Workflow.get(context, workflowId);

    if (!workflow) {
      NcError.get(context).workflowNotFound(workflowId);
    }

    if (!workflow.draft || !workflow.draft.nodes?.length) {
      NcError.get(context).badRequest('You cannot publish empty nodes');
    }

    if (!hasWorkflowDraftChanges(workflow)) {
      NcError.get(context).badRequest(
        'No draft changes to publish. Please make changes first.',
      );
    }

    const draftNodes = workflow.draft.nodes || [];
    const untested = [];
    const failed = [];

    for (const node of draftNodes) {
      if (
        [GeneralNodeID.TRIGGER, GeneralNodeID.PLUS].includes(node.type as any)
      ) {
        continue;
      }

      const testResult = node.data?.testResult;

      if (!testResult) {
        untested.push(node.data?.title || node.id);
      } else if (testResult.status !== 'success' || testResult?.isStale) {
        failed.push(node.data?.title || node.id);
      }
    }

    if (untested.length > 0) {
      NcError.get(context).badRequest(
        `The following nodes must be tested before publishing: ${untested.join(
          ', ',
        )}`,
      );
    }

    if (failed.length > 0) {
      NcError.get(context).badRequest(
        `The following nodes have failed tests: ${failed.join(
          ', ',
        )}. Please fix them before publishing.`,
      );
    }

    // Step 1: Deactivate existing external triggers
    try {
      await this.callOnDeactivateHooks(context, workflow);
    } catch (error) {
      console.error('Failed to trigger deactivation hooks:', error);
    }

    // Step 2: Clear old dependencies
    try {
      await DependencyTracker.clearDependencies(
        context,
        DependencyTableType.Workflow,
        workflowId,
      );
    } catch (error) {
      console.error('Failed to clear dependencies:', error);
    }

    // Step 3: Update workflow
    const updatedWorkflow = await Workflow.update(context, workflowId, {
      nodes: workflow.draft.nodes,
      edges: workflow.draft.edges,
      draft: null,
      updated_by: req.user.id,
    });

    // Step 4: Track new dependencies
    try {
      const dependencies = extractWorkflowDependencies(
        updatedWorkflow.nodes || [],
      );
      await DependencyTracker.trackDependencies(
        context,
        DependencyTableType.Workflow,
        updatedWorkflow.id,
        dependencies,
      );
    } catch (error) {
      console.error('Failed to track workflow dependencies:', error);
    }

    // Step 5: Activate new external triggers
    try {
      await this.callOnActivateHooks(context, updatedWorkflow, req);
    } catch (error) {
      console.error('Failed to trigger node activation hooks:', error);
    }

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

  async handleWebhookTrigger(
    context: NcContext,
    params: {
      workflowId: string;
      triggerId: string;
      req: NcRequest;
    },
  ) {
    const { workflowId, triggerId, req } = params;

    const workflow = await Workflow.get(context, workflowId);

    if (!workflow) {
      NcError.get(context).workflowNotFound(workflowId);
    }

    if (!workflow.enabled) {
      return {
        success: false,
        message: 'Workflow is disabled',
      };
    }

    const triggers = await Workflow.getExternalTriggers(
      {
        workspace_id: context.workspace_id,
        base_id: context.base_id,
      },
      workflowId,
    );

    const trigger = triggers.find((t) => t.triggerId === triggerId);

    if (!trigger) {
      return {
        success: false,
        message: 'Trigger not found',
      };
    }

    // Find the trigger node in the workflow
    const triggerNode = workflow.nodes?.find(
      (node) => node.id === trigger.nodeId,
    );

    if (!triggerNode) {
      NcError.notFound('Trigger node not found in workflow');
    }

    await this.jobsService.add(JobTypes.ExecuteWorkflow, {
      context: {
        workspace_id: context.workspace_id,
        base_id: context.base_id,
      },
      workflowId: workflow.id,
      triggerNodeId: triggerNode.id,
      triggerInputs: {
        webhook: {
          headers: req.headers,
          body: req.body,
          query: req.query,
          method: req.method,
          url: req.url,
        },
      },
    });

    return {
      success: true,
      message: 'Workflow triggered successfully',
      workflowId: workflow.id,
      executionQueued: true,
    };
  }

  /**
   * Call onActivateHook for workflow trigger nodes
   */
  private async callOnActivateHooks(
    context: NcContext,
    workflow: Workflow,
    req: NcRequest,
  ): Promise<void> {
    const nodes = workflow.nodes || [];

    const triggerNodes = nodes.filter((node) => isTriggerNode(node.type));

    if (triggerNodes.length === 0) return;

    for (const triggerNode of triggerNodes) {
      try {
        const integrationId = triggerNode.type;
        const integrationConfig = triggerNode.data?.config;
        if (!integrationId) continue;

        const wrapper = this.workflowExecutionService.getNodeWrapper(
          context,
          integrationId,
          integrationConfig,
        );

        if (!wrapper) continue;

        const definition = await wrapper.definition();
        const activationType =
          definition.activationType || TriggerActivationType.NONE;
        if (activationType === TriggerActivationType.NONE) continue;

        if (typeof wrapper.onActivateHook !== 'function') continue;

        if (activationType === TriggerActivationType.WEBHOOK) {
          await this.activateWebhookTrigger(
            context,
            workflow,
            triggerNode,
            wrapper,
            req,
          );
        } else if (activationType === TriggerActivationType.CRON) {
          await this.activateCronTrigger(
            context,
            workflow,
            triggerNode,
            wrapper,
          );
        }
      } catch (error) {
        console.error(
          `[Workflow] Failed to activate trigger for node ${triggerNode.id}:`,
          error,
        );
      }
    }
  }

  /**
   * Activate a webhook-based external trigger
   */
  private async activateWebhookTrigger(
    context: NcContext,
    workflow: Workflow,
    triggerNode: any,
    wrapper: any,
    req: NcRequest,
  ): Promise<void> {
    // Generate unique trigger ID
    const triggerId = `trg_${nanoid(16)}`;

    // Build webhook URL with RESTful path
    const webhookUrl = `${req.ncSiteUrl}/api/v3/workflows/${context.workspace_id}/${context.base_id}/${workflow.id}/${triggerId}/webhook`;

    // Call onActivateHook
    const activationState = await wrapper.onActivateHook({
      webhookUrl,
      workflowId: workflow.id,
      nodeId: triggerNode.id,
    });

    if (!activationState) return;

    // Track trigger in Workflow model with triggerId for routing
    await Workflow.trackExternalTrigger(context, workflow.id, {
      nodeId: triggerNode.id,
      nodeType: triggerNode.type,
      triggerId,
      activationState,
    });
  }

  /**
   * Activate a cron-based trigger
   */
  private async activateCronTrigger(
    context: NcContext,
    workflow: Workflow,
    triggerNode: any,
    wrapper: any,
  ): Promise<void> {
    // Call onActivateHook to get cron configuration
    const activationState = await wrapper.onActivateHook({
      workflowId: workflow.id,
      nodeId: triggerNode.id,
    });

    if (!activationState?.cronExpression) return;

    const interval = CronExpressionParser.parse(
      activationState.cronExpression,
      {
        tz: activationState.timezone,
        currentDate: new Date(),
      },
    );
    const nextSyncAt = interval.next().toISOString();

    await Workflow.trackExternalTrigger(context, workflow.id, {
      nodeId: triggerNode.id,
      nodeType: triggerNode.type,
      nextSyncAt,
      activationState,
    });
  }

  /**
   * Call onDeactivateHook for workflow trigger nodes
   */
  private async callOnDeactivateHooks(
    context: NcContext,
    workflow: Workflow,
  ): Promise<void> {
    // Get all external triggers for this workflow from Workflow model
    const triggers = await Workflow.getExternalTriggers(context, workflow.id);

    if (triggers.length === 0) return;

    for (const trigger of triggers) {
      try {
        const integrationId = trigger.nodeType;
        if (!integrationId) continue;

        const triggerNode = workflow.nodes?.find(
          (node) => node.id === trigger.nodeId,
        );
        const integrationConfig = triggerNode?.data?.config;

        const wrapper = this.workflowExecutionService.getNodeWrapper(
          context,
          integrationId,
          integrationConfig,
        );

        if (!wrapper) continue;

        if (typeof wrapper.onDeactivateHook !== 'function') continue;

        await wrapper.onDeactivateHook(
          {
            webhookUrl: '', // Not needed for deactivation
            workflowId: workflow.id,
            nodeId: trigger.nodeId,
          },
          trigger.activationState,
        );
      } catch (error) {
        console.error(
          `[Workflow] Failed to deactivate trigger for node ${trigger.nodeId}:`,
          error,
        );
      }
    }
  }
}

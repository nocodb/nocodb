import { Inject, Injectable, Logger } from '@nestjs/common';
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
  UsageStat,
  Workflow,
  WorkflowExecution,
} from '~/models';
import { checkLimit, getLimit, PlanLimitTypes } from '~/helpers/paymentHelpers';
import {
  getPlanDisplayName,
  getPlanTitleFromContext,
  isNodeAvailableForPlan,
  WorkflowNodePlanRequirements,
} from '~/helpers/workflowNodeHelpers';
import NocoSocket from '~/socket/NocoSocket';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { JobTypes } from '~/interface/Jobs';
import { NocoJobsService } from '~/services/noco-jobs.service';
import { throttleWithLast } from '~/utils/functionUtils';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

@Injectable()
export class WorkflowsService implements OnModuleInit {
  private readonly logger = new Logger(WorkflowsService.name);

  constructor(
    protected readonly appHooksService: AppHooksService,
    @Inject('WorkflowExecutionService')
    private readonly workflowExecutionService: WorkflowExecutionService,
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
    this.nocoJobsService.jobsQueue.add(
      {
        jobName: JobTypes.WorkflowResumeSchedule,
      },
      {
        jobId: JobTypes.WorkflowResumeSchedule,
        repeat: { cron: '* * * * *' },
      },
    );
  }

  /**
   * Validate that all nodes in a workflow are available for the user's plan
   * @throws NcError.planLimitExceeded if any node requires a higher plan tier
   */
  private async validateWorkflowNodeAccess(
    context: NcContext,
    nodes: any[],
  ): Promise<void> {
    if (!nodes || nodes.length === 0) {
      return;
    }

    // Get user's current plan title
    const userPlanTitle = await getPlanTitleFromContext(context);

    // Check each node for plan requirements
    for (const node of nodes) {
      const nodeType = node.type; // e.g., 'core.action.send_email'

      // Skip special nodes like Plus node and Trigger placeholder
      if (
        nodeType === GeneralNodeID.PLUS ||
        nodeType === GeneralNodeID.TRIGGER
      ) {
        continue;
      }

      if (!isNodeAvailableForPlan(nodeType, userPlanTitle)) {
        const requiredPlan = WorkflowNodePlanRequirements[nodeType];
        const requiredPlanName = getPlanDisplayName(requiredPlan);

        NcError.planLimitExceeded(
          `The workflow contains a node that requires the ${requiredPlanName} plan or higher. Please upgrade your plan to use this node.`,
          {
            plan: userPlanTitle,
          },
        );
      }
    }
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

    const existingWorkflow = await Workflow.list(context, workflow.base_id);

    const newTitle = generateUniqueCopyName(workflow.title, existingWorkflow, {
      accessor: (item) => item.title,
    });

    const newWorkflow = await Workflow.insert(context, {
      title: newTitle,
      meta: workflow.meta,
      nodes: workflow.nodes,
      edges: workflow.edges,
      draft: workflow.draft,
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

    await checkLimit({
      workspaceId: context.workspace_id,
      type: PlanLimitTypes.LIMIT_WORKFLOW_RUN,
      message: ({ limit }) =>
        `You have reached the limit of ${limit} workflow executions for your plan.`,
    });

    let executionRecord: WorkflowExecution | null = null;

    try {
      executionRecord = await WorkflowExecution.insert(context, workflowId, {
        workflow_data: {
          id: workflow.id,
          title: workflow.title,
          nodes: workflow.nodes,
          edges: workflow.edges,
        },
        finished: false,
        started_at: new Date().toISOString(),
        status: 'running',
      });

      this.broadcastExecutionEvent(
        context,
        workflowId,
        executionRecord,
        'create',
      );

      let isDone = false;

      await UsageStat.incrby(
        context.workspace_id,
        PlanLimitTypes.LIMIT_WORKFLOW_RUN,
        1,
      );

      const executionState =
        await this.workflowExecutionService.executeWorkflow(
          context,
          workflow,
          payload?.triggerData,
          payload?.triggerNodeTitle,
          throttleWithLast(async (state) => {
            if (isDone) return;
            await WorkflowExecution.update(context, executionRecord.id, {
              execution_data: state,
            });

            const updatedExecution = await WorkflowExecution.get(
              context,
              executionRecord.id,
            );
            this.broadcastExecutionEvent(
              context,
              workflowId,
              updatedExecution,
              'update',
            );
          }, 1000),
        );

      isDone = true;

      const updatedExecution = await WorkflowExecution.update(
        context,
        executionRecord.id,
        {
          execution_data: executionState,
          finished: true,
          finished_at: new Date().toISOString(),
          status: executionState.status,
          resume_at:
            executionState.status === 'waiting' && executionState.resumeAt
              ? new Date(executionState.resumeAt).toISOString()
              : undefined,
        },
      );

      this.broadcastExecutionEvent(
        context,
        workflowId,
        updatedExecution,
        'update',
      );

      this.appHooksService.emit(AppEvents.WORKFLOW_EXECUTE, {
        workflow,
        context,
        req,
        user: req.user,
      });

      return executionState;
    } catch (error) {
      this.logger.error(`Failed to execute workflow ${workflowId}:`, error);

      if (executionRecord) {
        try {
          const updatedExecution = await WorkflowExecution.update(
            context,
            executionRecord.id,
            {
              finished: true,
              finished_at: new Date().toISOString(),
              status: 'error',
              execution_data: null,
            },
          );

          this.broadcastExecutionEvent(
            context,
            workflowId,
            updatedExecution,
            'update',
          );
        } catch (updateError) {
          this.logger.error(`Failed to update execution log:`, updateError);
        }
      }

      throw error;
    }
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

    const { limit } = await getLimit(
      PlanLimitTypes.LIMIT_WORKFLOW_RETENTION,
      context.workspace_id,
    );

    const workflow = await Workflow.get(context, workflowId);

    if (!workflow) {
      NcError.get(context).workflowNotFound(workflowId);
    }

    return await WorkflowExecution.list(context, {
      ...params,
      retentionLimit: limit,
    });
  }

  async publishWorkflow(
    context: NcContext,
    workflowId: string,
    req: NcRequest,
    params?: {
      cancelPendingExecutions?: boolean;
    },
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

    // Validate workflow draft nodes are accessible for user's plan before publishing
    await this.validateWorkflowNodeAccess(context, workflow.draft.nodes);

    const pendingExecutionsCount = await WorkflowExecution.getWaitingDueCount(
      context,
      workflowId,
    );

    if (pendingExecutionsCount > 0) {
      if (params?.cancelPendingExecutions === undefined) {
        NcError.get(context).workflowWaitingExecutions(pendingExecutionsCount, {
          details: {
            count: pendingExecutionsCount,
          },
        });
      }

      if (params?.cancelPendingExecutions === true) {
        const limit = 100;
        let totalCancelled = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const executions = await Noco.ncMeta
            .knexConnection(MetaTable.AUTOMATION_EXECUTIONS)
            .where('fk_workflow_id', workflowId)
            .where('base_id', context.base_id)
            .where('fk_workspace_id', context.workspace_id)
            .where('status', 'waiting')
            .limit(limit);

          if (executions.length === 0) {
            break;
          }

          for (const execution of executions) {
            await WorkflowExecution.update(context, execution.id, {
              status: 'cancelled',
              finished: true,
              finished_at: new Date().toISOString(),
              resume_at: null,
            });

            NocoSocket.broadcastEvent(context, {
              event: EventType.WORKFLOW_EXECUTION_EVENT,
              payload: {
                id: execution.id,
                workflowId,
                action: 'update',
                payload: {
                  ...execution,
                  status: 'cancelled',
                  finished: true,
                },
              },
              scopes: [workflowId],
            });

            totalCancelled++;
          }
        }

        this.logger.debug(
          `Cancelled ${totalCancelled} pending execution(s) for workflow ${workflowId}`,
        );
      } else {
        this.logger.debug(
          `${pendingExecutionsCount} pending execution(s) will continue with previous workflow definition`,
        );
      }
    }

    const draftNodes = workflow.draft.nodes || [];
    const untested = [];
    const failed = [];

    for (const node of draftNodes) {
      // Skip non-workflow nodes (trigger, plus, and note nodes)
      if (
        [
          GeneralNodeID.TRIGGER,
          GeneralNodeID.PLUS,
          GeneralNodeID.NOTE,
        ].includes(node.type as any)
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

  private broadcastExecutionEvent(
    context: NcContext,
    workflowId: string,
    execution: WorkflowExecution,
    action: 'create' | 'update' | 'delete',
  ) {
    NocoSocket.broadcastEvent(context, {
      event: EventType.WORKFLOW_EXECUTION_EVENT,
      payload: {
        id: execution.id,
        workflowId,
        action,
        payload: execution,
      },
      scopes: [workflowId],
    });
  }
}

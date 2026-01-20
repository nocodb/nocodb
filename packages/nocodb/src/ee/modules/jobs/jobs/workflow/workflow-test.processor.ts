import { Inject, Logger } from '@nestjs/common';
import { TriggerTestMode } from 'nocodb-sdk';
import { nanoid } from 'nanoid';
import type { Job } from 'bull';
import type { TestWorkflowNodeJobData } from '~/interface/Jobs';
import { JobsLogService } from '~/modules/jobs/jobs/jobs-log.service';
import Workflow from '~/models/Workflow';
import { WorkflowExecutionService } from '~/services/workflow-execution.service';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType, CacheScope } from '~/utils/globals';

export class WorkflowTestProcessor {
  protected logger = new Logger(WorkflowTestProcessor.name);

  constructor(
    @Inject('WorkflowExecutionService')
    private readonly workflowExecutionService: WorkflowExecutionService,
    private readonly jobsLogService: JobsLogService,
  ) {}

  async testWorkflowNode(job: Job<TestWorkflowNodeJobData>) {
    const {
      context,
      workflowId,
      nodeId,
      testTriggerData,
      testMode,
      timeoutMs = 120000,
    } = job.data;

    const workflow = await Workflow.get(context, workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Prioritize draft nodes when testing
    const nodes = (workflow as any).draft?.nodes || workflow.nodes || [];
    const node = nodes.find((n: any) => n.id === nodeId);

    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    const nodeWrapper = this.workflowExecutionService.getNodeWrapper(
      context,
      node.type,
      node.data?.config,
    );

    // Determine test mode - use explicit testMode if provided, otherwise auto-detect
    let useListenWebhook = testMode === TriggerTestMode.LISTEN_WEBHOOK;
    let useTriggerEvent = testMode === TriggerTestMode.TRIGGER_EVENT;

    if (!testMode && nodeWrapper) {
      try {
        const definition = await nodeWrapper.definition();
        useListenWebhook = definition.testModes?.includes(
          TriggerTestMode.LISTEN_WEBHOOK,
        );
      } catch {
        // If we can't get definition, default to standard test
      }
    }

    // If LISTEN_WEBHOOK mode, set up listener and wait for webhook
    if (useListenWebhook) {
      return this.testWebhookListener(job, workflow, node, timeoutMs);
    }

    // If TRIGGER_EVENT mode, temporarily activate webhook and wait for event
    if (useTriggerEvent && nodeWrapper) {
      return this.testTriggerEventListener(
        job,
        workflow,
        node,
        nodeWrapper,
        timeoutMs,
      );
    }

    try {
      return await this.workflowExecutionService.testExecuteNode(
        context,
        workflow,
        nodeId,
        testTriggerData,
      );
    } catch (error) {
      return {
        nodeId,
        status: 'error',
        error: error.message || 'Test execution failed',
        input: {},
        output: {},
        startTime: Date.now(),
        endTime: Date.now(),
      };
    }
  }

  /**
   * Helper method for webhook listener testing (LISTEN_WEBHOOK mode)
   */
  private async testWebhookListener(
    job: Job<TestWorkflowNodeJobData>,
    workflow: any,
    node: any,
    timeoutMs: number,
  ) {
    const { context, workflowId, nodeId } = job.data;

    let triggerId = node.data?.triggerId;
    if (!triggerId) {
      throw new Error('Trigger ID not found');
    }

    const cacheKey = `${CacheScope.WORKFLOW_WEBHOOK_TEST_LISTENER}:${workflowId}:${triggerId}`;
    const ttlSeconds = Math.ceil(timeoutMs / 1000) + 30;

    try {
      await NocoCache.setExpiring(
        context,
        cacheKey,
        {
          status: 'listening',
          workflowId,
          nodeId,
          triggerId,
          createdAt: Date.now(),
        },
        ttlSeconds,
      );

      // Send webhook URL to frontend via job log
      this.jobsLogService.sendLog(job, {
        message: JSON.stringify({
          type: 'webhook_url',
          triggerId,
          path: `/api/v3/workflows/${context.workspace_id}/${context.base_id}/${workflowId}/${triggerId}/webhook`,
        }),
      });

      // Poll cache for webhook data
      const pollInterval = 2000;
      const startTime = Date.now();

      while (Date.now() - startTime < timeoutMs) {
        const data = await NocoCache.get(
          context,
          cacheKey,
          CacheGetType.TYPE_OBJECT,
        );

        if (data) {
          if (data.status === 'received') {
            await NocoCache.del(context, cacheKey);

            const webhookInput = {
              webhook: {
                body: data.body || {},
                headers: data.headers || {},
                query: data.query || {},
                method: data.method || 'POST',
              },
            };

            return await this.workflowExecutionService.testExecuteNode(
              context,
              workflow,
              nodeId,
              webhookInput,
            );
          }
        }

        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }

      await NocoCache.del(context, cacheKey);
      this.logger.warn(`Webhook test timed out for trigger: ${triggerId}`);

      return {
        nodeId,
        status: 'error',
        error:
          'Webhook test timed out. No request received within the time limit.',
        input: {},
        output: {},
        startTime,
        endTime: Date.now(),
      };
    } catch (error) {
      await NocoCache.del(context, cacheKey);
      this.logger.error(
        `Webhook test failed for trigger ${triggerId}:`,
        error,
      );

      return {
        nodeId,
        status: 'error',
        error: error.message || 'Webhook test failed',
        input: {},
        output: {},
        startTime: Date.now(),
        endTime: Date.now(),
      };
    }
  }

  /**
   * Helper method for TRIGGER_EVENT testing (external integrations like GitHub)
   * Temporarily activates webhook, waits for event, then deactivates
   */
  private async testTriggerEventListener(
    job: Job<TestWorkflowNodeJobData>,
    workflow: any,
    node: any,
    nodeWrapper: any,
    timeoutMs: number,
  ) {
    const { context, workflowId, nodeId, req } = job.data;

    // Generate a temporary triggerId for testing
    let triggerId = node.data?.triggerId;
    if (!triggerId) {
      throw new Error('Trigger ID not found');
    }

    const ncSiteUrl = req?.ncSiteUrl;
    if (!ncSiteUrl) {
      return {
        nodeId,
        status: 'error',
        error: 'Site URL not available for webhook registration',
        input: {},
        output: {},
        startTime: Date.now(),
        endTime: Date.now(),
      };
    }

    // Build webhook URL
    const webhookUrl = `${ncSiteUrl}/api/v3/workflows/${context.workspace_id}/${context.base_id}/${workflowId}/${triggerId}/webhook`;

    // Cache key for test listener
    const cacheKey = `${CacheScope.WORKFLOW_WEBHOOK_TEST_LISTENER}:${workflowId}:${triggerId}`;
    const ttlSeconds = Math.ceil(timeoutMs / 1000) + 30;

    let activationState: any = null;

    try {
      // Check if node has onActivateHook
      if (typeof nodeWrapper.onActivateHook !== 'function') {
        return {
          nodeId,
          status: 'error',
          error: 'This trigger does not support TRIGGER_EVENT testing',
          input: {},
          output: {},
          startTime: Date.now(),
          endTime: Date.now(),
        };
      }

      // Store listener info in cache with status 'listening'
      await NocoCache.setExpiring(
        context,
        cacheKey,
        {
          status: 'listening',
          workflowId,
          nodeId,
          triggerId,
          createdAt: Date.now(),
        },
        ttlSeconds,
      );

      // Temporarily activate the webhook with external service
      this.logger.log(
        `Activating webhook for TRIGGER_EVENT test: ${triggerId} in workflow ${workflowId}`,
      );

      activationState = await nodeWrapper.onActivateHook({
        webhookUrl,
        workflowId,
        nodeId,
      });

      // Send status to frontend via job log
      this.jobsLogService.sendLog(job, {
        message: JSON.stringify({
          type: 'trigger_event_listening',
          triggerId,
          webhookUrl,
        }),
      });

      this.logger.log(
        `TRIGGER_EVENT test listener created for ${triggerId} in workflow ${workflowId}`,
      );

      // Poll cache for webhook data (same as LISTEN_WEBHOOK)
      const pollInterval = 500;
      const startTime = Date.now();

      while (Date.now() - startTime < timeoutMs) {
        const data = await NocoCache.get(
          context,
          cacheKey,
          CacheGetType.TYPE_OBJECT,
        );

        if (data) {
          if (data.status === 'received') {
            await NocoCache.del(context, cacheKey);

            this.logger.log(
              `TRIGGER_EVENT test received data for trigger: ${triggerId}`,
            );

            // Deactivate the webhook
            await this.deactivateWebhook(
              nodeWrapper,
              activationState,
              webhookUrl,
              workflowId,
              nodeId,
              triggerId,
            );

            const webhookInput = {
              webhook: {
                body: data.body || {},
                headers: data.headers || {},
                query: data.query || {},
                method: data.method || 'POST',
              },
            };

            return await this.workflowExecutionService.testExecuteNode(
              context,
              workflow,
              nodeId,
              webhookInput,
            );
          }
        }

        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }

      // Timeout - clean up
      await NocoCache.del(context, cacheKey);

      // Deactivate the webhook
      await this.deactivateWebhook(
        nodeWrapper,
        activationState,
        webhookUrl,
        workflowId,
        nodeId,
        triggerId,
        'timeout',
      );

      this.logger.warn(
        `TRIGGER_EVENT test timed out for trigger: ${triggerId}`,
      );

      return {
        nodeId,
        status: 'error',
        error:
          'Test timed out. No event received within the time limit. Try triggering the event in the external service.',
        input: {},
        output: {},
        startTime,
        endTime: Date.now(),
      };
    } catch (error) {
      await NocoCache.del(context, cacheKey);

      // Try to deactivate on error
      await this.deactivateWebhook(
        nodeWrapper,
        activationState,
        webhookUrl,
        workflowId,
        nodeId,
        triggerId,
        'error',
      );

      this.logger.error(
        `TRIGGER_EVENT test failed for trigger ${triggerId}:`,
        error,
      );

      return {
        nodeId,
        status: 'error',
        error: error.message || 'TRIGGER_EVENT test failed',
        input: {},
        output: {},
        startTime: Date.now(),
        endTime: Date.now(),
      };
    }
  }

  /**
   * Helper to deactivate webhook after test
   */
  private async deactivateWebhook(
    nodeWrapper: any,
    activationState: any,
    webhookUrl: string,
    workflowId: string,
    nodeId: string,
    triggerId: string,
    reason?: 'timeout' | 'error',
  ) {
    if (!activationState || typeof nodeWrapper.onDeactivateHook !== 'function') {
      return;
    }

    try {
      await nodeWrapper.onDeactivateHook(
        { webhookUrl, workflowId, nodeId },
        activationState,
      );
      this.logger.log(
        `Deactivated webhook${reason ? ` after ${reason}` : ''}: ${triggerId}`,
      );
    } catch (deactivateError) {
      this.logger.warn(
        `Failed to deactivate webhook ${triggerId}:`,
        deactivateError,
      );
    }
  }
}

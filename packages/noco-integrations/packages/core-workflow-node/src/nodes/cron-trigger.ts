import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  NocoSDK,
  TriggerActivationType,
  WorkflowNodeCategory,
  WorkflowNodeIntegration,
} from '@noco-integrations/core';
import type {
  FormDefinition,
  WorkflowActivationContext,
  WorkflowActivationState,
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeLog,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';

interface CronTriggerConfig extends WorkflowNodeConfig {
  cronExpression: string;
  timezone?: string;
}

export class CronTriggerNode extends WorkflowNodeIntegration<CronTriggerConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    const form: FormDefinition = [
      {
        type: FormBuilderInputType.Input,
        label: 'Cron Expression',
        span: 24,
        model: 'config.cronExpression',
        placeholder: '*/5 * * * * (every 5 minutes)',
        helpText: 'Use cron syntax: minute hour day month weekday',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Cron expression is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Timezone',
        span: 24,
        model: 'config.timezone',
        placeholder: 'Select timezone (optional)',
        options: [
          { label: 'UTC', value: 'UTC' },
          { label: 'America/New_York', value: 'America/New_York' },
          { label: 'America/Los_Angeles', value: 'America/Los_Angeles' },
          { label: 'Europe/London', value: 'Europe/London' },
          { label: 'Asia/Tokyo', value: 'Asia/Tokyo' },
        ],
        validators: [],
      },
    ];

    return {
      id: 'core.trigger.cron',
      title: 'At scheduled time',
      description: 'Trigger workflow on a schedule',
      icon: 'ncClock',
      category: WorkflowNodeCategory.TRIGGER,
      activationType: TriggerActivationType.CRON,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      keywords: [
        'cron',
        'schedule',
        'timer',
        'trigger',
        'recurring',
        'periodic',
      ],
    };
  }

  public async validate(config: CronTriggerConfig) {
    const errors: { path?: string; message: string }[] = [];

    if (!config.cronExpression) {
      errors.push({
        path: 'config.cronExpression',
        message: 'Cron expression is required',
      });
    }

    // TODO: Add cron expression validation using a library like cron-parser

    return { valid: errors.length === 0, errors };
  }

  /**
   * Called when workflow is published - returns state with cron expression
   * The workflows.service will store this and calculate next_sync_at
   */
  public async onActivateHook(
    _context: WorkflowActivationContext,
  ): Promise<WorkflowActivationState> {
    return {
      cronExpression: this.config.cronExpression,
      timezone: this.config.timezone || 'UTC',
      activatedAt: new Date().toISOString(),
    };
  }

  /**
   * Called when workflow is unpublished - no cleanup needed for cron
   */
  public async onDeactivateHook(): Promise<void> {
    // No external cleanup needed for cron triggers
    // The dependency tracker entry will be deleted automatically
  }

  public async run(ctx: WorkflowNodeRunContext): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      const triggeredAt = new Date().toISOString();
      const scheduledTime = (ctx.inputs as any)?.scheduledTime || triggeredAt;

      logs.push({
        level: 'info',
        message: `Cron workflow triggered`,
        ts: Date.now(),
        data: {
          cronExpression: this.config.cronExpression,
          scheduledTime,
          timezone: this.config.timezone || 'UTC',
        },
      });

      return {
        outputs: {
          trigger: {
            type: 'cron',
            timestamp: triggeredAt,
            scheduledTime,
            cronExpression: this.config.cronExpression,
            timezone: this.config.timezone || 'UTC',
          },
        },
        status: 'success',
        logs,
        metrics: {
          executionTimeMs: Date.now() - startTime,
        },
      };
    } catch (error: any) {
      logs.push({
        level: 'error',
        message: `Cron trigger failed: ${error.message}`,
        ts: Date.now(),
        data: error.stack,
      });

      return {
        outputs: {},
        status: 'error',
        error: {
          message: error.message || 'Cron trigger failed',
          code: error.code,
        },
        logs,
        metrics: {
          executionTimeMs: Date.now() - startTime,
        },
      };
    }
  }

  public async generateOutputVariables(): Promise<
    NocoSDK.VariableDefinition[]
  > {
    return [
      {
        key: 'trigger',
        name: 'Trigger',
        type: NocoSDK.VariableType.Object,
        groupKey: NocoSDK.VariableGroupKey.Meta,
        extra: {
          description: 'Trigger information',
          icon: 'cellJson',
        },
        children: [
          {
            key: 'trigger.type',
            name: 'Type',
            type: NocoSDK.VariableType.String,
            groupKey: NocoSDK.VariableGroupKey.Meta,
            extra: {
              description: 'Type of trigger (cron)',
              icon: 'cellText',
            },
          },
          {
            key: 'trigger.timestamp',
            name: 'Timestamp',
            type: NocoSDK.VariableType.DateTime,
            groupKey: NocoSDK.VariableGroupKey.Meta,
            extra: {
              description: 'Actual execution time',
              icon: 'cellDatetime',
            },
          },
          {
            key: 'trigger.scheduledTime',
            name: 'Scheduled Time',
            type: NocoSDK.VariableType.DateTime,
            groupKey: NocoSDK.VariableGroupKey.Meta,
            extra: {
              description: 'Scheduled execution time',
              icon: 'cellDatetime',
            },
          },
          {
            key: 'trigger.cronExpression',
            name: 'Cron Expression',
            type: NocoSDK.VariableType.String,
            groupKey: NocoSDK.VariableGroupKey.Meta,
            extra: {
              description: 'The cron expression',
              icon: 'cellText',
            },
          },
          {
            key: 'trigger.timezone',
            name: 'Timezone',
            type: NocoSDK.VariableType.String,
            groupKey: NocoSDK.VariableGroupKey.Meta,
            extra: {
              description: 'Timezone for the schedule',
              icon: 'cellText',
            },
          },
        ],
      },
    ];
  }
}

import {
  NocoSDK,
  WorkflowNodeCategory,
  WorkflowNodeIntegration,
} from '@noco-integrations/core';
import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  type FormDefinition,
} from '@noco-integrations/core';
import type {
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeLog,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';

interface WaitUntilNodeConfig extends WorkflowNodeConfig {
  datetime: string; // ISO 8601 datetime string in UTC (e.g., '2024-12-31T23:59:59Z')
  timezone?: string; // Timezone used to interpret the datetime (e.g., 'America/New_York')
}

export class WaitUntilNode extends WorkflowNodeIntegration<WaitUntilNodeConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    const form: FormDefinition = [
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Date & Time',
        model: 'config.datetime',
        placeholder: '2024-12-31T23:59:59Z',
        helpText:
          'ISO 8601 datetime (e.g., 2024-12-31T23:59:59Z) or use a variable from a previous node',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Date & time is required',
          },
        ],
      },
    ];

    return {
      id: 'core.flow.wait-until',
      title: 'Wait until',
      icon: 'ncCalendar',
      description: 'Wait until a specific date and time before continuing',
      category: WorkflowNodeCategory.FLOW,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      keywords: ['wait', 'until', 'schedule', 'date', 'time', 'pause'],
    };
  }

  public async validate(config: WaitUntilNodeConfig) {
    const errors: { path?: string; message: string }[] = [];

    if (!config.datetime) {
      errors.push({
        path: 'config.datetime',
        message: 'Date & time is required',
      });
      return { valid: false, errors };
    }

    // Try to parse the datetime string
    const timestamp = new Date(config.datetime).getTime();

    if (isNaN(timestamp)) {
      errors.push({
        path: 'config.datetime',
        message:
          'Invalid date format. Use ISO 8601 format (e.g., 2024-12-31T23:59:59Z)',
      });
    }

    return { valid: errors.length === 0, errors };
  }

  public async run(ctx: WorkflowNodeRunContext): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      const { datetime } = ctx.inputs.config;

      // Parse datetime string to UTC timestamp
      const targetDate = new Date(datetime);
      const resumeAt = targetDate.getTime();
      const now = Date.now();

      if (resumeAt <= now) {
        logs.push({
          level: 'warn',
          message: `Target time ${targetDate.toISOString()} is in the past, continuing immediately`,
          ts: Date.now(),
          data: {
            targetDate: targetDate.toISOString(),
            currentTime: new Date(now).toISOString(),
            difference: now - resumeAt,
          },
        });

        const executionTime = Date.now() - startTime;
        return {
          outputs: {
            targetDateTime: targetDate.toISOString(),
            wasInPast: true,
          },
          status: 'success',
          logs,
          metrics: {
            executionTimeMs: executionTime,
          },
        };
      }

      const delayMs = resumeAt - now;

      logs.push({
        level: 'info',
        message: `Workflow will pause until ${targetDate.toISOString()}`,
        ts: Date.now(),
        data: {
          targetDate: targetDate.toISOString(),
          currentTime: new Date(now).toISOString(),
          delayMs,
        },
      });

      const executionTime = Date.now() - startTime;

      return {
        outputs: {
          resumeAt, // This triggers the workflow execution service to pause
          targetDateTime: targetDate.toISOString(),
          delayDuration: delayMs,
          wasInPast: false,
        },
        status: 'success',
        logs,
        metrics: {
          executionTimeMs: executionTime,
          delayMs,
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      logs.push({
        level: 'error',
        message: `Wait until node failed: ${error.message}`,
        ts: Date.now(),
        data: error.stack,
      });

      return {
        outputs: {},
        status: 'error',
        error: {
          message: error.message || 'Wait until node execution failed',
          code: error.code,
        },
        logs,
        metrics: {
          executionTimeMs: executionTime,
        },
      };
    }
  }

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    return [
      {
        key: 'datetime',
        name: 'Date & Time',
        type: NocoSDK.VariableType.DateTime,
        groupKey: NocoSDK.VariableGroupKey.Meta,
        extra: {
          description: 'Date and time to wait until',
          icon: 'cellDatetime',
          value: this.config.datetime,
        },
      },
    ];
  }

  public async generateOutputVariables(): Promise<
    NocoSDK.VariableDefinition[]
  > {
    return [
      {
        key: 'targetDateTime',
        name: 'Target Time',
        type: NocoSDK.VariableType.DateTime,
        groupKey: NocoSDK.VariableGroupKey.Meta,
        extra: {
          description: 'The target date and time',
          icon: 'cellDatetime',
        },
      },
      {
        key: 'wasInPast',
        name: 'Was Already Past',
        type: NocoSDK.VariableType.Boolean,
        groupKey: NocoSDK.VariableGroupKey.Meta,
        extra: {
          description: 'Whether the target time was already in the past',
          icon: 'cellCheckbox',
        },
      },
    ];
  }
}

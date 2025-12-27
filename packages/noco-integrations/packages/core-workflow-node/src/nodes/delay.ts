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

interface DelayNodeConfig extends WorkflowNodeConfig {
  duration: number;
  unit: 'seconds' | 'minutes' | 'hours' | 'days';
}

export class DelayNode extends WorkflowNodeIntegration<DelayNodeConfig> {
  private static readonly TIME_UNITS = {
    seconds: 1000,
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
  };

  public async definition(): Promise<WorkflowNodeDefinition> {
    const form: FormDefinition = [
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Duration',
        model: 'config.duration',
        placeholder: '5',
        helpText: 'How long to wait before continuing',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Duration is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.Select,
        label: 'Unit',
        model: 'config.unit',
        options: [
          { label: 'Seconds', value: 'seconds' },
          { label: 'Minutes', value: 'minutes' },
          { label: 'Hours', value: 'hours' },
          { label: 'Days', value: 'days' },
        ],
        defaultValue: 'minutes',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Unit is required',
          },
        ],
      },
    ];

    return {
      id: 'core.flow.delay',
      title: 'Delay',
      icon: 'ncClock',
      description: 'Wait for a specified amount of time before continuing',
      category: WorkflowNodeCategory.FLOW,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      keywords: ['delay', 'wait', 'pause', 'sleep', 'timer'],
    };
  }

  public async validate(config: DelayNodeConfig) {
    const errors: { path?: string; message: string }[] = [];

    if (!config.duration || config.duration <= 0) {
      errors.push({
        path: 'config.duration',
        message: 'Duration must be greater than 0',
      });
    }

    if (
      !config.unit ||
      !['seconds', 'minutes', 'hours', 'days'].includes(config.unit)
    ) {
      errors.push({
        path: 'config.unit',
        message: 'Valid unit is required (seconds, minutes, hours, days)',
      });
    }

    if (config.duration && config.unit) {
      const durationMs =
        config.duration * (DelayNode.TIME_UNITS[config.unit] || 0);
      const maxDurationMs = 365 * 24 * 60 * 60 * 1000; // 365 days

      if (durationMs > maxDurationMs) {
        errors.push({
          path: 'config.duration',
          message: 'Duration cannot exceed 365 days',
        });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  public async run(ctx: WorkflowNodeRunContext): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      const { duration, unit } = ctx.inputs.config as DelayNodeConfig;

      const delayMs =
        duration *
        DelayNode.TIME_UNITS[unit as keyof typeof DelayNode.TIME_UNITS];

      const resumeAt = Date.now() + delayMs;

      const resumeDate = new Date(resumeAt);

      logs.push({
        level: 'info',
        message: `Workflow will pause for ${duration} ${unit}`,
        ts: Date.now(),
        data: {
          duration,
          unit,
          delayMs,
          resumeAt: resumeDate.toISOString(),
        },
      });

      const executionTime = Date.now() - startTime;

      return {
        outputs: {
          resumeAt,
          scheduledResumeTime: resumeDate.toISOString(),
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
        message: `Delay node failed: ${error.message}`,
        ts: Date.now(),
        data: error.stack,
      });

      return {
        outputs: {},
        status: 'error',
        error: {
          message: error.message || 'Delay node execution failed',
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
        key: 'duration',
        name: 'Duration',
        type: NocoSDK.VariableType.Number,
        groupKey: NocoSDK.VariableGroupKey.Meta,
        extra: {
          description: 'How long to wait',
          icon: 'cellNumber',
          value: this.config.duration,
        },
      },
      {
        key: 'unit',
        name: 'Time Unit',
        type: NocoSDK.VariableType.String,
        groupKey: NocoSDK.VariableGroupKey.Meta,
        extra: {
          description: 'Unit of time (seconds, minutes, hours, days)',
          icon: 'cellText',
          value: this.config.unit,
        },
      },
    ];
  }

  public async generateOutputVariables(): Promise<
    NocoSDK.VariableDefinition[]
  > {
    return [
      {
        key: 'scheduledResumeTime',
        name: 'Resume Time',
        type: NocoSDK.VariableType.DateTime,
        groupKey: NocoSDK.VariableGroupKey.Meta,
        extra: {
          description: 'When the workflow will resume',
          icon: 'cellDatetime',
        },
      },
    ];
  }
}

import {
  FormBuilderInputType,
  type FormDefinition,
  NocoSDK,
  WorkflowNodeCategory,
  type WorkflowNodeConfig,
  type WorkflowNodeDefinition,
  WorkflowNodeIntegration,
  type WorkflowNodeLog,
  type WorkflowNodeResult,
  type WorkflowNodeRunContext,
} from '@noco-integrations/core';

interface ManualTriggerConfig extends WorkflowNodeConfig {
  description?: string;
}

export class ManualTriggerNode extends WorkflowNodeIntegration<ManualTriggerConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    return {
      id: 'core.trigger.manual',
      title: 'When manually triggered',
      description: 'Manually start a workflow execution',
      icon: 'ncPlay',
      category: WorkflowNodeCategory.TRIGGER,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form: [],
      keywords: ['manual', 'trigger', 'start', 'run'],
    };
  }

  public async validate(_config: ManualTriggerConfig) {
    // Manual trigger has no required fields
    return { valid: true };
  }

  public async run(ctx: WorkflowNodeRunContext): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      const triggeredAt = new Date().toISOString();

      logs.push({
        level: 'info',
        message: 'Workflow triggered manually',
        ts: Date.now(),
        data: {
          userId: ctx.user?.id,
          userEmail: ctx.user?.email,
        },
      });

      const executionTime = Date.now() - startTime;

      return {
        outputs: {
          user: {
            id: ctx.user?.id || null,
            email: ctx.user?.email || null,
            display_name: ctx?.user?.display_name || null
          },
          trigger: {
            timestamp: triggeredAt,
            type: 'manual',
          },
        },
        status: 'success',
        logs,
        metrics: {
          executionTimeMs: executionTime,
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      logs.push({
        level: 'error',
        message: `Manual trigger failed: ${error.message}`,
        ts: Date.now(),
        data: error.stack,
      });

      return {
        outputs: {},
        status: 'error',
        error: {
          message: error.message || 'Manual trigger failed',
          code: error.code,
        },
        logs,
        metrics: {
          executionTimeMs: executionTime,
        },
      };
    }
  }

  public async generateOutputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    return [
      {
        key: 'user',
        name: 'User',
        type: NocoSDK.VariableType.Object,
        groupKey: NocoSDK.VariableGroupKey.Meta,
        extra: {
          description: 'User who triggered the workflow',
          icon: 'cellSystemUser',
        },
        children: [
          {
            key: 'user.id',
            name: 'ID',
            type: NocoSDK.VariableType.String,
            groupKey: NocoSDK.VariableGroupKey.Meta,
            extra: {
              description: 'ID of the user who triggered the workflow',
              icon: 'cellSystemKey',
            },
          },
          {
            key: 'user.email',
            name: 'Email',
            type: NocoSDK.VariableType.String,
            groupKey: NocoSDK.VariableGroupKey.Meta,
            extra: {
              description: 'Email of the user who triggered the workflow',
              icon: 'cellEmail',
            },
          },
          {
            key: 'user.display_name',
            name: 'Display Name',
            type: NocoSDK.VariableType.String,
            groupKey: NocoSDK.VariableGroupKey.Meta,
            extra: {
              description: 'Name of the user who triggered the workflow',
              icon: 'cellText',
            },
          },
        ],
      },
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
            key: 'trigger.timestamp',
            name: 'Timestamp',
            type: NocoSDK.VariableType.DateTime,
            groupKey: NocoSDK.VariableGroupKey.Meta,
            extra: {
              description: 'Timestamp when the workflow was triggered',
              icon: 'cellSystemDate',
            },
          },
          {
            key: 'trigger.type',
            name: 'Type',
            type: NocoSDK.VariableType.String,
            groupKey: NocoSDK.VariableGroupKey.Meta,
            extra: {
              description: 'Type of trigger (manual)',
              icon: 'cellText',
            },
          },
        ],
      },
    ];
  }
}

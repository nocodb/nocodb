import {
  FormBuilderInputType,
  type FormDefinition,
  WorkflowNodeCategory,
  type WorkflowNodeDefinition,
  WorkflowNodeIntegration,
  type WorkflowNodeLog,
  type WorkflowNodeResult,
  type WorkflowNodeRunContext,
} from '@noco-integrations/core';

interface ManualTriggerConfig {
  description?: string;
}

export class ManualTriggerNode extends WorkflowNodeIntegration<ManualTriggerConfig> {
  public definition(): WorkflowNodeDefinition {
    const form: FormDefinition = [
      {
        type: FormBuilderInputType.Input,
        label: 'Description',
        width: 100,
        model: 'config.description',
        placeholder: 'Optional description for this trigger',
      },
    ];

    return {
      key: 'core.trigger.manual',
      title: 'Manual Trigger',
      description: 'Manually start a workflow execution',
      category: WorkflowNodeCategory.TRIGGER,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      ui: { icon: 'ncAutomation', color: '#8B5CF6' },
      keywords: ['manual', 'trigger', 'start', 'run'],
    };
  }

  public async validate(config: ManualTriggerConfig) {
    // Manual trigger has no required fields
    return { valid: true };
  }

  public async run(
    ctx: WorkflowNodeRunContext,
  ): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
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
          // Pass through any input data provided when manually triggering
          data: ctx.inputs || {},
          timestamp: (ctx.now?.() || new Date()).toISOString(),
          triggeredBy: {
            userId: ctx.user?.id,
            email: ctx.user?.email,
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
}

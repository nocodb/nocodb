import {
  FormBuilderInputType,
  FormBuilderValidatorType,
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

interface RecordCreatedTriggerConfig extends WorkflowNodeConfig {
  modelId: string; // Table to listen to
  viewId?: string; // Optional: specific view filter
}

export class RecordCreatedTriggerNode extends WorkflowNodeIntegration<RecordCreatedTriggerConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    // Fetch tables from services if available
    let tableOptions: { label: string; value: string }[] = [];
    if (this.nocodb.tablesService && this.nocodb.context) {
      try {
        const models = await this.nocodb.tablesService.getAccessibleTables(
          this.nocodb.context,
          {
            baseId: this.nocodb.context.base_id,
            roles: { [NocoSDK.ProjectRoles.EDITOR]: true },
          },
        );
        tableOptions = models.map((model: any) => ({
          label: model.title || model.table_name,
          value: model.id,
        }));
      } catch (error: any) {
        console.error('Failed to fetch tables:', error);
      }
    }

    const form: FormDefinition = [
      {
        type: FormBuilderInputType.Select,
        label: 'Table',
        width: 100,
        model: 'config.modelId',
        placeholder: 'Select a table to monitor',
        options: tableOptions,
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Table is required',
          },
        ],
      },
    ];

    return {
      key: 'nocodb.trigger.after_insert',
      title: 'When record created',
      description: 'Triggers when a new record is created in a table',
      category: WorkflowNodeCategory.TRIGGER,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      ui: { icon: 'ncRecordCreate', color: '#10b981' },
      keywords: ['trigger', 'create', 'insert', 'new', 'record', 'webhook'],
    };
  }

  public async validate(config: RecordCreatedTriggerConfig) {
    const errors: { path?: string; message: string }[] = [];

    if (!config.modelId) {
      errors.push({ path: 'config.modelId', message: 'Table is required' });
    }

    return { valid: errors.length === 0, errors };
  }

  public async run(ctx: WorkflowNodeRunContext): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      // This will be called by the workflow execution engine
      // when a webhook event triggers the workflow
      const { newData, user, timestamp } = ctx.inputs as any;

      logs.push({
        level: 'info',
        message: 'Record created trigger activated',
        ts: Date.now(),
        data: {
          recordId: newData?.id,
          userId: user?.id,
        },
      });

      const executionTime = Date.now() - startTime;

      return {
        outputs: {
          record: newData, // The newly created record
          user: user, // User who created the record
          timestamp: timestamp || new Date().toISOString(),
          modelId: this.config.modelId,
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
        message: `Record created trigger failed: ${error.message}`,
        ts: Date.now(),
        data: error.stack,
      });

      return {
        outputs: {},
        status: 'error',
        error: {
          message: error.message || 'Record created trigger failed',
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

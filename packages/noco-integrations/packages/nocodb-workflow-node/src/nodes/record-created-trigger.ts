import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  NocoSDK,
  WorkflowNodeCategory,
  WorkflowNodeIntegration,
} from '@noco-integrations/core';
import type {
  FormDefinition,
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeLog,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';


interface RecordCreatedTriggerConfig extends WorkflowNodeConfig {
  modelId: string;
}

export class RecordCreatedTriggerNode extends WorkflowNodeIntegration<RecordCreatedTriggerConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    const form: FormDefinition = [
      {
        type: FormBuilderInputType.SelectTable,
        label: 'Table',
        width: 100,
        model: 'config.modelId',
        placeholder: 'Select a table',
        fetchOptionsKey: 'tables',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Table is required',
          },
        ],
      },
    ];

    return {
      id: 'nocodb.trigger.after_insert',
      title: 'When record created',
      description: 'Triggers when a new record is created in a table',
      icon: 'ncRecordCreate',
      category: WorkflowNodeCategory.TRIGGER,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      keywords: ['trigger', 'create', 'insert', 'new', 'record', 'webhook'],
    };
  }

  public async fetchOptions(key: 'tables') {
    switch (key) {
      case 'tables':
      {
        const tables = await this.nocodb.tablesService.getAccessibleTables(this.nocodb.context, {
          baseId: this.nocodb.context.base_id,
          roles: { [NocoSDK.ProjectRoles.EDITOR]: true },
        })

        return tables.map((table: any) => ({
          label: table.title || table.table_name,
          value: table.id,
          ncItemDisabled: table.synced,
          table
        }))
      }
      default:
        return [];
    }
  }

  public async validate(config: RecordCreatedTriggerConfig) {
    const errors: { path?: string; message: string }[] = [];

    if (!config.modelId) {
      errors.push({ path: 'config.modelId', message: 'Table is required' });
    }

    if (config.modelId) {
      const table = await this.nocodb.tablesService.getTableWithAccessibleViews(this.nocodb.context, {
        tableId: config.modelId,
        user: { ...this.nocodb.user, roles: { [NocoSDK.ProjectRoles.EDITOR]: true } } as any,
      });
      if (!table) {
        errors.push({ path: 'config.modelId', message: 'Table is not accessible' });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  public async run(ctx: WorkflowNodeRunContext): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
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
          record: newData,
          user: user,
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

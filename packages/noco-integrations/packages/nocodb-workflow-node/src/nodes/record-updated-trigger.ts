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

interface RecordUpdatedTriggerConfig extends WorkflowNodeConfig {
  modelId: string; // Table to listen to
  viewId?: string; // Optional: specific view filter
  columnFilter?: string; // Optional: comma-separated column IDs to monitor
}

export class RecordUpdatedTriggerNode extends WorkflowNodeIntegration<RecordUpdatedTriggerConfig> {
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
      {
        type: FormBuilderInputType.Input,
        label: 'Column Filter (Optional)',
        width: 100,
        model: 'config.columnFilter',
        placeholder: 'Leave empty to monitor all columns',
      },
    ];

    return {
      id: 'nocodb.trigger.after_update',
      title: 'When record updated',
      description: 'Triggers when a record is updated in a table',
      icon: 'ncRecordUpdate',
      category: WorkflowNodeCategory.TRIGGER,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      keywords: ['trigger', 'update', 'edit', 'modify', 'record', 'webhook'],
    };
  }

  public async validate(config: RecordUpdatedTriggerConfig) {
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
      const { prevData, newData, user, timestamp, affectedColumns } =
        ctx.inputs as any;

      // Check if we should filter by specific columns
      if (this.config.columnFilter && affectedColumns) {
        const targetColumns = this.config.columnFilter
          .split(',')
          .map((col) => col.trim());
        const hasMatch = targetColumns.some((col: string) =>
          affectedColumns.includes(col),
        );

        if (!hasMatch) {
          logs.push({
            level: 'info',
            message:
              'Record updated but no monitored columns changed, skipping',
            ts: Date.now(),
            data: {
              affectedColumns,
              monitoredColumns: targetColumns,
            },
          });

          return {
            outputs: {},
            status: 'skipped',
            logs,
            metrics: {
              executionTimeMs: Date.now() - startTime,
            },
          };
        }
      }

      logs.push({
        level: 'info',
        message: 'Record updated trigger activated',
        ts: Date.now(),
        data: {
          recordId: newData?.id,
          userId: user?.id,
          affectedColumns,
        },
      });

      const executionTime = Date.now() - startTime;

      return {
        outputs: {
          previousRecord: prevData, // The record before update
          record: newData, // The record after update
          user: user, // User who updated the record
          timestamp: timestamp || new Date().toISOString(),
          modelId: this.config.modelId,
          affectedColumns: affectedColumns || [],
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
        message: `Record updated trigger failed: ${error.message}`,
        ts: Date.now(),
        data: error.stack,
      });

      return {
        outputs: {},
        status: 'error',
        error: {
          message: error.message || 'Record updated trigger failed',
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

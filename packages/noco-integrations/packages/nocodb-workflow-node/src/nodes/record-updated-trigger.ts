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

  WorkflowNodeRunContext} from '@noco-integrations/core';

interface RecordUpdatedTriggerConfig extends WorkflowNodeConfig {
  modelId: string;
  columnFilter?: Array<string>;
}

export class RecordUpdatedTriggerNode extends WorkflowNodeIntegration<RecordUpdatedTriggerConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    const form: FormDefinition = [
      {
        type: FormBuilderInputType.SelectTable,
        label: 'Table',
        span: 24,
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
      {
        type: FormBuilderInputType.SelectField,
        label: 'Fields to monitor',
        span: 24,
        model: 'config.columnFilter',
        placeholder: 'Select fields to monitor',
        fetchOptionsKey: 'fields',
        selectMode: 'multiple',
        dependsOn: 'config.modelId',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Fields to monitor is required',
          },
        ],
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

    let table: NocoSDK.TableType & {
      views: Array<NocoSDK.ViewType>
      columns: Array<NocoSDK.ColumnType>
    } | null = null;

    if (config.modelId) {
      table = await this.nocodb.tablesService.getTableWithAccessibleViews(this.nocodb.context, {
        tableId: config.modelId,
        user: { ...this.nocodb.user, roles: { [NocoSDK.ProjectRoles.EDITOR]: true } } as any,
      });
      if (!table) {
        errors.push({ path: 'config.modelId', message: 'Table is not accessible' });
      }
    }

    if (config.modelId && table && config.columnFilter) {
      const invalidColumns = config.columnFilter.filter(
        (col) => !table.columns.some((c) => c.id === col),
      );
      if (invalidColumns.length > 0) {
        errors.push({
          path: 'config.columnFilter',
          message: `Invalid columns: ${invalidColumns.join(', ')}`,
        });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  public async fetchOptions(key: 'tables' | 'fields') {
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
          table: table
        }))
      }
      case 'fields':
      {
        if (!this.config.modelId) {
          return []
        }
        const table = await this.nocodb.tablesService.getTableWithAccessibleViews(this.nocodb.context, {
          tableId: this.config.modelId,
          user: { ...this.nocodb.user, roles: { [NocoSDK.ProjectRoles.EDITOR]: true } } as any,
        })
        return table?.columns?.filter((f) => !NocoSDK.isSystemColumn(f)).map((column: any) => ({
          label: column.title || column.column_name,
          value: column.id,
          column: column
        }))
      }
      default:
        return [];
    }
  }

  public async run(ctx: WorkflowNodeRunContext): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      const { prevData, newData, user, timestamp, affectedColumns } =
        ctx.inputs as any;

      if (this.config.columnFilter && affectedColumns) {
        const targetColumns = this.config.columnFilter
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
          previousRecord: prevData,
          record: newData,
          user: user,
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

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
  WorkflowNodeRunContext
} from '@noco-integrations/core';

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

  private async fetchSampleRecord() {
    if (!this.config.modelId) {
      return {};
    }
    try {
      const result = await this.nocodb.dataService.dataList(
        this.nocodb.context,
        {
          modelId: this.config.modelId,
          query: {
            limit: 1,
            offset: 0,
          },
          req: {
            user: this.nocodb.user
          } as any,
        },
        false
      );

      if (result?.length > 0) {
        return result[0];
      }

      // No records in table, return empty object
      return {};
    } catch (error) {
      console.error('Failed to fetch sample record:', error);
      return {};
    }
  }

  public async run(ctx: WorkflowNodeRunContext): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      let { prevData, newData, user, timestamp, affectedColumns } =
        ctx.inputs as any;

      if (ctx.testMode) {
        user = this.nocodb.user;
        timestamp = timestamp || new Date().toISOString();
        const baseData = (await this.fetchSampleRecord()) as {
          fields: Record<string, any>;
          id: string;
        };

        if (Object.keys(baseData).length === 0) {
          prevData = { fields: {} };
          newData = { fields: {} };
          affectedColumns = this.config.columnFilter || [];

          logs.push({
            level: 'info',
            message: 'No records found in table, using empty object for testing',
            ts: Date.now(),
          });
        } else {
          prevData = { ...baseData, fields: { ...(baseData?.fields || {}) } };
          newData = { ...baseData, fields: { ...(baseData?.fields || {}) } };

          const firstUserField = Object.keys(newData.fields)[0];
          if (firstUserField && typeof newData.fields[firstUserField] === 'string') {
            newData.fields[firstUserField] = `${newData.fields[firstUserField]} (updated)`;
          } else if (firstUserField && typeof newData.fields[firstUserField] === 'number') {
            newData.fields[firstUserField] = newData.fields[firstUserField] + 1;
          }

          affectedColumns = this.config.columnFilter || (firstUserField ? [firstUserField] : []);

          logs.push({
            level: 'info',
            message: 'Fetched sample record from database for testing',
            ts: Date.now(),
            data: { recordId: baseData?.id, affectedColumns },
          });
        }
      }

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

      let tableName = '';

      try {
        const table = await this.nocodb.tablesService.getTableWithAccessibleViews(
          this.nocodb.context,
          {
            tableId: this.config.modelId,
            user: this.nocodb.user as any,
          }
        );
        tableName = table?.title || '';
      } catch {
        // empty
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
          table: {
            id: this.config.modelId,
            name: tableName,
          },
          user: {
            id: user?.id,
            name: user?.display_name,
            email: user?.email,
          },
          trigger: {
            type: 'record-updated',
            timestamp: timestamp,
            affectedColumns,
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

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    const { modelId, columnFilter } = this.config;

    if (!modelId) return [];

    try {
      const table = await this.nocodb.tablesService.getTableWithAccessibleViews(
        this.nocodb.context,
        {
          tableId: modelId,
          user: this.nocodb.user as any,
        }
      );

      if (!table) return [];

      const variables: NocoSDK.VariableDefinition[] = [
        {
          key: 'config.modelId',
          name: 'Table',
          type: NocoSDK.VariableType.String,
          groupKey: NocoSDK.VariableGroupKey.Fields,
          extra: {
            tableName: table.title,
            description: 'Table to monitor for updates',
          },
        },
      ];

      if (columnFilter && columnFilter.length > 0) {
        const monitoredColumns = table.columns
          .filter((col: any) => columnFilter.includes(col.id))
          .map((col: any) => col.title)
          .join(', ');

        variables.push({
          key: 'config.columnFilter',
          name: 'Monitored Fields',
          type: NocoSDK.VariableType.Array,
          groupKey: NocoSDK.VariableGroupKey.Fields,
          isArray: true,
          extra: {
            description: `Fields being monitored: ${monitoredColumns}`,
          },
        });
      }

      return variables;
    } catch {
      return [];
    }
  }

  public async generateOutputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    const { modelId } = this.config;

    if (!modelId) return [];

    try {
      const table = await this.nocodb.tablesService.getTableWithAccessibleViews(
        this.nocodb.context,
        {
          tableId: modelId,
          user: this.nocodb.user as any,
        }
      );

      if (!table) return [];

      const recordVariables = NocoSDK.genRecordVariables(table.columns, false, 'record');
      const previousRecordVariables = NocoSDK.genRecordVariables(table.columns, false, 'previousRecord');

      const additionalVariables: NocoSDK.VariableDefinition[] = [
        {
          key: 'table',
          name: 'Table',
          type: NocoSDK.VariableType.Object,
          groupKey: NocoSDK.VariableGroupKey.Meta,
          extra: {
            description: 'Table information',
            icon: 'cellJson',
          },
          children: [
            {
              key: 'table.id',
              name: 'ID',
              type: NocoSDK.VariableType.String,
              groupKey: NocoSDK.VariableGroupKey.Meta,
              extra: {
                description: 'Table ID',
                icon: 'cellSystemKey',
              },
            },
            {
              key: 'table.name',
              name: 'Name',
              type: NocoSDK.VariableType.String,
              groupKey: NocoSDK.VariableGroupKey.Meta,
              extra: {
                description: 'Table name',
                icon: 'cellText',
              },
            },
          ],
        },
        {
          key: 'user',
          name: 'User',
          type: NocoSDK.VariableType.Object,
          groupKey: NocoSDK.VariableGroupKey.Meta,
          extra: {
            description: 'User who updated the record',
            icon: 'cellSystemUser',
          },
          children: [
            {
              key: 'user.id',
              name: 'ID',
              type: NocoSDK.VariableType.String,
              groupKey: NocoSDK.VariableGroupKey.Meta,
              extra: {
                description: 'User ID',
                icon: 'cellSystemKey',
              },
            },
            {
              key: 'user.email',
              name: 'Email',
              type: NocoSDK.VariableType.String,
              groupKey: NocoSDK.VariableGroupKey.Meta,
              extra: {
                description: 'User email',
                icon: 'cellEmail',
              },
            },
            {
              key: 'user.name',
              name: 'Name',
              type: NocoSDK.VariableType.String,
              groupKey: NocoSDK.VariableGroupKey.Meta,
              extra: {
                description: 'User name',
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
              key: 'trigger.type',
              name: 'Type',
              type: NocoSDK.VariableType.String,
              groupKey: NocoSDK.VariableGroupKey.Meta,
              extra: {
                description: 'Trigger type',
                icon: 'cellText',
              },
            },
            {
              key: 'trigger.timestamp',
              name: 'Timestamp',
              type: NocoSDK.VariableType.DateTime,
              groupKey: NocoSDK.VariableGroupKey.Meta,
              extra: {
                description: 'When the trigger was activated',
                icon: 'cellSystemDate',
              },
            },
            {
              key: 'affectedColumns',
              name: 'Affected Columns',
              type: NocoSDK.VariableType.Array,
              groupKey: NocoSDK.VariableGroupKey.Meta,
              isArray: true,
              extra: {
                description: 'List of column IDs that were changed',
                icon: 'cellJson',
              },
              children: [
                {
                  key: 'affectedColumns.length',
                  name: 'Count',
                  type: NocoSDK.VariableType.Number,
                  groupKey: NocoSDK.VariableGroupKey.Meta,
                  extra: {
                    description: 'Number of columns changed',
                    icon: 'cellNumber',
                  },
                },
              ],
            },
          ],
        },
      ];

      return [...recordVariables, ...previousRecordVariables, ...additionalVariables];
    } catch {
      return [];
    }
  }
}

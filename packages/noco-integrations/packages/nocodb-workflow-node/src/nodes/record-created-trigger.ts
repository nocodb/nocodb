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

      if (result.length) {
        return result[0];
      }
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
      let { newData, user, timestamp } = ctx.inputs as any;
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
        tableName = '';
      }

      if (ctx.testMode) {
        newData = await this.fetchSampleRecord();
        user = this.nocodb.user;
        timestamp = new Date().toISOString();

        if (Object.keys(newData).length === 0) {
          logs.push({
            level: 'info',
            message: 'No records found in table, using empty object for testing',
            ts: Date.now(),
          });
        } else {
          logs.push({
            level: 'info',
            message: 'Fetched sample record from database for testing',
            ts: Date.now(),
            data: { recordId: newData?.Id || newData?.id },
          });
        }
      }

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
          table: {
            id: this.config.modelId,
            name: tableName,
          },
          trigger: {
            timestamp: timestamp,
            type: 'record-created',
          },
          user: {
            id: user?.id,
            name: user?.display_name,
            email: user?.email,
          }
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

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
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

      return [
        {
          key: 'config.modelId',
          name: 'Table',
          type: NocoSDK.VariableType.String,
          groupKey: NocoSDK.VariableGroupKey.Fields,
          extra: {
            tableName: table.title,
            description: 'Table to monitor for new records',
          },
        },
      ];
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

      // Table group
      const tableVariable: NocoSDK.VariableDefinition = {
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
      };

      const triggerVariable: NocoSDK.VariableDefinition = {
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
            type: NocoSDK.VariableType.String,
            groupKey: NocoSDK.VariableGroupKey.Meta,
            extra: {
              description: 'Trigger timestamp',
              icon: 'cellSystemDate',
            },
          },
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
        ],
      };

      const userVariables : NocoSDK.VariableDefinition = {
        key: 'user',
        name: 'User',
        type: NocoSDK.VariableType.Object,
        groupKey: NocoSDK.VariableGroupKey.Meta,
        extra: {
          description: 'User who created record',
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
            key: 'user.name',
            name: 'Name',
            type: NocoSDK.VariableType.String,
            groupKey: NocoSDK.VariableGroupKey.Meta,
            extra: {
              description: 'User name',
              icon: 'cellText',
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
        ],
      }

      return [...recordVariables, tableVariable, triggerVariable, userVariables];
    } catch {
      return [];
    }
  }
}

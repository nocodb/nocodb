import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  NocoSDK,
  WorkflowNodeCategory,
  WorkflowNodeIntegration,
} from '@noco-integrations/core';
import type {
  FormDefinition, WorkflowNodeConfig, WorkflowNodeDefinition, WorkflowNodeLog, WorkflowNodeResult, WorkflowNodeRunContext} from '@noco-integrations/core';

interface DeleteRecordNodeConfig extends WorkflowNodeConfig {
  modelId: string;
  rowId: string;
}

export class DeleteRecordNode extends WorkflowNodeIntegration<DeleteRecordNodeConfig> {
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
        type: FormBuilderInputType.WorkflowInput,
        label: 'Record ID',
        span: 24,
        model: 'config.rowId',
        placeholder: 'Enter the record ID',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Record ID is required',
          },
        ],
      },
    ];

    return {
      id: 'nocodb.delete_record',
      title: 'Delete Record',
      description: 'Delete a record from a NocoDB table',
      icon: 'ncRecordDelete',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      keywords: ['nocodb', 'database', 'delete', 'remove', 'record'],
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
          ncItemTooltip: table.synced? 'Records cannot be deleted in synced tables': null,
          table: table
        }))
      }
      default:
        return [];
    }
  }

  public async validate(config: DeleteRecordNodeConfig) {
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


    if (!config.rowId) {
      errors.push({
        path: 'config.rowId',
        message: 'Record ID is required',
      });
    }

    return { valid: errors.length === 0, errors };
  }

  public async run(
    ctx: WorkflowNodeRunContext<DeleteRecordNodeConfig>,
  ): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      const { modelId, rowId } = ctx.inputs.config;

      logs.push({
        level: 'info',
        message: `Deleting record ${rowId} from model ${modelId}`,
        ts: Date.now(),
      });

      const context = {
        workspace_id: ctx.workspaceId,
        base_id: ctx.baseId,
      } as NocoSDK.NcContext;

      const result = await this.nocodb.dataService.dataDelete(context, {
        modelId,
        body: { id: rowId },
        cookie: {
          user: this.nocodb.user
        },
      });

      const executionTime = Date.now() - startTime;

      logs.push({
        level: 'info',
        message: `Record deleted successfully`,
        ts: Date.now(),
        data: { recordId: rowId },
      });

      return {
        outputs: {
          deleted: result.records[0],
        },
        status: 'success',
        logs,
        metrics: {
          recordsDeleted: result.records.length,
          executionTimeMs: executionTime,
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      logs.push({
        level: 'error',
        message: `Failed to delete record: ${error.message}`,
        ts: Date.now(),
        data: error.response?.data || error.stack,
      });

      return {
        outputs: {},
        status: 'error',
        error: {
          message: error.message || 'Failed to delete record',
          code: error.code || error.response?.status?.toString(),
          data: error.response?.data,
        },
        logs,
        metrics: {
          executionTimeMs: executionTime,
        },
      };
    }
  }

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    const variables: NocoSDK.VariableDefinition[] = [];
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

      variables.push({
        key: 'config.modelId',
        name: 'Table',
        type: NocoSDK.VariableType.String,
        groupKey: NocoSDK.VariableGroupKey.Fields,
        extra: {
          icon: table.synced? 'ncZap': 'table',
          tableName: table.title,
          description: 'Selected table for record deletion',
        },
      });

      variables.push({
        key: 'config.rowId',
        name: 'Record ID',
        type: NocoSDK.VariableType.String,
        groupKey: NocoSDK.VariableGroupKey.Fields,
        extra: {
          icon: 'cellSystemKey',
          description: 'ID of the record to delete',
        },
      });

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

      return [
        {
          key: 'deleted',
          name: 'Record',
          type: NocoSDK.VariableType.Object,
          groupKey: NocoSDK.VariableGroupKey.Fields,
          extra: {
            description: 'Record',
            icon: 'cellJson',
          },
          children: [
            {
              key: 'deleted.id',
              name: 'ID',
              type: NocoSDK.VariableType.String,
              groupKey: NocoSDK.VariableGroupKey.Fields,
              extra: {
                description: 'ID of the record',
                icon: 'cellSystemKey',
              },
            },
            {
              key: 'deleted.deleted',
              name: 'Deleted',
              type: NocoSDK.VariableType.Boolean,
              groupKey: NocoSDK.VariableGroupKey.Fields,
              extra: {
                description: 'Whether the record was deleted',
                icon: 'cellCheckbox',
              },
            }
          ],
        },
      ]
    } catch {
      return [];
    }
  }
}

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

interface FindRecordNodeConfig extends WorkflowNodeConfig {
  modelId: string;
  rowId: string;
  viewId?: string
}

export class FindRecordNode extends WorkflowNodeIntegration<FindRecordNodeConfig> {
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
        type: FormBuilderInputType.SelectView,
        label: 'View',
        span: 24,
        model: 'config.viewId',
        placeholder: 'Select a view',
        fetchOptionsKey: 'views',
        dependsOn: 'config.modelId',
        condition: [
          {
            model: 'config.modelId',
            notEmpty: true
          }
        ]
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
      id: 'nocodb.find_record',
      title: 'Find Record',
      description: 'Find a specific record by ID in a NocoDB table',
      icon: 'ncRecordFind',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      keywords: ['nocodb', 'database', 'read', 'find', 'get', 'record'],
    };
  }

  public async fetchOptions(key: 'tables' | 'views') {
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
      case 'views': {
        if (!this.config.modelId) {
          return []
        }
        const table = await this.nocodb.tablesService.getTableWithAccessibleViews(this.nocodb.context, {
          tableId: this.config.modelId,
          user: { ...this.nocodb.user, roles: { [NocoSDK.ProjectRoles.EDITOR]: true } } as any,
        })

        return table.views.map((view: any) => ({
          label: view.title || table.table_name,
          value: view.id,
          view: view
        }))
      }
      default:
        return [];
    }
  }

  public async validate(config: FindRecordNodeConfig) {
    const errors: { path?: string; message: string }[] = [];

    if (!config.modelId) {
      errors.push({ path: 'config.modelId', message: 'Table is required' });
    }

    let table

    if (config.modelId) {
      table = await this.nocodb.tablesService.getTableWithAccessibleViews(this.nocodb.context, {
        tableId: config.modelId,
        user: { ...this.nocodb.user, roles: { [NocoSDK.ProjectRoles.EDITOR]: true } } as any,
      });
      if (!table) {
        errors.push({ path: 'config.modelId', message: 'Table is not accessible' });
      }
    }

    if(config.modelId && config.viewId) {
      const view = table?.views?.find((v) => v.id === config.viewId)

      if (!view) {
        errors.push({
          path: 'config.viewId',
          message: 'Selected view is invalid'
        })
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
    ctx: WorkflowNodeRunContext<FindRecordNodeConfig>,
  ): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      const { modelId, rowId, viewId } = ctx.inputs.config;

      logs.push({
        level: 'info',
        message: `Finding record ${rowId} from model ${modelId}`,
        ts: Date.now(),
      });

      const context = {
        workspace_id: ctx.workspaceId,
        base_id: ctx.baseId,
      } as NocoSDK.NcContext;

      const result = await this.nocodb.dataService.dataRead(context, {
        modelId,
        rowId,
        viewId,
        query: {},
        req: {
          user: this.nocodb.user
        } as NocoSDK.NcRequest,
      });

      const executionTime = Date.now() - startTime;

      logs.push({
        level: 'info',
        message: `Record retrieved successfully`,
        ts: Date.now(),
        data: { recordId: result.id },
      });

      return {
        outputs: {
          record: result,
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
        message: `Failed to find record: ${error.message}`,
        ts: Date.now(),
        data: error.response?.data || error.stack,
      });

      return {
        outputs: {},
        status: 'error',
        error: {
          message: error.message || 'Failed to find record',
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
    const { modelId, viewId } = this.config;

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
          tableName: table.title,
          description: 'Selected table for finding record',
        },
      });

      if (viewId) {
        const view = table.views?.find((v) => v.id === viewId);
        variables.push({
          key: 'config.viewId',
          name: 'View',
          type: NocoSDK.VariableType.String,
          groupKey: NocoSDK.VariableGroupKey.Fields,
          extra: {
            viewName: view?.title,
            description: 'Selected view for filtering',
          },
        });
      }

      variables.push({
        key: 'config.rowId',
        name: 'Record ID',
        type: NocoSDK.VariableType.String,
        groupKey: NocoSDK.VariableGroupKey.Fields,
        extra: {
          description: 'ID of the record to find',
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

      return NocoSDK.genRecordVariables(table.columns, false, 'record');
    } catch {
      return [];
    }
  }
}

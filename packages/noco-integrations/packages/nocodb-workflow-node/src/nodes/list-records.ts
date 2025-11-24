import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  NocoSDK,
  WorkflowNodeCategory,
  WorkflowNodeIntegration,
} from '@noco-integrations/core';
import { parseJson } from '../utils/parseJson'
import type {
  FormDefinition,
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeLog,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';

interface ListRecordsNodeConfig extends WorkflowNodeConfig {
  modelId: string;
  viewId?: string
  limit?: number;
  offset?: number;
  filterJson?: string;
  sortJson?: string;
}

export class ListRecordsNode extends WorkflowNodeIntegration<ListRecordsNodeConfig> {
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
        type: FormBuilderInputType.Input,
        label: 'Limit',
        span: 12,
        model: 'config.limit',
        placeholder: '25',
      },
      {
        type: FormBuilderInputType.Input,
        label: 'Offset',
        span: 12,
        model: 'config.offset',
        placeholder: '0',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Filter JSON',
        span: 24,
        model: 'config.filterJson',
        placeholder: '{ "where": "(Title,eq,Active)" }',
      },
      {
        type: FormBuilderInputType.WorkflowInput,
        label: 'Sort JSON',
        span: 24,
        model: 'config.sortJson',
        placeholder: '{ "sort": "-CreatedAt" }',
      },
    ];

    return {
      id: 'nocodb.list_records',
      title: 'List Records',
      description: 'List records from a NocoDB table with optional filtering and sorting',
      icon: 'ncRecordFind',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      keywords: ['nocodb', 'database', 'list', 'query', 'search', 'records'],
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

  public async validate(config: ListRecordsNodeConfig) {
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

    if (config.filterJson) {
      try {
        parseJson(config.filterJson);
      } catch {
        errors.push({ path: 'config.filterJson', message: 'Invalid JSON' });
      }
    }

    if (config.sortJson) {
      try {
        parseJson(config.sortJson);
      } catch {
        errors.push({ path: 'config.sortJson', message: 'Invalid JSON' });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  public async run(
    ctx: WorkflowNodeRunContext<ListRecordsNodeConfig>,
  ): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      const { modelId, limit, offset, filterJson, sortJson, viewId } =
        ctx.inputs.config;

      logs.push({
        level: 'info',
        message: `Listing records from model ${modelId}`,
        ts: Date.now(),
      });

      const context = {
        workspace_id: ctx.workspaceId,
        base_id: ctx.baseId,
      } as NocoSDK.NcContext;

      const query: any = {};
      if (limit !== undefined) query.limit = limit;
      if (offset !== undefined) query.offset = offset;

      if (filterJson) {
        const filterObj = parseJson(filterJson);
        Object.assign(query, filterObj);
      }
      if (sortJson) {
        const sortObj = parseJson(sortJson);
        Object.assign(query, sortObj);
      }

      const result = await this.nocodb.dataService.dataList(
        context,
        {
          modelId,
          query,
          viewId,
          ignorePagination: false,
          req: {
            user: this.nocodb.user
          } as NocoSDK.NcRequest,
        },
        false,
      );

      const executionTime = Date.now() - startTime;

      const recordCount = result.length

      logs.push({
        level: 'info',
        message: `Retrieved ${recordCount} records`,
        ts: Date.now(),
      });

      return {
        outputs: {
          records: result || [],
          pagination: {
            limit,
            offset,
          }
        },
        status: 'success',
        logs,
        metrics: {
          recordsRetrieved: recordCount,
          executionTimeMs: executionTime,
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      logs.push({
        level: 'error',
        message: `Failed to list records: ${error.message}`,
        ts: Date.now(),
        data: error.response?.data || error.stack,
      });

      return {
        outputs: {},
        status: 'error',
        error: {
          message: error.message || 'Failed to list records',
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
          description: 'Selected table for listing records',
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
        key: 'config.limit',
        name: 'Limit',
        type: NocoSDK.VariableType.Number,
        groupKey: NocoSDK.VariableGroupKey.Fields,
        extra: {
          description: 'Maximum number of records to retrieve',
        },
      });

      variables.push({
        key: 'config.offset',
        name: 'Offset',
        type: NocoSDK.VariableType.Number,
        groupKey: NocoSDK.VariableGroupKey.Fields,
        extra: {
          description: 'Number of records to skip',
        },
      });

      variables.push({
        key: 'config.filterJson',
        name: 'Filter JSON',
        type: NocoSDK.VariableType.String,
        groupKey: NocoSDK.VariableGroupKey.Fields,
        extra: {
          description: 'JSON filter criteria',
        },
      });

      variables.push({
        key: 'config.sortJson',
        name: 'Sort JSON',
        type: NocoSDK.VariableType.String,
        groupKey: NocoSDK.VariableGroupKey.Fields,
        extra: {
          description: 'JSON sort criteria',
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

      const recordVariables = NocoSDK.genRecordVariables(table.columns, true, 'records');

      const paginationVariable: NocoSDK.VariableDefinition = {
        key: 'pagination',
        name: 'Pagination',
        type: NocoSDK.VariableType.Object,
        groupKey: NocoSDK.VariableGroupKey.Meta,
        extra: {
          description: 'Pagination information',
          icon: 'cellJson',
        },
        children: [
          {
            key: 'pagination.limit',
            name: 'Limit',
            type: NocoSDK.VariableType.Number,
            groupKey: NocoSDK.VariableGroupKey.Meta,
            extra: {
              description: 'Max number of records to retrieve',
              icon: 'cellNumber',
            },
          },
          {
            key: 'pagination.offset',
            name: 'Offset',
            type: NocoSDK.VariableType.Number,
            groupKey: NocoSDK.VariableGroupKey.Meta,
            extra: {
              description: 'Number of records skipped',
              icon: 'cellNumber',
            },
          },
        ],
      };

      return [...recordVariables, paginationVariable];
    } catch {
      return [];
    }
  }
}

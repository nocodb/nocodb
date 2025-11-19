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

interface ListRecordsNodeConfig extends WorkflowNodeConfig {
  modelId: string;
  limit?: number;
  offset?: number;
  filterJson?: string;
  sortJson?: string;
}

function parseJson(jsonString: object | string | undefined) {
  if (!jsonString) return undefined;
  if (typeof jsonString === 'object') return jsonString;
  try {
    return JSON.parse(jsonString);
  } catch {
    return undefined;
  }
}

export class ListRecordsNode extends WorkflowNodeIntegration<ListRecordsNodeConfig> {
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
        placeholder: 'Select a table',
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
        label: 'Limit',
        width: 50,
        model: 'config.limit',
        placeholder: '25',
      },
      {
        type: FormBuilderInputType.Input,
        label: 'Offset',
        width: 50,
        model: 'config.offset',
        placeholder: '0',
      },
      {
        type: FormBuilderInputType.Input,
        label: 'Filter JSON',
        width: 100,
        model: 'config.filterJson',
        placeholder: '{ "where": "(Title,eq,Active)" }',
      },
      {
        type: FormBuilderInputType.Input,
        label: 'Sort JSON',
        width: 100,
        model: 'config.sortJson',
        placeholder: '{ "sort": "-CreatedAt" }',
      },
    ];

    return {
      id: 'nocodb.list_records',
      title: 'List Records',
      description: 'List records from a NocoDB table with optional filtering and sorting',
      icon: 'nocodb',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      keywords: ['nocodb', 'database', 'list', 'query', 'search', 'records'],
    };
  }

  public async validate(config: ListRecordsNodeConfig) {
    const errors: { path?: string; message: string }[] = [];

    if (!config.modelId) {
      errors.push({ path: 'config.modelId', message: 'Table is required' });
    }

    // Validate filter and sort JSON if provided
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
      const { modelId, limit, offset, filterJson, sortJson } =
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

      // Build query object
      const query: any = {};
      if (limit !== undefined) query.limit = limit;
      if (offset !== undefined) query.offset = offset;

      // Merge filter and sort JSON if provided
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
          ignorePagination: false,
          req: {} as NocoSDK.NcRequest,
        },
        true,
      );

      const executionTime = Date.now() - startTime;

      const recordCount = Array.isArray(result)
        ? result.length
        : result.records?.length || 0;

      logs.push({
        level: 'info',
        message: `Retrieved ${recordCount} records`,
        ts: Date.now(),
      });

      return {
        outputs: {
          records: Array.isArray(result) ? result : result.records || [],
          pagination: Array.isArray(result)
            ? undefined
            : {
                next: result.next,
                prev: result.prev,
              },
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
}

import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  type FormDefinition,
  type NocoSDK,
  WorkflowNodeCategory,
  type WorkflowNodeDefinition,
  WorkflowNodeIntegration,
  type WorkflowNodeLog,
  type WorkflowNodeResult,
  type WorkflowNodeRunContext,
} from '@noco-integrations/core';
import type { IDataV3Service } from '../nocodb.interface';

export enum NocoDBOperation {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
}

interface NocoDBNodeConfig {
  operation: NocoDBOperation;
  modelId: string;
  // For read, update, delete
  rowId?: string;
  // For create, update
  fieldsJson?: string;
  // For list
  limit?: number;
  offset?: number;
  filterJson?: string;
  sortJson?: string;
}

export class NocoDBNode extends WorkflowNodeIntegration<NocoDBNodeConfig> {
  public definition(): WorkflowNodeDefinition {
    const form: FormDefinition = [
      {
        type: FormBuilderInputType.Select,
        label: 'Operation',
        width: 100,
        model: 'config.operation',
        placeholder: 'Select an operation',
        options: [
          { label: 'Create Record', value: NocoDBOperation.CREATE },
          { label: 'Read Record', value: NocoDBOperation.READ },
          { label: 'Update Record', value: NocoDBOperation.UPDATE },
          { label: 'Delete Record', value: NocoDBOperation.DELETE },
          { label: 'List Records', value: NocoDBOperation.LIST },
        ],
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Operation is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.Input,
        label: 'Table (Model) ID',
        width: 100,
        model: 'config.modelId',
        placeholder: 'Enter the model/table ID',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Model ID is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.Input,
        label: 'Record ID',
        width: 100,
        model: 'config.rowId',
        placeholder: 'Enter the record ID',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Record ID is required',
          },
        ],
      },
      {
        type: FormBuilderInputType.Input,
        label: 'Fields JSON',
        width: 100,
        model: 'config.fieldsJson',
        placeholder: '{ "Title": "Hello", "Status": "Active" }',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Fields JSON is required',
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
      key: 'nocodb.action.database',
      title: 'NocoDB',
      description: 'Perform operations on NocoDB tables (CRUD)',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      ui: { icon: 'nocodb', color: '#598eff' },
      keywords: [
        'nocodb',
        'database',
        'crud',
        'create',
        'read',
        'update',
        'delete',
        'list',
        'record',
      ],
    };
  }

  public async validate(config: NocoDBNodeConfig) {
    const errors: { path?: string; message: string }[] = [];

    if (!config.operation) {
      errors.push({
        path: 'config.operation',
        message: 'Operation is required',
      });
    }

    if (!config.modelId) {
      errors.push({ path: 'config.modelId', message: 'Model ID is required' });
    }

    // Validate based on operation
    if (
      [
        NocoDBOperation.READ,
        NocoDBOperation.UPDATE,
        NocoDBOperation.DELETE,
      ].includes(config.operation)
    ) {
      if (!config.rowId) {
        errors.push({
          path: 'config.rowId',
          message: 'Record ID is required for this operation',
        });
      }
    }

    if (
      [NocoDBOperation.CREATE, NocoDBOperation.UPDATE].includes(
        config.operation,
      )
    ) {
      if (!config.fieldsJson) {
        errors.push({
          path: 'config.fieldsJson',
          message: 'Fields JSON is required for this operation',
        });
      } else {
        try {
          const parsed = JSON.parse(config.fieldsJson);
          if (!parsed || typeof parsed !== 'object') {
            errors.push({
              path: 'config.fieldsJson',
              message: 'Fields JSON must parse to an object',
            });
          }
        } catch {
          errors.push({ path: 'config.fieldsJson', message: 'Invalid JSON' });
        }
      }
    }

    // Validate filter and sort JSON if provided
    if (config.filterJson) {
      try {
        JSON.parse(config.filterJson);
      } catch {
        errors.push({ path: 'config.filterJson', message: 'Invalid JSON' });
      }
    }

    if (config.sortJson) {
      try {
        JSON.parse(config.sortJson);
      } catch {
        errors.push({ path: 'config.sortJson', message: 'Invalid JSON' });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  public async run(
    ctx: WorkflowNodeRunContext<{ dataService: IDataV3Service }>,
  ): Promise<WorkflowNodeResult> {
    const { operation } = this.config;

    switch (operation) {
      case NocoDBOperation.CREATE:
        return this.runCreate(ctx);
      case NocoDBOperation.READ:
        return this.runRead(ctx);
      case NocoDBOperation.UPDATE:
        return this.runUpdate(ctx);
      case NocoDBOperation.DELETE:
        return this.runDelete(ctx);
      case NocoDBOperation.LIST:
        return this.runList(ctx);
      default:
        return {
          outputs: {},
          status: 'error',
          error: {
            message: `Unknown operation: ${operation}`,
          },
        };
    }
  }

  private async runCreate(
    ctx: WorkflowNodeRunContext<{ dataService: IDataV3Service }>,
  ): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      const { modelId, fieldsJson } = this.config;

      logs.push({
        level: 'info',
        message: `Creating record in model ${modelId}`,
        ts: Date.now(),
      });

      const fields = JSON.parse(fieldsJson!);

      const context = {
        workspace_id: ctx.workspaceId,
        base_id: ctx.baseId,
      } as NocoSDK.NcContext;

      const result = await ctx.custom!.dataService.dataInsert(context, {
        modelId,
        body: { fields },
        cookie: undefined,
      });

      const executionTime = Date.now() - startTime;

      logs.push({
        level: 'info',
        message: `Record created successfully`,
        ts: Date.now(),
        data: { recordId: result.records[0]?.id },
      });

      return {
        outputs: {
          record: result.records[0],
        },
        status: 'success',
        logs,
        metrics: {
          recordsCreated: result.records.length,
          executionTimeMs: executionTime,
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      logs.push({
        level: 'error',
        message: `Failed to create record: ${error.message}`,
        ts: Date.now(),
        data: error.response?.data || error.stack,
      });

      return {
        outputs: {},
        status: 'error',
        error: {
          message: error.message || 'Failed to create record',
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

  private async runRead(
    ctx: WorkflowNodeRunContext<{ dataService: IDataV3Service }>,
  ): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      const { modelId, rowId } = this.config;

      logs.push({
        level: 'info',
        message: `Reading record ${rowId} from model ${modelId}`,
        ts: Date.now(),
      });

      const context = {
        workspace_id: ctx.workspaceId,
        base_id: ctx.baseId,
      } as NocoSDK.NcContext;

      const result = await ctx.custom!.dataService.dataRead(context, {
        modelId,
        rowId: rowId!,
        query: {},
        req: {} as NocoSDK.NcRequest,
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
        message: `Failed to read record: ${error.message}`,
        ts: Date.now(),
        data: error.response?.data || error.stack,
      });

      return {
        outputs: {},
        status: 'error',
        error: {
          message: error.message || 'Failed to read record',
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

  private async runUpdate(
    ctx: WorkflowNodeRunContext<{ dataService: IDataV3Service }>,
  ): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      const { modelId, rowId, fieldsJson } = this.config;

      logs.push({
        level: 'info',
        message: `Updating record ${rowId} in model ${modelId}`,
        ts: Date.now(),
      });

      const fields = JSON.parse(fieldsJson!);

      const context = {
        workspace_id: ctx.workspaceId,
        base_id: ctx.baseId,
      } as NocoSDK.NcContext;

      const result = await ctx.custom!.dataService.dataUpdate(context, {
        modelId,
        body: { id: rowId!, fields },
        cookie: undefined,
      });

      const executionTime = Date.now() - startTime;

      logs.push({
        level: 'info',
        message: `Record updated successfully`,
        ts: Date.now(),
        data: { recordId: result.records[0]?.id },
      });

      return {
        outputs: {
          record: result.records[0],
        },
        status: 'success',
        logs,
        metrics: {
          recordsUpdated: result.records.length,
          executionTimeMs: executionTime,
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      logs.push({
        level: 'error',
        message: `Failed to update record: ${error.message}`,
        ts: Date.now(),
        data: error.response?.data || error.stack,
      });

      return {
        outputs: {},
        status: 'error',
        error: {
          message: error.message || 'Failed to update record',
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

  private async runDelete(
    ctx: WorkflowNodeRunContext<{ dataService: IDataV3Service }>,
  ): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      const { modelId, rowId } = this.config;

      logs.push({
        level: 'info',
        message: `Deleting record ${rowId} from model ${modelId}`,
        ts: Date.now(),
      });

      const context = {
        workspace_id: ctx.workspaceId,
        base_id: ctx.baseId,
      } as NocoSDK.NcContext;

      const result = await ctx.custom!.dataService.dataDelete(context, {
        modelId,
        body: { id: rowId! },
        cookie: undefined,
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

  private async runList(
    ctx: WorkflowNodeRunContext<{ dataService: IDataV3Service }>,
  ): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      const { modelId, limit, offset, filterJson, sortJson } = this.config;

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
        const filterObj = JSON.parse(filterJson);
        Object.assign(query, filterObj);
      }
      if (sortJson) {
        const sortObj = JSON.parse(sortJson);
        Object.assign(query, sortObj);
      }

      const result = await ctx.custom!.dataService.dataList(
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

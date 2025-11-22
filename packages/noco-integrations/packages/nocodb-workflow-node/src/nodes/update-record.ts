import {
  FormBuilderInputType,
  FormBuilderValidatorType,
  NocoSDK,
  WorkflowNodeCategory,
  WorkflowNodeIntegration
} from '@noco-integrations/core';

import { parseJson } from '../utils/parseJson'
import type {
  FormDefinition,
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeLog,
  WorkflowNodeResult,
  WorkflowNodeRunContext} from '@noco-integrations/core';

interface UpdateRecordNodeConfig extends WorkflowNodeConfig {
  modelId: string;
  rowId: string;
  fieldsJson: string;
}

export class UpdateRecordNode extends WorkflowNodeIntegration<UpdateRecordNodeConfig> {
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
        type: FormBuilderInputType.Input,
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
      {
        type: FormBuilderInputType.Input,
        label: 'Fields JSON',
        span: 24,
        model: 'config.fieldsJson',
        placeholder: '{ "Title": "Updated", "Status": "Complete" }',
        validators: [
          {
            type: FormBuilderValidatorType.Required,
            message: 'Fields JSON is required',
          },
        ],
      },
    ];

    return {
      id: 'nocodb.update_record',
      title: 'Update Record',
      description: 'Update an existing record in a NocoDB table',
      icon: 'ncRecordUpdate',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      keywords: ['nocodb', 'database', 'update', 'modify', 'record'],
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
          ncItemTooltip: table.synced? 'Records cannot be updated in synced tables': null,
          table: table
        }))
      }
      default:
        return [];
    }
  }

  public async validate(config: UpdateRecordNodeConfig) {
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

    if (!config.fieldsJson) {
      errors.push({
        path: 'config.fieldsJson',
        message: 'Fields JSON is required',
      });
    } else {
      try {
        const parsed = parseJson(config.fieldsJson);
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

    return { valid: errors.length === 0, errors };
  }

  public async run(
    ctx: WorkflowNodeRunContext<UpdateRecordNodeConfig>,
  ): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      const { modelId, rowId, fieldsJson } = ctx.inputs.config;

      logs.push({
        level: 'info',
        message: `Updating record ${rowId} in model ${modelId}`,
        ts: Date.now(),
      });

      const fields = parseJson(fieldsJson);

      const context = {
        workspace_id: ctx.workspaceId,
        base_id: ctx.baseId,
      } as NocoSDK.NcContext;

      const result = await this.nocodb.dataService.dataUpdate(context, {
        modelId,
        body: { id: rowId, fields },
        cookie: {
          user: this.nocodb.user
        },
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
}

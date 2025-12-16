import {
  NocoSDK,
  WorkflowNodeCategory,
  WorkflowNodeIntegration,
} from '@noco-integrations/core';
import { NON_EDITABLE_FIELDS } from '../utils/fields';
import type {
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeLog,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';

interface UpdateRecordNodeConfig extends WorkflowNodeConfig {
  modelId: string;
  rowId: string;
  fields: Record<string, string>;
}

export class UpdateRecordNode extends WorkflowNodeIntegration<UpdateRecordNodeConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    return {
      id: 'nocodb.update_record',
      title: 'Update Record',
      description: 'Update an existing record in a NocoDB table',
      icon: 'ncRecordUpdate',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form: [],
      keywords: ['nocodb', 'database', 'update', 'modify', 'record'],
    };
  }

  public async fetchOptions(key: 'tables' | 'fields') {
    switch (key) {
      case 'tables': {
        const tables = await this.nocodb.tablesService.getAccessibleTables(
          this.nocodb.context,
          {
            baseId: this.nocodb.context.base_id,
            roles: { [NocoSDK.ProjectRoles.EDITOR]: true },
          },
        );

        return tables.map((table: any) => ({
          label: table.title || table.table_name,
          value: table.id,
          ncItemDisabled: table.synced,
          ncItemTooltip: table.synced
            ? 'Records cannot be updated in synced tables'
            : null,
          table: table,
        }));
      }
      case 'fields': {
        if (!this.config.modelId) {
          return [];
        }

        const table =
          await this.nocodb.tablesService.getTableWithAccessibleViews(
            this.nocodb.context,
            {
              tableId: this.config.modelId,
              user: this.nocodb.user as any,
            },
          );

        if (!table || !table.columns) {
          return [];
        }

        return table.columns
          .filter((col: any) => !NocoSDK.isSystemColumn(col))
          .map((col: any) => ({
            label: col.title,
            value: col.title,
            ncItemDisabled: NocoSDK.isUIType(col, NON_EDITABLE_FIELDS),
            ncItemTooltip: NocoSDK.isUIType(col, NON_EDITABLE_FIELDS)
              ? 'Computed fields cannot be updated'
              : null,
            column: col,
          }));
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
      const table = await this.nocodb.tablesService.getTableWithAccessibleViews(
        this.nocodb.context,
        {
          tableId: config.modelId,
          user: {
            ...this.nocodb.user,
            roles: { [NocoSDK.ProjectRoles.EDITOR]: true },
          } as any,
        },
      );
      if (!table) {
        errors.push({
          path: 'config.modelId',
          message: 'Table is not accessible',
        });
      }
    }

    if (!config.rowId) {
      errors.push({
        path: 'config.rowId',
        message: 'Record ID is required',
      });
    }

    if (!config.fields || Object.keys(config.fields).length === 0) {
      errors.push({
        path: 'config.fields',
        message: 'At least one field is required',
      });
    } else if (typeof config.fields !== 'object') {
      errors.push({
        path: 'config.fields',
        message: 'Fields must be an object',
      });
    }

    return { valid: errors.length === 0, errors };
  }

  public async run(
    ctx: WorkflowNodeRunContext<UpdateRecordNodeConfig>,
  ): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      const { modelId, rowId, fields } = ctx.inputs.config;

      logs.push({
        level: 'info',
        message: `Updating record ${rowId} in model ${modelId}`,
        ts: Date.now(),
      });

      const context = {
        workspace_id: ctx.workspaceId,
        base_id: ctx.baseId,
        api_version: NocoSDK.NcApiVersion.V3,
      } as NocoSDK.NcContext;

      const table = await this.nocodb.tablesService.getTableWithAccessibleViews(
        this.nocodb.context,
        {
          tableId: modelId,
          user: this.nocodb.user as any,
        },
      );

      const transformedFields: Record<string, any> = {};
      if (table && table.columns) {
        Object.entries(fields).forEach(([fieldId, value]) => {
          const column = table.columns.find((col: any) => col.id === fieldId);
          if (column?.title) {
            transformedFields[column.title] = value;
          }
        });
      }

      const result = await this.nocodb.dataService.dataUpdate(context, {
        modelId,
        body: { id: rowId, fields: transformedFields },
        cookie: {
          user: this.nocodb.user,
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

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    const variables: NocoSDK.VariableDefinition[] = [];
    const { modelId, fields } = this.config;

    if (!modelId) return [];

    try {
      const table = await this.nocodb.tablesService.getTableWithAccessibleViews(
        this.nocodb.context,
        {
          tableId: modelId,
          user: this.nocodb.user as any,
        },
      );

      if (!table) return [];

      variables.push({
        key: 'config.modelId',
        name: 'Table',
        type: NocoSDK.VariableType.String,
        groupKey: NocoSDK.VariableGroupKey.Fields,
        extra: {
          icon: table.synced ? 'ncZap' : 'table',
          entity_id: modelId,
          entity: 'table',
          tableName: table.title,
          description: 'Selected table for record update',
        },
      });

      variables.push({
        key: 'config.rowId',
        name: 'Record ID',
        type: NocoSDK.VariableType.String,
        groupKey: NocoSDK.VariableGroupKey.Fields,
        extra: {
          icon: 'cellNumber',
          description: 'ID of the record to update',
        },
      });

      const fieldsVariable = {
        key: 'config.fields',
        name: 'Fields',
        type: NocoSDK.VariableType.Object,
        groupKey: NocoSDK.VariableGroupKey.Fields,
        children: [] as NocoSDK.VariableDefinition[],
        extra: {
          icon: 'cellJson',
          description: 'Field values for record update',
        },
      };

      Object.entries(fields).forEach(([fieldId, value]) => {
        const field = table.columns.find((col: any) => col.id === fieldId);
        if (!field?.uidt || !value) return;
        fieldsVariable.children.push({
          key: `config.fields.${fieldId}`,
          name: field.title!,
          type: NocoSDK.VariableType.String,
          groupKey: NocoSDK.VariableGroupKey.Fields,
          extra: {
            icon: NocoSDK.uiTypeToIcon(field),
            description: `Field value for ${field.title}`,
          },
        });
      });

      variables.push({
        key: 'config.fields',
        name: 'Fields',
        type: NocoSDK.VariableType.Object,
        groupKey: NocoSDK.VariableGroupKey.Fields,
        extra: {
          icon: 'cellJson',
          description: 'Field values for record update',
        },
      });

      return variables;
    } catch {
      return [];
    }
  }

  public async generateOutputVariables(
    context: NocoSDK.VariableGeneratorContext,
  ): Promise<NocoSDK.VariableDefinition[]> {
    const { modelId } = this.config;

    if (!modelId) return [];

    try {
      const table = await this.nocodb.tablesService.getTableWithAccessibleViews(
        this.nocodb.context,
        {
          tableId: modelId,
          user: this.nocodb.user as any,
        },
      );

      if (!table) return [];

      return await NocoSDK.genRecordVariables(
        table.columns,
        false,
        'record',
        context,
      );
    } catch {
      return [];
    }
  }
}

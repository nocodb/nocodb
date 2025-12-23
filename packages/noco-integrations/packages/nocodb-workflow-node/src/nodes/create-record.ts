import {
  NocoSDK,
  WorkflowNodeCategory,
  WorkflowNodeIntegration,
} from '@noco-integrations/core';
import { NON_EDITABLE_FIELDS, normalizeRelationInput } from '../utils/fields';
import type {
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeLog,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';

interface CreateRecordNodeConfig extends WorkflowNodeConfig {
  modelId: string;
  fields: Record<string, string>;
}

export class CreateRecordNode extends WorkflowNodeIntegration<CreateRecordNodeConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    return {
      id: 'nocodb.create_record',
      title: 'Create record',
      description: 'Create a new record in a NocoDB table',
      icon: 'ncRecordCreate',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form: [],
      keywords: ['nocodb', 'database', 'create', 'insert', 'record'],
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
            user: this.nocodb.user,
          },
        );

        return tables.map((table: any) => ({
          label: table.title || table.table_name,
          value: table.id,
          ncItemDisabled: table.synced,
          ncItemTooltip: table.synced
            ? 'Records cannot be created in synced tables'
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
            ncItemDisabled: NocoSDK.isInUIType(col, NON_EDITABLE_FIELDS),
            ncItemTooltip: NocoSDK.isInUIType(col, NON_EDITABLE_FIELDS)
              ? 'Computed fields cannot be added'
              : null,
            column: col,
          }));
      }
      default:
        return [];
    }
  }

  public async validate(config: CreateRecordNodeConfig) {
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

    if (!config.fields || Object.keys(config.fields).length === 0) {
      errors.push({
        path: 'config.fields',
        message: 'At least one field is required',
      });
    } else if (typeof config.fields !== 'object') {
      errors.push({
        path: 'config.fields',
        message: 'Field mapping must be an object',
      });
    }

    return { valid: errors.length === 0, errors };
  }

  public async run(
    ctx: WorkflowNodeRunContext<CreateRecordNodeConfig>,
  ): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      const { modelId, fields } = ctx.inputs.config;

      logs.push({
        level: 'info',
        message: `Creating record in model ${modelId}`,
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
          if (!column || !column.title) return;
          if (column?.title) {
            transformedFields[column.title] = value;
          }

          if (NocoSDK.isLinksOrLTAR(column)) {
            transformedFields[column.title] = normalizeRelationInput(value);
          }
        });
      }

      const result = await this.nocodb.dataService.dataInsert(context, {
        modelId,
        body: { fields: transformedFields },
        cookie: {
          user: this.nocodb.user,
        },
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
          entity_id: modelId,
          entity: 'table',
          icon: table.synced ? 'ncZap' : 'table',
          tableName: table.title,
          description: 'Selected table for record creation',
        },
      });

      const fieldsVariable = {
        key: 'config.fields',
        name: 'Fields',
        type: NocoSDK.VariableType.Object,
        groupKey: NocoSDK.VariableGroupKey.Fields,
        children: [] as NocoSDK.VariableDefinition[],
        extra: {
          description: 'Field values for record creation',
          icon: 'fields',
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
            entity_id: field.id,
            entity: 'column',
            description: `Field value for ${field.title}`,
            icon: NocoSDK.uiTypeToIcon(field),
          },
        });
      });

      variables.push(fieldsVariable);

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

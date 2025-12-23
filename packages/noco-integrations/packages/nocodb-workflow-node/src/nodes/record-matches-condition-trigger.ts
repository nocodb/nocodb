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

interface FilterCondition {
  fk_column_id?: string;
  comparison_op?: string;
  value?: any;
  logical_op?: 'and' | 'or';
  is_group?: boolean;
  children?: FilterCondition[];
}

interface RecordMatchesConditionTriggerConfig extends WorkflowNodeConfig {
  modelId: string;
  filters: FilterCondition[];
}

export class RecordMatchesConditionTriggerNode extends WorkflowNodeIntegration<RecordMatchesConditionTriggerConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    const form: FormDefinition = [
      {
        type: FormBuilderInputType.SelectTable,
        label: 'Select Table',
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
      id: 'nocodb.trigger.record_matches_condition',
      title: 'When record matches conditions',
      description: 'Triggers when a record matches filter conditions',
      icon: 'ncFilter',
      category: WorkflowNodeCategory.TRIGGER,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form,
      keywords: ['trigger', 'filter', 'condition', 'matches', 'custom'],
    };
  }

  public async fetchOptions(key: 'tables' | 'columns') {
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
          table,
        }));
      }
      case 'columns': {
        if (!this.config.modelId) {
          return [];
        }
        const table =
          await this.nocodb.tablesService.getTableWithAccessibleViews(
            this.nocodb.context,
            {
              tableId: this.config.modelId,
              user: {
                ...this.nocodb.user,
                roles: { [NocoSDK.ProjectRoles.EDITOR]: true },
              } as any,
            },
          );

        return table.columns.map((column: any) => ({
          label: column.title || column.column_name,
          value: column.id,
          column: column,
        }));
      }
      default:
        return [];
    }
  }

  public async validate(config: RecordMatchesConditionTriggerConfig) {
    const errors: { path?: string; message: string }[] = [];

    if (!config.modelId) {
      errors.push({ path: 'config.modelId', message: 'Table is required' });
    }

    if (!config.filters || config.filters.length === 0) {
      errors.push({
        path: 'config.filters',
        message: 'At least one filter condition is required',
      });
    }

    // Validate filters structure
    if (config.filters && config.filters.length > 0) {
      const validateFilter = (filter: FilterCondition, path: string) => {
        if (filter.is_group) {
          if (!filter.children || filter.children.length === 0) {
            errors.push({
              path: `${path}.children`,
              message: 'Filter group must have at least one child',
            });
          } else {
            filter.children.forEach((child, idx) => {
              validateFilter(child, `${path}.children[${idx}]`);
            });
          }
        } else {
          if (!filter.fk_column_id) {
            errors.push({
              path: `${path}.fk_column_id`,
              message: 'Column is required for filter',
            });
          }
          if (!filter.comparison_op) {
            errors.push({
              path: `${path}.comparison_op`,
              message: 'Comparison operator is required',
            });
          }
        }
      };

      config.filters.forEach((filter, idx) => {
        validateFilter(filter, `config.filters[${idx}]`);
      });
    }

    if (config.modelId) {
      try {
        const table =
          await this.nocodb.tablesService.getTableWithAccessibleViews(
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
      } catch {
        errors.push({
          path: 'config.modelId',
          message: 'Failed to validate table',
        });
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
            user: this.nocodb.user,
          } as any,
        },
        false,
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
        const table =
          await this.nocodb.tablesService.getTableWithAccessibleViews(
            this.nocodb.context,
            {
              tableId: this.config.modelId,
              user: this.nocodb.user as any,
            },
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
            message:
              'No records found in table, using empty object for testing',
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
        message: 'Record matches condition trigger activated',
        ts: Date.now(),
        data: {
          recordId: newData?.id,
          userId: user?.id,
          filtersCount: this.config.filters?.length || 0,
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
            type: 'record-matches-condition',
          },
          user: {
            id: user?.id,
            name: user?.display_name,
            email: user?.email,
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
        message: `Record matches condition trigger failed: ${error.message}`,
        ts: Date.now(),
        data: error.stack,
      });

      return {
        outputs: {},
        status: 'error',
        error: {
          message: error.message || 'Record matches condition trigger failed',
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
    const { modelId, filters } = this.config;

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

      const variables: NocoSDK.VariableDefinition[] = [
        {
          key: 'config.modelId',
          name: 'Table',
          type: NocoSDK.VariableType.String,
          groupKey: NocoSDK.VariableGroupKey.Fields,
          extra: {
            icon: table.synced ? 'ncZap' : 'table',
            entity_id: modelId,
            entity: 'table',
            tableName: table.title,
            description: 'Table to monitor',
          },
        },
      ];

      // Add filter variables if filters exist
      if (filters?.length) {
        // Calculate max depth of nested filters
        const getMaxDepth = (
          filterItems: FilterCondition[],
          depth = 0,
        ): number => {
          let maxDepth = depth;
          filterItems.forEach((filter) => {
            if (
              filter.is_group &&
              filter.children &&
              filter.children.length > 0
            ) {
              const childDepth = getMaxDepth(filter.children, depth + 1);
              maxDepth = Math.max(maxDepth, childDepth);
            }
          });
          return maxDepth;
        };

        // Recursively collect all column IDs from filters
        const collectColumnIds = (filterItems: FilterCondition[]): string[] => {
          const columnIds: string[] = [];
          filterItems.forEach((filter) => {
            if (filter.is_group && filter.children) {
              columnIds.push(...collectColumnIds(filter.children));
            } else if (filter.fk_column_id) {
              columnIds.push(filter.fk_column_id);
            }
          });
          return columnIds;
        };

        const maxDepth = getMaxDepth(filters);
        const columnIds = collectColumnIds(filters);
        const referencedColumns = table.columns.filter(
          (col) => col?.id && columnIds.includes(col.id),
        );

        // Build filter item schema with limited recursion depth
        const buildFilterItemSchema = (
          currentDepth: number,
        ): NocoSDK.VariableDefinition[] => {
          const schema: NocoSDK.VariableDefinition[] = [
            {
              key: 'fk_column_id',
              name: 'Column',
              type: NocoSDK.VariableType.String,
              groupKey: NocoSDK.VariableGroupKey.Fields,
              extra: {
                icon: 'fields',
                description: 'Column to filter on',
                entity: 'column', // Mark this field type
              },
            },
            {
              key: 'comparison_op',
              name: 'Comparison Operator',
              type: NocoSDK.VariableType.String,
              groupKey: NocoSDK.VariableGroupKey.Fields,
              extra: {
                icon: 'cellText',
                description: 'Comparison operator (eq, neq, gt, lt, etc.)',
              },
            },
            {
              key: 'value',
              name: 'Value',
              type: NocoSDK.VariableType.String,
              groupKey: NocoSDK.VariableGroupKey.Fields,
              extra: {
                icon: 'cellText',
                description: 'Filter value',
              },
            },
            {
              key: 'logical_op',
              name: 'Logical Operator',
              type: NocoSDK.VariableType.String,
              groupKey: NocoSDK.VariableGroupKey.Fields,
              extra: {
                icon: 'cellText',
                description: 'Logical operator (and/or)',
              },
            },
          ];

          // Only add children field if we haven't reached max depth
          if (currentDepth < maxDepth) {
            schema.push({
              key: 'children',
              name: 'Children',
              type: NocoSDK.VariableType.Array,
              groupKey: NocoSDK.VariableGroupKey.Fields,
              extra: {
                icon: 'ncFilter',
                description: 'Nested filter group children',
                itemSchema: buildFilterItemSchema(currentDepth + 1),
              },
            });
          }

          return schema;
        };

        variables.push({
          key: 'config.filters',
          name: 'Filters',
          type: NocoSDK.VariableType.Array,
          groupKey: NocoSDK.VariableGroupKey.Fields,
          extra: {
            icon: 'ncFilter',
            description: 'Filter criteria for records',
            entityReferences: referencedColumns.map((col) => ({
              entity_id: col.id!,
              entity: 'column',
              title: col.title!,
              field: 'fk_column_id',
            })),
            itemSchema: buildFilterItemSchema(0),
          },
        });
      }

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

      const recordVariables = await NocoSDK.genRecordVariables(
        table.columns,
        false,
        'record',
        context,
      );

      // Table group
      const tableVariable: NocoSDK.VariableDefinition = {
        key: 'table',
        name: 'Table',
        type: NocoSDK.VariableType.Object,
        groupKey: NocoSDK.VariableGroupKey.Meta,
        extra: {
          description: 'Table information',
          icon: table.synced ? 'ncZap' : 'table',
          entity_id: modelId,
          entity: 'table',
        },
        children: [
          {
            key: 'table.id',
            name: 'ID',
            type: NocoSDK.VariableType.String,
            groupKey: NocoSDK.VariableGroupKey.Meta,
            extra: {
              description: 'Table ID',
              icon: 'cellNumber',
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
            type: NocoSDK.VariableType.DateTime,
            groupKey: NocoSDK.VariableGroupKey.Meta,
            extra: {
              description: 'When the record matched the conditions',
              icon: 'cellDatetime',
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

      const userVariables: NocoSDK.VariableDefinition = {
        key: 'user',
        name: 'User',
        type: NocoSDK.VariableType.Object,
        groupKey: NocoSDK.VariableGroupKey.Meta,
        extra: {
          description: 'User who triggered the change',
          icon: 'ncUser',
        },
        children: [
          {
            key: 'user.id',
            name: 'ID',
            type: NocoSDK.VariableType.String,
            groupKey: NocoSDK.VariableGroupKey.Meta,
            extra: {
              description: 'User ID',
              icon: 'cellNumber',
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
      };

      return [
        ...recordVariables,
        tableVariable,
        triggerVariable,
        userVariables,
      ];
    } catch {
      return [];
    }
  }
}

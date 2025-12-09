import {
  NocoSDK,
  WorkflowNodeCategory,
  WorkflowNodeIntegration,
} from '@noco-integrations/core';
import type {
  WorkflowNodeConfig,
  WorkflowNodeDefinition,
  WorkflowNodeLog,
  WorkflowNodeResult,
  WorkflowNodeRunContext,
} from '@noco-integrations/core';

interface FilterItem {
  fk_column_id?: string;
  comparison_op?: string;
  value?: any;
  logical_op?: 'and' | 'or';
  is_group?: boolean;
  children?: FilterItem[];
}

interface ListRecordsNodeConfig extends WorkflowNodeConfig {
  modelId: string;
  viewId?: string;
  limit?: number;
  offset?: number;
  sorts?: Array<{ fk_column_id: string; direction: 'asc' | 'desc' }>;
  filters?: FilterItem[];
}

export class ListRecordsNode extends WorkflowNodeIntegration<ListRecordsNodeConfig> {
  public async definition(): Promise<WorkflowNodeDefinition> {
    return {
      id: 'nocodb.list_records',
      title: 'List Records',
      description:
        'List records from a NocoDB table with optional filtering and sorting',
      icon: 'ncRecordFind',
      category: WorkflowNodeCategory.ACTION,
      ports: [{ id: 'output', direction: 'output', order: 0 }],
      form: [],
      keywords: ['nocodb', 'database', 'list', 'query', 'search', 'records'],
    };
  }

  public async fetchOptions(key: 'tables' | 'views' | 'columns') {
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
          table: table,
        }));
      }
      case 'views': {
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

        return table.views.map((view: any) => ({
          label: view.title || table.table_name,
          value: view.id,
          view: view,
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

  public async validate(config: ListRecordsNodeConfig) {
    const errors: { path?: string; message: string }[] = [];

    if (!config.modelId) {
      errors.push({ path: 'config.modelId', message: 'Table is required' });
    }

    let table: (NocoSDK.TableType & { views: NocoSDK.ViewType[] }) | undefined;

    if (config.modelId) {
      table = await this.nocodb.tablesService.getTableWithAccessibleViews(
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

    if (config.modelId && config.viewId && table) {
      const view = table.views?.find((v) => v.id === config.viewId);

      if (!view) {
        errors.push({
          path: 'config.viewId',
          message: 'Selected view is invalid',
        });
      }
    }

    if (config.filters) {
      const validateFilter = (filter: FilterItem, path: string) => {
        if (filter.is_group) {
          // Validate filter group
          if (filter.children && Array.isArray(filter.children)) {
            filter.children.forEach((child, index) => {
              validateFilter(child, `${path}.children[${index}]`);
            });
          }
        } else {
          // Validate regular filter
          if (!filter.fk_column_id) {
            errors.push({
              path: path,
              message: 'Filter must have a column ID',
            });
          } else if (table?.columns) {
            const column = table.columns.find(
              (c) => c.id === filter.fk_column_id,
            );
            if (!column) {
              errors.push({
                path: path,
                message: 'Invalid column in filter',
              });
            }
          }
        }
      };

      config.filters.forEach((filter, index) => {
        validateFilter(filter, `config.filters[${index}]`);
      });
    }

    if (config.sorts) {
      config.sorts.forEach((sort) => {
        if (!sort.fk_column_id || !sort.direction) {
          errors.push({ path: 'config.sorts', message: 'Invalid sort' });
        }

        if (table?.columns) {
          const column = table.columns.find((c) => c.id === sort.fk_column_id);
          if (!column) {
            errors.push({ path: 'config.sorts', message: 'Invalid sort' });
          }
        }
      });
    }

    return { valid: errors.length === 0, errors };
  }

  public async run(
    ctx: WorkflowNodeRunContext<ListRecordsNodeConfig>,
  ): Promise<WorkflowNodeResult> {
    const logs: WorkflowNodeLog[] = [];
    const startTime = Date.now();

    try {
      const { modelId, limit, offset, filters, sorts, viewId } =
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

      if (filters) {
        Object.assign(query, {
          filterArrJson: JSON.stringify(filters),
        });
      }
      if (sorts) {
        Object.assign(query, {
          sort: JSON.stringify(
            sorts.map((sort) => ({
              field: sort.fk_column_id,
              direction: sort.direction,
            })),
          ),
        });
      }

      const result = await this.nocodb.dataService.dataList(
        context,
        {
          modelId,
          query,
          viewId,
          ignorePagination: false,
          req: {
            user: this.nocodb.user,
          } as NocoSDK.NcRequest,
        },
        false,
      );

      const executionTime = Date.now() - startTime;

      const recordCount = result.length;

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

  public async generateInputVariables(): Promise<NocoSDK.VariableDefinition[]> {
    const variables: NocoSDK.VariableDefinition[] = [];
    const { modelId, viewId, filters, sorts } = this.config;

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

      const iconMap = {
        [NocoSDK.ViewTypes.FORM]: 'form',
        [NocoSDK.ViewTypes.GRID]: 'grid',
        [NocoSDK.ViewTypes.KANBAN]: 'kanban',
        [NocoSDK.ViewTypes.CALENDAR]: 'calendar',
        [NocoSDK.ViewTypes.GALLERY]: 'gallery',
        [NocoSDK.ViewTypes.MAP]: 'map',
      };

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
          description: 'Selected table for listing records',
        },
      });

      const view = viewId && table.views?.find((v) => v.id === viewId);

      if (view) {
        variables.push({
          key: 'config.viewId',
          name: 'View',
          type: NocoSDK.VariableType.String,
          groupKey: NocoSDK.VariableGroupKey.Fields,
          extra: {
            icon: view?.type
              ? iconMap[view.type as keyof typeof iconMap]
              : 'view',
            entity_id: viewId,
            entity: 'view',
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
          icon: 'cellNumber',
          description: 'Maximum number of records to retrieve',
        },
      });

      variables.push({
        key: 'config.offset',
        name: 'Offset',
        type: NocoSDK.VariableType.Number,
        groupKey: NocoSDK.VariableGroupKey.Fields,
        extra: {
          icon: 'cellNumber',
          description: 'Number of records to skip',
        },
      });

      if (filters?.length) {
        // Calculate max depth of nested filters
        const getMaxDepth = (filterItems: FilterItem[], depth = 0): number => {
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
        const collectColumnIds = (filterItems: FilterItem[]): string[] => {
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
        const buildFilterItemSchema = (currentDepth: number): any[] => {
          const schema: any[] = [
            {
              key: 'fk_column_id',
              name: 'Column',
              type: NocoSDK.VariableType.String,
              groupKey: NocoSDK.VariableGroupKey.Fields,
              extra: {
                icon: 'fields',
                description: 'Column ID',
                entity: 'column',
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

      if (sorts?.length) {
        const columnIds = sorts
          .map((sort) => sort.fk_column_id)
          .filter(Boolean);

        const referencedColumns = table.columns.filter(
          (col) => col?.id && columnIds.includes(col.id),
        );

        variables.push({
          key: 'config.sorts',
          name: 'Sorts',
          type: NocoSDK.VariableType.Array,
          groupKey: NocoSDK.VariableGroupKey.Fields,
          extra: {
            icon: 'sort',
            description: 'Sort criteria',
            entityReferences: referencedColumns.map((col) => ({
              entity_id: col.id!,
              entity: 'column',
              title: col.title!,
              field: 'fk_column_id',
            })),
            itemSchema: [
              {
                key: 'fk_column_id',
                name: 'Column',
                type: NocoSDK.VariableType.String,
                groupKey: NocoSDK.VariableGroupKey.Fields,
                extra: {
                  icon: 'fields',
                  description: 'Column ID',
                  entity: 'column', // Mark this field type
                },
              },
              {
                key: 'direction',
                name: 'Direction',
                type: NocoSDK.VariableType.String,
                groupKey: NocoSDK.VariableGroupKey.Fields,
                extra: {
                  icon: 'cellText',
                  description: 'Sort direction (asc/desc)',
                },
              },
            ],
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
        true,
        'records',
        context,
      );

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

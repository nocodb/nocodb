import { Injectable } from '@nestjs/common';
import {
  extractRolesObj,
  IntegrationCategoryType,
  type RelationTypes,
  stringToViewTypeMap,
  UITypes,
  ViewTypes,
  viewTypeToStringMap,
} from 'nocodb-sdk';

import { z } from 'zod';
import type { SerializedAiTableType, SerializedAiViewType } from 'nocodb-sdk';
import type GridViewColumn from '~/models/GridViewColumn';
import type CalendarView from '~/models/CalendarView';
import type Column from '~/models/Column';
import type { NcContext } from '~/interface/config';
import type { AiIntegration } from '@noco-integrations/core';
import type { View } from '~/models';
import Base from '~/models/Base';
import Model from '~/models/Model';

import { TablesService } from '~/services/tables.service';
import { ColumnsService } from '~/services/columns.service';
import { FiltersService } from '~/services/filters.service';
import { SortsService } from '~/services/sorts.service';
import { ViewColumnsService } from '~/services/view-columns.service';
import { GridColumnsService } from '~/services/grid-columns.service';
import { GridsService } from '~/services/grids.service';
import { FormsService } from '~/services/forms.service';
import { CalendarsService } from '~/services/calendars.service';
import { GalleriesService } from '~/services/galleries.service';
import { KanbansService } from '~/services/kanbans.service';
import { DataTableService } from '~/services/data-table.service';
import { Integration } from '~/models';
import {
  generateDummyDataPrompt,
  generateDummyDataSystemMessage,
  generateTablesPrompt,
  generateTablesSystemMessage,
  generateViewsSystemMessage,
  predictSchemaPrompt,
  predictSchemaSystemMessage,
  predictViewsPrompt,
} from '~/integrations/ai/module/prompts/index';

@Injectable()
export class AiSchemaService {
  constructor(
    protected readonly tablesService: TablesService,
    protected readonly columnsService: ColumnsService,
    private filtersService: FiltersService,
    private sortsService: SortsService,
    private viewColumnsService: ViewColumnsService,
    private gridColumnsService: GridColumnsService,
    private gridsService: GridsService,
    private formsService: FormsService,
    private galleriesService: GalleriesService,
    private calendarsService: CalendarsService,
    private kanbansService: KanbansService,
    private dataTableService: DataTableService,
  ) {}

  async predictSchema(
    context: NcContext,
    params: {
      input: string;
      instructions?: string;
      req?: any;
    },
  ) {
    const { input, instructions } = params;

    const integration = await Integration.getCategoryDefault(
      context,
      IntegrationCategoryType.AI,
    );

    if (!integration) {
      throw new Error('AI integration not found');
    }

    const wrapper = await integration.getIntegrationWrapper<AiIntegration>();

    const { data, usage } = await wrapper.generateObject<
      SerializedAiTableType & {
        views?: SerializedAiViewType[];
      }
    >({
      schema: z.object({
        title: z.string(),
        tables: z.array(
          z.object({
            title: z.string(),
            columns: z.array(
              z.object({
                title: z.string(),
                type: z.enum([
                  'SingleLineText',
                  'LongText',
                  'Attachment',
                  'Checkbox',
                  'MultiSelect',
                  'SingleSelect',
                  'Date',
                  'Year',
                  'Time',
                  'PhoneNumber',
                  'Email',
                  'URL',
                  'Number',
                  'Decimal',
                  'Currency',
                  'Percent',
                  'Duration',
                  'Rating',
                  'DateTime',
                  'JSON',
                ]),
                options: z.array(z.string()).optional(),
              }),
            ),
          }),
        ),
        relationships: z.array(
          z.object({
            from: z.string(),
            to: z.string(),
            type: z.enum(['oo', 'hm', 'mm']),
          }),
        ),
        views: z.array(
          z.object({
            type: z.enum(['grid', 'kanban', 'calendar', 'form', 'gallery']),
            table: z.string(),
            title: z.string(),
            filters: z
              .array(
                z.object({
                  comparison_op: z.string(),
                  logical_op: z.string(),
                  value: z.string().nullable().optional(),
                  column: z.string(),
                }),
              )
              .optional(),
            sorts: z
              .array(
                z.object({
                  column: z.string(),
                  order: z.enum(['asc', 'desc']),
                }),
              )
              .optional(),
            calendar_range: z
              .array(
                z.object({
                  from_column: z.string(),
                }),
              )
              .or(
                z.object({
                  from_column: z.string(),
                }),
              )
              .optional(),
            gridGroupBy: z.string().or(z.array(z.string())).optional(),
            kanbanGroupBy: z.string().optional(),
          }),
        ),
      }),
      messages: [
        {
          role: 'system',
          content: predictSchemaSystemMessage(),
        },
        {
          role: 'user',
          content: predictSchemaPrompt(input, instructions),
        },
      ],
    });

    await integration.storeInsert(context, params.req?.user?.id, usage);

    // Populate ID columns
    for (const table of data.tables || []) {
      // Skip if ID column already exists
      if (table.columns.some((col) => col.type === 'ID')) {
        continue;
      }

      table.columns.unshift({
        title: 'Id',
        type: 'ID',
      });
    }

    return {
      title: input.trim().substring(0, 50),
      ...data,
    };
    // return this.createSchema(context, { base, schema: data, req });
  }

  async generateTables(
    context: NcContext,
    params: {
      baseId: string;
      input: string | string[];
      instructions?: string;
      req?: any;
    },
  ) {
    const { baseId, instructions, req } = params;

    const base = await Base.get(context, baseId);

    if (!base) {
      throw new Error('Base not found');
    }

    const integration = await Integration.getCategoryDefault(
      context,
      IntegrationCategoryType.AI,
    );

    if (!integration) {
      throw new Error('AI integration not found');
    }

    const wrapper = await integration.getIntegrationWrapper<AiIntegration>();

    const input = Array.isArray(params.input) ? params.input : [params.input];

    const existingSchema = await this.serializeSchema(context, {
      baseId: base.id,
      req,
    });

    // we don't need views for generating tables
    delete existingSchema.views;

    const { data, usage } = await wrapper.generateObject<SerializedAiTableType>(
      {
        schema: z.object({
          tables: z
            .array(
              z.object({
                title: z.string(),
                description: z.string().nullable().optional(),
                columns: z.array(
                  z.object({
                    title: z.string(),
                    type: z.enum([
                      'SingleLineText',
                      'LongText',
                      'Attachment',
                      'Checkbox',
                      'MultiSelect',
                      'SingleSelect',
                      'Date',
                      'Year',
                      'Time',
                      'PhoneNumber',
                      'Email',
                      'URL',
                      'Number',
                      'Decimal',
                      'Currency',
                      'Percent',
                      'Duration',
                      'Rating',
                      'DateTime',
                      'JSON',
                    ]),
                    options: z.array(z.string()).optional(),
                  }),
                ),
              }),
            )
            .optional(),
          relationships: z
            .array(
              z.object({
                from: z.string(),
                to: z.string(),
                type: z.enum(['oo', 'hm', 'mm']),
              }),
            )
            .optional()
            .default([]), // Ensure default empty array if relationships are not provided
        }),
        messages: [
          {
            role: 'system',
            content: generateTablesSystemMessage(),
          },
          {
            role: 'user',
            content: generateTablesPrompt(
              base.title,
              input,
              instructions,
              JSON.stringify(existingSchema),
            ),
          },
        ],
      },
    );

    await integration.storeInsert(context, params.req?.user?.id, usage);

    // Populate ID columns
    for (const table of data.tables || []) {
      // Skip if ID column already exists
      if (table.columns.some((col) => col.type === 'ID')) {
        continue;
      }

      table.columns.unshift({
        title: 'Id',
        type: 'ID',
      });
    }

    return this.createSchema(context, { base, schema: data, req }).then(
      (res) => res.tables,
    );
  }

  public async createSchema(
    context: NcContext,
    params: {
      base?: Base;
      baseId?: string;
      schema: SerializedAiTableType & {
        views?: SerializedAiViewType[];
      };
      req: any;
    },
  ) {
    if (!params.base && !params.baseId) {
      throw new Error('Base not found');
    }

    if (params.baseId) {
      params.base = await Base.get(context, params.baseId);
    }

    const { base, schema, req } = params;

    const tables = schema.tables || [];
    const relationships = schema.relationships || [];

    const generatedTables = [];

    for (const table of tables) {
      generatedTables.push(
        await this.tablesService.tableCreate(context, {
          baseId: base.id,
          table: {
            title: table.title,
            table_name: table.title,
            description: table.description || null,
            columns: table.columns.map((column, i) => ({
              title: column.title,
              column_name: column.title,
              uidt: column.type as UITypes,
              ...(column.options && column.options.length > 0
                ? {
                    colOptions: {
                      options: column.options.map((option) => ({
                        title: option,
                      })),
                    },
                  }
                : {}),
              ...(i === 1 ? { pv: true } : {}),
            })),
          },
          user: req.user,
          req,
        }),
      );
    }

    const generatedLinksFromTo = [];

    for (const relation of relationships) {
      // Skip if same direction relation already exists
      if (
        generatedLinksFromTo.some(
          (r) => r.from === relation.from && r.to === relation.to,
        )
      ) {
        continue;
      }

      const tables = await Model.list(context, {
        base_id: base.id,
        source_id: undefined,
      });

      const fromTable = tables.find((table) => table.title === relation.from);
      const toTable = tables.find((table) => table.title === relation.to);

      if (fromTable && toTable) {
        await this.columnsService.columnAdd(context, {
          tableId: fromTable.id,
          column: {
            title: toTable.title,
            column_name: toTable.title.replace(/\W/g, '_').toLowerCase(),
            uidt: 'Links',
            type: relation.type as RelationTypes,
            parentId: fromTable.id,
            childId: toTable.id,
          },
          user: req.user,
          req,
        });
      }

      generatedLinksFromTo.push(relation);
    }

    if (schema.views) {
      await this.createViews(context, { base, views: schema.views, req });
    }

    return {
      ...base,
      tables: generatedTables,
    };
  }

  async predictViews(
    context: NcContext,
    params: {
      baseId: string;
      tableIds?: string[];
      history?: any[];
      instructions?: string;
      type?: string;
      req?: any;
    },
  ) {
    const { baseId, tableIds, history, instructions, req } = params;

    const viewType =
      params.type && stringToViewTypeMap[params.type] !== undefined
        ? params.type
        : undefined;

    const base = await Base.get(context, baseId);

    if (!base) {
      throw new Error('Base not found');
    }

    const integration = await Integration.getCategoryDefault(
      context,
      IntegrationCategoryType.AI,
    );

    if (!integration) {
      throw new Error('AI integration not found');
    }

    const wrapper = await integration.getIntegrationWrapper<AiIntegration>();

    const serializedSchema = await this.serializeSchema(context, {
      baseId: base.id,
      tableIds,
      predictedViews: history,
      viewType,
      req,
    });

    const { data, usage } = await wrapper.generateObject<{
      views: SerializedAiViewType[];
    }>({
      schema: z.object({
        views: z.array(
          z.object({
            type: z.string(),
            table: z.string(),
            title: z.string(),
            description: z.string().optional(),
            filters: z
              .array(
                z.object({
                  comparison_op: z.string(),
                  logical_op: z.string(),
                  value: z.string().nullable().optional(),
                  column: z.string(),
                }),
              )
              .optional(),
            sorts: z
              .array(
                z.object({
                  column: z.string(),
                  order: z.enum(['asc', 'desc']),
                }),
              )
              .optional(),
            calendar_range: z
              .array(
                z.object({
                  from_column: z.string(),
                }),
              )
              .or(
                z.object({
                  from_column: z.string(),
                }),
              )
              .optional(),
            gridGroupBy: z.string().or(z.array(z.string())).optional(),
            kanbanGroupBy: z.string().optional(),
          }),
        ),
      }),
      messages: [
        {
          role: 'system',
          content: generateViewsSystemMessage(),
        },
        {
          role: 'user',
          content: predictViewsPrompt(
            JSON.stringify(serializedSchema),
            instructions,
            viewType,
          ),
        },
      ],
    });

    await integration.storeInsert(context, params.req?.user?.id, usage);

    // Filter out duplicate views
    {
      const resViews = data.views || [];

      data.views = resViews.filter((pv) => {
        const filterByViewType = viewType ? viewType === pv.type : true;

        const filterByExistingView = (
          serializedSchema.views as SerializedAiViewType[]
        ).some((sv) => sv.title === pv.title && sv.type === pv.title);

        return filterByViewType && !filterByExistingView;
      });
    }

    return data;
  }

  async createViews(
    context: NcContext,
    params: {
      base: Base;
      views?: SerializedAiViewType[];
      req: any;
    },
  ) {
    const { base, views = [], req } = params;

    const sources = await base.getSources();

    if (!sources || sources.length === 0) {
      throw new Error('No sources found');
    }

    const source = sources[0];

    const createdViews: View[] = [];

    for (const view of views) {
      const tables = await this.tablesService.getAccessibleTables(context, {
        baseId: base.id,
        sourceId: source.id,
        includeM2M: false,
        roles: extractRolesObj(req.user.base_roles),
      });

      const table = tables.find((t) => t.title === view.table);

      if (!table) {
        throw new Error('Table not found');
      }

      await table.getColumns(context);

      const getColumnId = (columnTitle: string) => {
        const column = table.columns.find((col) => col.title === columnTitle);
        return column?.id;
      };

      const viewData = {
        title: view.title,
        type: stringToViewTypeMap[view.type],
        description: view.description,
      };

      switch (view.type?.toLowerCase()) {
        case viewTypeToStringMap[ViewTypes.GRID]:
          {
            const grid = await this.gridsService.gridViewCreate(context, {
              tableId: table.id,
              grid: viewData,
              req,
            });

            createdViews.push(grid);

            await grid.getColumns(context);

            view.gridGroupBy = Array.isArray(view.gridGroupBy)
              ? view.gridGroupBy
              : view.gridGroupBy
              ? [view.gridGroupBy]
              : [];

            for (const groupBy of view.gridGroupBy) {
              const columnId = getColumnId(groupBy);

              if (!columnId) {
                throw new Error('Column not found');
              }

              const viewColumn = grid.columns.find(
                (col) => col.fk_column_id === columnId,
              );

              if (!viewColumn) {
                throw new Error('View column not found');
              }

              await this.gridColumnsService.gridColumnUpdate(context, {
                gridViewColumnId: viewColumn.id,
                grid: {
                  group_by: true,
                  group_by_order: view.gridGroupBy.indexOf(groupBy) + 1,
                },
                req,
              });
            }

            for (const sort of view.sorts || []) {
              const columnId = getColumnId(sort.column);

              if (!columnId) {
                throw new Error('Column not found');
              }

              await this.sortsService.sortCreate(context, {
                viewId: grid.id,
                sort: {
                  fk_column_id: columnId,
                  direction: sort.order,
                },
                req,
              });
            }

            for (const filter of view.filters || []) {
              const columnId = getColumnId(filter.column);

              if (!columnId) {
                throw new Error('Column not found');
              }

              await this.filtersService.filterCreate(context, {
                viewId: grid.id,
                filter: {
                  comparison_op: filter.comparison_op as any,
                  logical_op: filter.logical_op as any,
                  value: filter.value,
                  fk_column_id: columnId,
                },
                user: req.user,
                req,
              });
            }
          }
          break;
        case viewTypeToStringMap[ViewTypes.KANBAN]:
          {
            const kanban = await this.kanbansService.kanbanViewCreate(context, {
              tableId: table.id,
              kanban: {
                ...viewData,
                fk_grp_col_id: getColumnId(view.kanbanGroupBy),
              },
              user: req.user,
              req,
            });

            createdViews.push(kanban);
          }

          break;

        case viewTypeToStringMap[ViewTypes.CALENDAR]: {
          const calendarRange = view.calendar_range
            ? Array.isArray(view.calendar_range)
              ? view.calendar_range
              : [view.calendar_range]
            : null;
          const calendar = await this.calendarsService.calendarViewCreate(
            context,
            {
              tableId: table.id,
              calendar: {
                ...viewData,
                calendar_range: calendarRange
                  ? calendarRange.map((range) => ({
                      fk_from_column_id: getColumnId(range.from_column),
                    }))
                  : null,
              },
              user: req.user,
              req,
            },
          );

          createdViews.push(calendar);

          break;
        }
        case viewTypeToStringMap[ViewTypes.FORM]: {
          const form = await this.formsService.formViewCreate(context, {
            tableId: table.id,
            body: viewData,
            user: req.user,
            req,
          });

          createdViews.push(form);

          break;
        }
        case viewTypeToStringMap[ViewTypes.GALLERY]: {
          const gallery = await this.galleriesService.galleryViewCreate(
            context,
            {
              tableId: table.id,
              gallery: viewData,
              user: req.user,
              req,
            },
          );

          createdViews.push(gallery);

          break;
        }
        default:
          break;
      }
    }

    return createdViews;
  }

  async generateData(
    context: NcContext,
    params: {
      baseId: string;
      instructions?: string;
      req: any;
    },
  ) {
    const { baseId, instructions, req } = params;

    const base = await Base.get(context, baseId);

    if (!base) {
      throw new Error('Base not found');
    }

    const sources = await base.getSources();

    if (!sources || sources.length === 0) {
      throw new Error('No sources found');
    }

    const integration = await Integration.getCategoryDefault(
      context,
      IntegrationCategoryType.AI,
    );

    if (!integration) {
      throw new Error('AI integration not found');
    }

    const wrapper = await integration.getIntegrationWrapper<AiIntegration>();

    const { data, usage } = await wrapper.generateObject({
      schema: z.object({
        data: z.array(
          z.object({
            table: z.string(),
            columns: z.array(z.string()),
            rows: z.array(
              z.array(
                z.union([
                  z.string(),
                  z.number(),
                  z.boolean(),
                  z.array(z.string()),
                  z.array(
                    z.object({
                      url: z.string(),
                      mimetype: z.string(),
                    }),
                  ),
                ]),
              ),
            ),
          }),
        ),
        links: z.array(
          z.object({
            fromTable: z.string(),
            toTable: z.string(),
            type: z.string(),
            fromToTuples: z.array(
              z.array(z.union([z.string(), z.array(z.string())])),
            ),
          }),
        ),
      }),
      messages: [
        {
          role: 'system',
          content: generateDummyDataSystemMessage(),
        },
        {
          role: 'user',
          content: generateDummyDataPrompt(
            JSON.stringify(
              await this.serializeSchema(context, {
                baseId: base.id,
                req,
              }),
            ),
            instructions,
          ),
        },
      ],
    });

    await integration.storeInsert(context, params.req?.user?.id, usage);

    return this.createData(context, { base, data, req });
  }

  async createData(
    context: NcContext,
    params: {
      base: Base;
      data?: {
        data?: {
          table?: string;
          columns?: string[];
          rows?: (
            | string
            | number
            | boolean
            | string[]
            | { url?: string; mimetype?: string }[]
          )[][];
        }[];
        links?: {
          fromTable?: string;
          toTable?: string;
          type?: string;
          fromToTuples?: (string | string[])[][];
        }[];
      };
      req: any;
    },
  ) {
    const { base, data, req } = params;

    const sources = await base.getSources();

    if (!sources || sources.length === 0) {
      throw new Error('No sources found');
    }

    const source = sources[0];

    const relations: {
      fromTable: string;
      toTable: string;
      type: string;
      column: Column;
    }[] = [];

    const tables = await this.tablesService.getAccessibleTables(context, {
      baseId: base.id,
      sourceId: source.id,
      includeM2M: false,
      roles: extractRolesObj(req.user.base_roles),
    });

    const getTableId = (tableTitle: string) => {
      const table = tables.find((t) => t.title === tableTitle);
      return table?.id;
    };

    for (const tableData of data.data || []) {
      const table = tables.find((t) => t.title === tableData.table);

      if (!table) {
        throw new Error('Table not found');
      }

      await table.getColumns(context);

      const rows = tableData.rows.map((row) => {
        const newRow = {};

        for (let i = 0; i < tableData.columns.length; i++) {
          newRow[tableData.columns[i]] = row[i];
        }

        return newRow;
      });

      await this.dataTableService.dataInsert(context, {
        modelId: getTableId(tableData.table),
        body: rows,
        viewId: null,
        cookie: req,
      });

      // detect relations
      for (const column of table.columns) {
        if (
          [UITypes.Links, UITypes.LinkToAnotherRecord].includes(column.uidt) &&
          column.colOptions?.fk_related_model_id &&
          ['oo', 'hm', 'mm'].includes(column.colOptions?.type)
        ) {
          const fromTable = table.title;
          const toTable = (
            await Model.get(context, column.colOptions?.fk_related_model_id)
          )?.title;

          if (!toTable) {
            continue;
          }

          relations.push({
            fromTable,
            toTable,
            type: column.colOptions?.type,
            column,
          });
        }
      }
    }

    // create relations
    for (const relation of data.links || []) {
      /*
      await this.dataTableService.nestedLink({
        modelId: getTableId(relation.fromTable),
        viewId: null,
        columnId: '',
        rowId: 'placeholder',
        refRowIds: [],
        query: {},
        cookie: req,
      });
      */

      const fromTable = tables.find((t) => t.title === relation.fromTable);
      const toTable = tables.find((t) => t.title === relation.toTable);

      if (!fromTable || !toTable) {
        throw new Error('Table not found');
      }

      const relationMeta = relations.find(
        (r) =>
          r.fromTable === relation.fromTable &&
          r.toTable === relation.toTable &&
          r.type === relation.type,
      );

      if (!relationMeta) {
        throw new Error('Relation not found');
      }

      for (const tuple of relation.fromToTuples || []) {
        const fromRowId = tuple[0];
        const toRowIds = tuple[1];

        await this.dataTableService.nestedLink(context, {
          modelId: fromTable.id,
          viewId: null,
          columnId: relationMeta.column.id,
          rowId: fromRowId as string,
          refRowIds: toRowIds,
          query: {},
          cookie: req,
        });
      }
    }
  }

  async serializeSchema(
    context: NcContext,
    params: {
      baseId: string;
      tableIds?: string[];
      predictedViews?: SerializedAiViewType[];
      viewType?: string;
      req: any;
    },
  ) {
    const { baseId, req } = params;

    const base = await Base.get(context, baseId);

    if (!base) {
      throw new Error('Base not found');
    }

    const sources = await base.getSources();

    if (!sources || sources.length === 0) {
      throw new Error('No sources found');
    }

    const source = sources[0];

    let tables = await this.tablesService.getAccessibleTables(context, {
      baseId: base.id,
      sourceId: source.id,
      includeM2M: false,
      roles: extractRolesObj(req.user.base_roles),
    });

    if (params.tableIds && params.tableIds.length > 0) {
      tables = tables.filter((table) => params.tableIds.includes(table.id));
    }

    const serializedObject: SerializedAiTableType & {
      views: SerializedAiViewType[];
    } = {
      tables: [],
      relationships: [],
      views: [],
    };

    for (const table of tables) {
      const columns = (await table.getColumns(context)).filter(
        (col) => !col.system && col.uidt !== UITypes.ForeignKey,
      );

      serializedObject.tables.push({
        title: table.title,
        description: table.description,
        columns: columns
          .filter(
            (column) =>
              !['mm', 'hm', 'oo', 'bt'].includes(column.colOptions?.type),
          )
          .map((column) => ({
            title: column.title,
            type: column.uidt,
            description: column.description,
            ...(column.colOptions?.options &&
            column.colOptions?.options.length > 0
              ? {
                  options: column.colOptions.options.map(
                    (option) => option.title,
                  ),
                }
              : {}),
          })),
      });

      const mmRelations = [];

      for (const column of columns) {
        if (['mm', 'hm', 'oo'].includes(column.colOptions?.type)) {
          const toTable = await Model.get(
            context,
            column.colOptions?.fk_related_model_id,
          );

          if (!toTable) {
            continue;
          }

          if (
            column.colOptions?.type === 'mm' &&
            mmRelations.includes([table.title, toTable.title].sort().join('::'))
          ) {
            continue;
          } else if (column.colOptions?.type === 'mm') {
            mmRelations.push([table.title, toTable.title].sort().join('::'));
          }

          serializedObject.relationships.push({
            from: table.title,
            to: toTable.title,
            type: column.colOptions?.type,
          });
        }
      }

      const views = await table.getViews(context);

      for (const view of views.filter((v) => {
        const filterByViewType = params.viewType
          ? params.viewType === viewTypeToStringMap[v.type]
          : true;

        return !v.is_default && filterByViewType;
      })) {
        const serializedView: SerializedAiViewType = {
          type: viewTypeToStringMap[view.type],
          table: table.title,
          title: view.title,
          description: view.description || null,
        };

        await view.getFilters(context);

        const getColumnTitle = (columnId: string) => {
          const column = table.columns.find((col) => col.id === columnId);
          return column?.title;
        };

        switch (view.type) {
          case ViewTypes.GRID:
            {
              const viewColumns = (await view.getColumns(
                context,
              )) as GridViewColumn[];
              if (
                viewColumns &&
                viewColumns.filter((column) => column.group_by).length > 0
              ) {
                serializedView.gridGroupBy = viewColumns
                  .filter((column) => column.group_by)
                  .sort((a, b) => a.group_by_order - b.group_by_order)
                  .map((vcol) => getColumnTitle(vcol.fk_column_id));
              }

              // grid view sort:
              const viewSorts = await view.getSorts(context);
              if (viewSorts && viewSorts.length > 0) {
                serializedView.sorts = viewSorts.map((sort) => ({
                  column: getColumnTitle(sort.fk_column_id),
                  order: sort.direction === 'asc' ? 'asc' : 'desc',
                }));
              }

              // grid view filter:
              const viewFilters = await view.getFilters(context);
              const filters = viewFilters?.children;

              if (
                filters &&
                filters.filter((filter) => !filter.is_group).length > 0
              ) {
                serializedView.filters = filters
                  .filter((filter) => !filter.is_group)
                  .map((filter) => ({
                    comparison_op: filter.comparison_op,
                    logical_op: filter.logical_op,
                    value: filter.value,
                    column: getColumnTitle(filter.fk_column_id),
                  }));
              }
            }
            break;
          case ViewTypes.CALENDAR:
            serializedView.calendar_range = (
              view.view as CalendarView
            ).calendar_range.map((range) => ({
              from_column: getColumnTitle(range.fk_from_column_id),
            }));
            break;
          case ViewTypes.KANBAN:
            serializedView.kanbanGroupBy = getColumnTitle(
              (view.view as any).fk_grp_col_id,
            );
            break;
          case ViewTypes.FORM:
          case ViewTypes.GALLERY:
          default:
            break;
        }

        // remove empty arrays
        serializedObject.views.push(serializedView);
      }
    }

    {
      // Sanitize already predicted views
      for (const view of Array.isArray(params.predictedViews)
        ? params.predictedViews
        : []) {
        if (
          stringToViewTypeMap[view.type] === undefined ||
          !view.title?.trim() ||
          !view.table?.trim()
        ) {
          continue;
        }

        serializedObject.views.push(view);
      }
    }

    return serializedObject;
  }
}

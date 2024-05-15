import { Injectable } from '@nestjs/common';
import { openai } from '@ai-sdk/openai';
import { generateObject, type LanguageModel } from 'ai';
import { z } from 'zod';
import {
  extractRolesObj,
  type RelationTypes,
  UITypes,
  ViewTypes,
} from 'nocodb-sdk';

import type GridViewColumn from '~/models/GridViewColumn';
import type CalendarView from '~/models/CalendarView';
import type Column from '~/models/Column';
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

@Injectable()
export class AiSchemaService {
  private model: LanguageModel;

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
  ) {
    this.model = openai('gpt-4o');
  }

  async generateSchema(params: {
    baseId: string;
    input: string;
    instructions?: string;
    req?: any;
  }) {
    const { baseId, input, instructions, req } = params;

    const base = await Base.get(baseId);

    if (!base) {
      throw new Error('Base not found');
    }

    const { object, ...rest } = await generateObject({
      model: this.model,
      schema: z.object({
        tables: z.array(
          z.object({
            title: z.string(),
            columns: z.array(
              z.object({
                title: z.string(),
                type: z.enum([
                  'ID',
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
                  'CreatedAt',
                  'LastModifiedAt',
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
      }),
      messages: [
        {
          role: 'system',
          content: `You are a smart-spreadsheet designer.
          You can create any number of tables & columns in your spreadsheet.
          
          Following column types are available for you to use:
          ID, SingleLineText, LongText, Attachment, Checkbox, MultiSelect, SingleSelect, Date, Year, Time, PhoneNumber, Email, URL, Number, Decimal, Currency, Percent, Duration, Rating, DateTime, JSON, CreatedAt, LastModifiedAt.
          
          You can create relationships between tables (columns will be automatically created for relations):
          - oo: one to one relationship, like a person and their passport ({ "from": "Person", "to": "Passport", "type": "oo" })
          - hm: has many relationship, like a country and its cities ({ "from": "Country", "to": "City", "type": "hm" })
          - mm: many to many relationship, like a student and their classes ({ "from": "Student", "to": "Class", "type": "mm" })

          Rules:
          - Each table must have one and only one ID column
          - Spaces are allowed in table & column names
          - Try to make use of SingleSelect columns where possible
          
          Here is a sample JSON schema
          \`\`\`json
          {"tables":[{"title":"Countries","columns":[{"title":"Id","type":"ID"},{"title":"Name","type":"SingleLineText"},{"title":"Region","type":"SingleSelect","options":["Asia","Europe","Africa","North America","South America","Australia","Antarctica"]}]},{"title":"Cities","columns":[{"title":"Id","type":"ID"},{"title":"Name","type":"SingleLineText"},{"title":"Population","type":"Number"},{"title":"Capital","type":"Checkbox"}]}],"relationships":[{"from":"Countries","to":"Cities","type":"hm"}]}
          \`\`\`
          `,
        },
        {
          role: 'user',
          content: `Please design me the best schema for ${input}${
            instructions ? `\n${instructions}` : ''
          }`,
        },
      ],
    });

    console.log(`Generate Schema: ${rest.usage.totalTokens} tokens`);

    return this.createSchema({ base, schema: object, req });
  }

  private async createSchema(params: {
    base: Base;
    schema: {
      tables?: {
        title?: string;
        columns?: {
          title?: string;
          type?: string;
          options?: string[];
        }[];
      }[];
      relationships?: {
        from?: string;
        to?: string;
        type?: string;
      }[];
    };
    req: any;
  }) {
    const { base, schema, req } = params;

    const tables = schema.tables || [];
    const relationships = schema.relationships || [];

    const generatedTables = [];

    for (const table of tables) {
      generatedTables.push(
        await this.tablesService.tableCreate({
          baseId: base.id,
          table: {
            title: table.title,
            table_name: table.title.replace(/\W/g, '_').toLowerCase(),
            columns: table.columns.map((column, i) => ({
              title: column.title,
              column_name: column.title.replace(/\W/g, '_').toLowerCase(),
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

    for (const relation of relationships) {
      const fromTable = generatedTables.find(
        (table) => table.title === relation.from,
      );
      const toTable = generatedTables.find(
        (table) => table.title === relation.to,
      );

      if (fromTable && toTable) {
        await this.columnsService.columnAdd({
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
    }

    return generatedTables;
  }

  async generateViews(params: {
    baseId: string;
    instructions?: string;
    req?: any;
  }) {
    const { baseId, instructions, req } = params;

    const base = await Base.get(baseId);

    if (!base) {
      throw new Error('Base not found');
    }

    const { object, ...rest } = await generateObject({
      model: this.model,
      schema: z.object({
        views: z.array(
          z.object({
            type: z.string(),
            table: z.string(),
            title: z.string(),
            filters: z
              .array(
                z.object({
                  comparison_op: z.string(),
                  logical_op: z.string(),
                  value: z.string(),
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
              .optional(),
            gridGroupBy: z.array(z.string()).optional(),
            kanbanGroupBy: z.string().optional(),
          }),
        ),
      }),
      messages: [
        {
          role: 'system',
          content: `You are an smart-spreadsheet designer.
          You can create views with the following types: Grid, Gallery, Kanban, Form, Calendar.
          Grid views can have filters with following comparison operators: allof, anyof, nallof, nanyof, blank, checked, eq, ge, gt, gte, le, lt, lte, like, neq, nlike, notblank, notchecked.
          Grid views can have logical operators: and, or (only one can be used for same view).

          Rules:
          - Grid views can have multiple filters, sorts and group by
          - Calendar views must have one calendar range targeting a Date column
          - Kanban views must be grouped by a SingleSelect column
          - Galleries are favorable if there are Attachments in the schema
          - Forms are favorable if you think users will be entering data frequently

          This is a sample schema:
          \`\`\`json
          {"tables":[{"title":"Opportunities","columns":[{"title":"Opportunity name","type":"SingleLineText"},{"title":"Owner","type":"Collaborator"},{"title":"Status","type":"SingleSelect","options":["Qualification","Proposal","Closed—won","Evaluation","Closed—lost","Negotiation"]},{"title":"Priority","type":"SingleSelect","options":["Medium","Very low","Very high","High","Low"]},{"title":"Estimated value","type":"Currency"},{"title":"Proposal deadline","type":"Date"},{"title":"Expected close date","type":"Date"},{"title":"ncRecordId","type":"ID"},{"title":"Last contact","type":"Rollup"}]},{"title":"Interactions","columns":[{"title":"Type","type":"SingleSelect","options":["Discovery","Demo","Pricing discussion","Legal discussion"]},{"title":"Date and time","type":"DateTime"},{"title":"Notes","type":"LongText"},{"title":"ncRecordId","type":"ID"},{"title":"Status","type":"Lookup"}]},{"title":"Accounts","columns":[{"title":"Name","type":"SingleLineText"},{"title":"Industry","type":"SingleSelect","options":["Insurance","Publishing","Automotive","Telecommunications","Retail","Energy","Chemical","Consumer goods","Information technology","Banking"]},{"title":"Size","type":"SingleSelect","options":["101-500","51-100","501-1,000","1,000-5,000","5,000-10,000","11-50","1-10","10,000+"]},{"title":"Company website","type":"URL"},{"title":"Company LinkedIn","type":"URL"},{"title":"HQ address","type":"LongText"},{"title":"Map cache","type":"SingleLineText"},{"title":"ncRecordId","type":"ID"}]},{"title":"Contacts","columns":[{"title":"Email","type":"Email"},{"title":"Phone","type":"PhoneNumber"},{"title":"Title","type":"SingleLineText"},{"title":"Department","type":"SingleSelect","options":["Marketing","EMEA operations","Design","Customer success","Human resources"]},{"title":"LinkedIn","type":"URL"},{"title":"Name","type":"SingleLineText"},{"title":"VIP","type":"Checkbox"},{"title":"ncRecordId","type":"ID"}]}],"relationships":[{"from":"Opportunities","to":"Interactions","type":"mm"},{"from":"Opportunities","to":"Accounts","type":"mm"},{"from":"Opportunities","to":"Contacts","type":"mm"},{"from":"Interactions","to":"Opportunities","type":"mm"},{"from":"Interactions","to":"Contacts","type":"mm"},{"from":"Accounts","to":"Opportunities","type":"mm"},{"from":"Accounts","to":"Contacts","type":"mm"},{"from":"Contacts","to":"Opportunities","type":"mm"},{"from":"Contacts","to":"Interactions","type":"mm"},{"from":"Contacts","to":"Accounts","type":"mm"}]}
          \`\`\`
          
          Here is a sample JSON for generating views for sample schema:
          \`\`\`json
          {"views":[[{"type":"grid","table":"Opportunities","title":"Grouped by owner","gridGroupBy":["Owner"]},{"type":"grid","table":"Opportunities","title":"Closed—won","filters":[{"comparison_op":"eq","logical_op":"and","value":"Closed—won","column":"Status"}]},{"type":"kanban","table":"Opportunities","title":"Sales Pipeline","kanbanGroupBy":"Status"},{"type":"calendar","table":"Opportunities","title":"Proposal Dates","calendar_range":[{"from_column":"Proposal deadline"}]},{"type":"form","table":"Interactions","title":"Entry form"},{"type":"grid","table":"Accounts","title":"Grouped by size","gridGroupBy":["Size"]},{"type":"grid","table":"Contacts","title":"VIP contact info","filters":[{"comparison_op":"eq","logical_op":"and","value":"true","column":"VIP"}]}]]}
          \`\`\`
          `,
        },
        {
          role: 'user',
          content: `Please generate views for following schema:
          \`\`\`json
          ${JSON.stringify(
            await this.serializeSchema({ baseId: base.id, req }),
          )}
          \`\`\`${instructions ? `\n${instructions}` : ''}`,
        },
      ],
    });

    console.log(`Generate Views: ${rest.usage.totalTokens} tokens`);

    return this.createViews({ base, views: object.views, req });
  }

  async createViews(params: {
    base: Base;
    views?: {
      type?: string;
      table?: string;
      title?: string;
      filters?: {
        comparison_op?: string;
        logical_op?: string;
        value?: string;
        column?: string;
      }[];
      sorts?: {
        column?: string;
        order?: 'asc' | 'desc';
      }[];
      calendar_range?: {
        from_column?: string;
      }[];
      gridGroupBy?: string[];
      kanbanGroupBy?: string;
    }[];
    req: any;
  }) {
    const { base, views, req } = params;

    const sources = await base.getSources();

    if (!sources || sources.length === 0) {
      throw new Error('No sources found');
    }

    const source = sources[0];

    for (const view of views) {
      const tables = await this.tablesService.getAccessibleTables({
        baseId: base.id,
        sourceId: source.id,
        includeM2M: false,
        roles: extractRolesObj(req.user.base_roles),
      });

      const table = tables.find((t) => t.title === view.table);

      if (!table) {
        throw new Error('Table not found');
      }

      await table.getColumns();

      const getColumnId = (columnTitle: string) => {
        const column = table.columns.find((col) => col.title === columnTitle);
        return column?.id;
      };

      const viewTypes = {
        form: ViewTypes.FORM,
        gallery: ViewTypes.GALLERY,
        grid: ViewTypes.GRID,
        kanban: ViewTypes.KANBAN,
        calendar: ViewTypes.CALENDAR,
      };

      const viewData = {
        title: view.title,
        type: viewTypes[view.type],
      };

      switch (view.type) {
        case 'grid':
          {
            const grid = await this.gridsService.gridViewCreate({
              tableId: table.id,
              grid: viewData,
              req,
            });

            await grid.getColumns();

            for (const groupBy of view.gridGroupBy || []) {
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

              await this.gridColumnsService.gridColumnUpdate({
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

              await this.sortsService.sortCreate({
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

              await this.filtersService.filterCreate({
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
        case 'kanban':
          await this.kanbansService.kanbanViewCreate({
            tableId: table.id,
            kanban: {
              ...viewData,
              fk_grp_col_id: getColumnId(view.kanbanGroupBy),
            },
            user: req.user,
            req,
          });
          break;
        case 'calendar':
          await this.calendarsService.calendarViewCreate({
            tableId: table.id,
            calendar: {
              ...viewData,
              calendar_range: view.calendar_range.map((range) => ({
                fk_from_column_id: getColumnId(range.from_column),
              })),
            },
            user: req.user,
            req,
          });
          break;
        case 'form':
          await this.formsService.formViewCreate({
            tableId: table.id,
            body: viewData,
            user: req.user,
            req,
          });
          break;
        case 'gallery':
          await this.galleriesService.galleryViewCreate({
            tableId: table.id,
            gallery: viewData,
            user: req.user,
            req,
          });
          break;
        default:
          break;
      }
    }
  }

  async generateData(params: {
    baseId: string;
    instructions?: string;
    req: any;
  }) {
    const { baseId, instructions, req } = params;

    const base = await Base.get(baseId);

    if (!base) {
      throw new Error('Base not found');
    }

    const sources = await base.getSources();

    if (!sources || sources.length === 0) {
      throw new Error('No sources found');
    }

    const { object, ...rest } = await generateObject({
      model: this.model,
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
          content: `You are a data engineer.
          You must create data for your tables.
          
          Try to use real world data where possible.
          
          Rules:
          - Each row must have a value for each column
          - Each row must have a value for the ID column (Auto Incremented number as string)
          - You can create data for multiple tables
          - You can create data for multiple rows in each table
          - Each table must have random number of rows (between 5 to 12)
          - SingleSelect & MultiSelect columns must have values from the options
          - Attachment format is: { "url": string; "mimetype": string }[]

          Here is a sample JSON schema:
          \`\`\`json
          {"data":[{"table":"Countries","columns":["Id","Name","Region"],"rows":[["1","India","Asia"],["2","USA","North America"]]},{"table":"Cities","columns":["Id","Name","Population","Capital"],"rows":[["1","Mumbai",20000000,true],["2","New York",8000000,false]]}],"links":[{"fromTable":"Countries","toTable":"Cities","type":"hm","fromToTuples":[["1",["1"]],["2",["2"]]]}]}
          \`\`\`
          `,
        },
        {
          role: 'user',
          content: `Please generate data for following schema:
          \`\`\`json
          ${JSON.stringify(
            await this.serializeSchema({ baseId: base.id, req }),
          )}
          \`\`\`${instructions ? `\n${instructions}` : ''}`,
        },
      ],
    });

    console.log(`Generate Data: ${rest.usage.totalTokens} tokens`);

    return this.createData({ base, data: object, req });
  }

  async createData(params: {
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
  }) {
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

    const tables = await this.tablesService.getAccessibleTables({
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

      await table.getColumns();

      const rows = tableData.rows.map((row) => {
        const newRow = {};

        for (let i = 0; i < tableData.columns.length; i++) {
          newRow[tableData.columns[i]] = row[i];
        }

        return newRow;
      });

      await this.dataTableService.dataInsert({
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
            await Model.get(column.colOptions?.fk_related_model_id)
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

        await this.dataTableService.nestedLink({
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

  async serializeSchema(params: { baseId: string; req: any }) {
    const { baseId, req } = params;

    const base = await Base.get(baseId);

    if (!base) {
      throw new Error('Base not found');
    }

    const sources = await base.getSources();

    if (!sources || sources.length === 0) {
      throw new Error('No sources found');
    }

    const source = sources[0];

    const tables = await this.tablesService.getAccessibleTables({
      baseId: base.id,
      sourceId: source.id,
      includeM2M: false,
      roles: extractRolesObj(req.user.base_roles),
    });

    const serializedObject = {
      tables: [],
      relationships: [],
      views: [],
    };

    for (const table of tables) {
      const columns = (await table.getColumns()).filter(
        (col) => !col.system && col.uidt !== UITypes.ForeignKey,
      );

      serializedObject.tables.push({
        title: table.title,
        columns: columns
          .filter(
            (column) =>
              !['mm', 'hm', 'oo', 'bt'].includes(column.colOptions?.type),
          )
          .map((column) => ({
            title: column.title,
            type: column.uidt,
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

      const views = await table.getViews();

      for (const view of views.filter((v) => !v.is_default)) {
        const serializedViewTypes = {
          [ViewTypes.FORM]: 'form',
          [ViewTypes.GALLERY]: 'gallery',
          [ViewTypes.GRID]: 'grid',
          [ViewTypes.KANBAN]: 'kanban',
          [ViewTypes.CALENDAR]: 'calendar',
        };

        const serializedView: {
          type: string;
          table: string;
          title: string;
          filters?: {
            comparison_op: string;
            logical_op: string;
            value: number;
            column: string;
          }[];
          sorts?: {
            column: string;
            order: 'asc' | 'desc';
          }[];
          calendar_range?: {
            from_column: string;
          }[];
          gridGroupBy?: string[];
          kanbanGroupBy?: string;
        } = {
          type: serializedViewTypes[view.type],
          table: table.title,
          title: view.title,
        };

        await view.getFilters();

        const getColumnTitle = (columnId: string) => {
          const column = table.columns.find((col) => col.id === columnId);
          return column?.title;
        };

        switch (view.type) {
          case ViewTypes.GRID:
            {
              const viewColumns = (await view.getColumns()) as GridViewColumn[];
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
              const viewSorts = await view.getSorts();
              if (viewSorts && viewSorts.length > 0) {
                serializedView.sorts = viewSorts.map((sort) => ({
                  column: getColumnTitle(sort.fk_column_id),
                  order: sort.direction === 'asc' ? 'asc' : 'desc',
                }));
              }

              // grid view filter:
              const viewFilters = await view.getFilters();
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

    return serializedObject;
  }
}

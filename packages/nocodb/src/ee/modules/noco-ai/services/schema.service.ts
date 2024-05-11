import { Injectable } from '@nestjs/common';
import { openai } from '@ai-sdk/openai';
import { generateObject, type LanguageModel } from 'ai';
import { z } from 'zod';
import { extractRolesObj, type RelationTypes, UITypes } from 'nocodb-sdk';

import Base from '~/models/Base';

import { TablesService } from '~/services/tables.service';
import { ColumnsService } from '~/services/columns.service';
import Model from '~/models/Model';

@Injectable()
export class AiSchemaService {
  private model: LanguageModel;

  constructor(
    protected readonly tablesService: TablesService,
    protected readonly columnsService: ColumnsService,
  ) {
    this.model = openai('gpt-4-turbo');
  }

  async generateSchema(params: { baseId: string; input: string; req?: any }) {
    const { baseId, input, req } = params;

    const base = await Base.get(baseId);

    if (!base) {
      throw new Error('Base not found');
    }

    const { object } = await generateObject({
      model: this.model,
      schema: z.object({
        tables: z.array(
          z.object({
            title: z.string(),
            columns: z.array(
              z.object({
                title: z.string(),
                type: z.string(),
                options: z.array(z.string()).optional(),
              }),
            ),
          }),
        ),
        relationships: z.array(
          z.object({
            from: z.string(),
            to: z.string(),
            type: z.string(),
          }),
        ),
      }),
      messages: [
        {
          role: 'system',
          content: `You are a smart-spreadsheet designer.
          You can create any number of tables & fields in your spreadsheet.
          
          Following field types are available for you to use:
          ID, SingleLineText, LongText, Attachment, Checkbox, MultiSelect, SingleSelect, Date, Year, Time, PhoneNumber, Email, URL, Number, Decimal, Currency, Percent, Duration, Rating, DateTime, JSON, User, CreatedAt, LastModifiedAt, CreatedBy, LastModifiedBy.
          
          You can create relationships between tables (fields will be automatically created for relations):
          - oo: one to one relationship, like a person and their passport ({ "from": "Person", "to": "Passport", "type": "oo" })
          - hm: has many relationship, like a country and its cities ({ "from": "Country", "to": "City", "type": "hm" })
          - mm: many to many relationship, like a student and their classes ({ "from": "Student", "to": "Class", "type": "mm" })

          Rules:
          - Each table must have an ID field
          - Spaces are allowed in table & field names
          
          Here is a sample JSON schema
          \`\`\`json
          {"tables":[{"title":"Countries","columns":[{"title":"Id","type":"ID"},{"title":"Name","type":"SingleLineText"},{"title":"Region","type":"SingleSelect","options":["Asia","Europe","Africa","North America","South America","Australia","Antarctica"]}]},{"title":"Cities","columns":[{"title":"Id","type":"ID"},{"title":"Name","type":"SingleLineText"},{"title":"Population","type":"Number"},{"title":"Capital","type":"Checkbox"}]}],"relationships":[{"from":"Countries","to":"Cities","type":"hm"}]}
          \`\`\`
          `,
        },
        {
          role: 'user',
          content: `Design me an excellent schema for this prompt: ${input}`,
        },
      ],
    });

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

  async serializeExistingSchema(params: { baseId: string; req: any }) {
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
    }

    return serializedObject;
  }
}

import { z } from 'zod';
import { isLinksOrLTAR, ProjectRoles, UITypes } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import { resolveTableByName } from '~/integrations/ai/chat/tools/helpers';
import Model from '~/models/Model';
import Column from '~/models/Column';

export const describeTableTool = defineChatTool({
  name: ChatToolName.DESCRIBE_TABLE,
  description:
    'Get the full schema of a table — all user-visible fields with their title, type, ' +
    'required flag, primary (display field) flag, description, and type-specific options. ' +
    'SingleSelect/MultiSelect fields include their choices list. ' +
    'Link/LTAR fields include related_table name and relation_type (hm, bt, mm, oo). ' +
    'Lookup fields include the link field and lookup target field. ' +
    'Rollup fields include the link field, rollup target field, and rollup function. ' +
    'Formula fields include the formula expression. ' +
    'Barcode/QrCode fields include the source value field. ' +
    'Always call this before query_records, create_records, or add_filter to know field names and types.',
  schema: z.object({
    table_name: z
      .string()
      .describe(
        'The title of the table to describe (case-insensitive). Use list_tables to get valid names.',
      ),
  }),
  permission: 'tableGet',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  visibility: 'hidden',
  category: 'schema',
  async execute(context, args, _req) {
    const model = await resolveTableByName(context, args.table_name);
    const columns = await model.getColumns(context);

    return {
      id: model.id,
      title: model.title,
      description: model.description || null,
      columns: await Promise.all(
        columns
          .filter((c) => !c.system)
          .map(async (c) => {
            await c.getColOptions(context);
            const col: Record<string, any> = {
              id: c.id,
              title: c.title,
              type: c.uidt,
              required: !!c.rqd,
              primary: !!c.pv,
              description: c.description || null,
            };

            // SingleSelect / MultiSelect — include choices
            if (c.colOptions?.options?.length) {
              col.options = c.colOptions.options.map((o: any) => o.title);
            }

            // Link / LTAR — include related table name and relation type
            if (isLinksOrLTAR(c) && c.colOptions) {
              const relationType = c.colOptions.type;
              const relatedModelId = c.colOptions.fk_related_model_id;

              if (relationType) {
                col.relation_type = relationType;
              }

              if (relatedModelId) {
                try {
                  const relatedModel = await Model.get(
                    context,
                    relatedModelId,
                  );
                  if (relatedModel) {
                    col.related_table = relatedModel.title;
                  }
                } catch {
                  // Ignore — related table may have been deleted
                }
              }
            }

            // Lookup — include link field and lookup target field names
            if (c.uidt === UITypes.Lookup && c.colOptions) {
              await enrichWithFieldName(
                context,
                col,
                'related_field',
                c.colOptions.fk_relation_column_id,
                model,
              );
              await enrichWithFieldNameFromRelated(
                context,
                col,
                'lookup_field',
                c.colOptions.fk_lookup_column_id,
                c.colOptions.fk_relation_column_id,
                model,
              );
            }

            // Rollup — include link field, rollup target field, and function
            if (c.uidt === UITypes.Rollup && c.colOptions) {
              await enrichWithFieldName(
                context,
                col,
                'related_field',
                c.colOptions.fk_relation_column_id,
                model,
              );
              await enrichWithFieldNameFromRelated(
                context,
                col,
                'rollup_field',
                c.colOptions.fk_rollup_column_id,
                c.colOptions.fk_relation_column_id,
                model,
              );
              if (c.colOptions.rollup_function) {
                col.rollup_function = c.colOptions.rollup_function;
              }
            }

            // Formula — include expression
            if (c.uidt === UITypes.Formula && c.colOptions?.formula) {
              col.formula = c.colOptions.formula;
            }

            // Barcode — include source field name
            if (c.uidt === UITypes.Barcode && c.colOptions) {
              await enrichWithFieldName(
                context,
                col,
                'value_field',
                c.colOptions.fk_barcode_value_column_id,
                model,
              );
              if (c.colOptions.barcode_format) {
                col.barcode_format = c.colOptions.barcode_format;
              }
            }

            // QrCode — include source field name
            if (c.uidt === UITypes.QrCode && c.colOptions) {
              await enrichWithFieldName(
                context,
                col,
                'value_field',
                c.colOptions.fk_qr_value_column_id,
                model,
              );
            }

            return col;
          }),
      ),
    };
  },
});

/**
 * Resolve a column ID to its title and attach to the output object.
 */
async function enrichWithFieldName(
  context: any,
  col: Record<string, any>,
  key: string,
  columnId: string | undefined,
  model: Model,
) {
  if (!columnId) return;
  try {
    const columns = await model.getColumns(context);
    const found = columns.find((c) => c.id === columnId);
    if (found) {
      col[key] = found.title;
    }
  } catch {
    // Ignore
  }
}

/**
 * Resolve a column ID in a related table (via a link column) to its title.
 */
async function enrichWithFieldNameFromRelated(
  context: any,
  col: Record<string, any>,
  key: string,
  targetColumnId: string | undefined,
  relationColumnId: string | undefined,
  model: Model,
) {
  if (!targetColumnId || !relationColumnId) return;
  try {
    const columns = await model.getColumns(context);
    const linkCol = columns.find(
      (c) => c.id === relationColumnId,
    ) as Column | undefined;
    if (!linkCol?.colOptions?.fk_related_model_id) return;

    const relatedModel = await Model.get(
      context,
      linkCol.colOptions.fk_related_model_id,
    );
    if (!relatedModel) return;

    const relatedColumns = await relatedModel.getColumns(context);
    const found = relatedColumns.find((c) => c.id === targetColumnId);
    if (found) {
      col[key] = found.title;
    }
  } catch {
    // Ignore
  }
}

import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import {
  buildModelMeta,
  resolveTableByName,
} from '~/integrations/ai/chat/tools/helpers';
import { aggregationDescription, whereDescription } from '~/mcp/descriptions';
import { NcError } from '~/helpers/catchError';
import { DataTableService } from '~/services/data-table.service';
import Noco from '~/Noco';

export const aggregateTool = defineChatTool({
  name: ChatToolName.AGGREGATE,
  description:
    'Perform aggregations on table data with optional filtering. ' +
    'Supports multiple aggregation types (sum, count, avg, min, max, median, etc.) and ' +
    'multiple filter groups in a single call — each group produces separate results by alias. ' +
    'Use this for all counting, summing, averaging, and statistical queries — ' +
    'never fetch records to compute aggregates manually. ' +
    'Call describe_table first to know field names and types for correct aggregation type selection.',
  schema: z.object({
    table_name: z
      .string()
      .describe('The title of the table to aggregate (case-insensitive).'),
    aggregations: z
      .array(
        z.object({
          field: z
            .string()
            .describe('Field title to aggregate (case-insensitive).'),
          type: z
            .enum([
              'sum',
              'min',
              'max',
              'avg',
              'median',
              'std_dev',
              'range',
              'count',
              'count_empty',
              'count_filled',
              'count_unique',
              'percent_empty',
              'percent_filled',
              'percent_unique',
              'checked',
              'unchecked',
              'percent_checked',
              'percent_unchecked',
              'earliest_date',
              'latest_date',
              'date_range',
              'month_range',
              'none',
            ])
            .describe(aggregationDescription),
        }),
      )
      .describe('Array of aggregations to perform.'),
    filter_groups: z
      .array(
        z.object({
          alias: z
            .string()
            .describe('Alias name for this filter group result.'),
          where: z
            .string()
            .optional()
            .describe(whereDescription + ' Omit for unfiltered aggregation.'),
        }),
      )
      .describe(
        'Array of filter groups — each produces separate aggregation results.',
      ),
  }),
  visibility: 'data',
  category: 'data',
  permission: 'dataList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  async execute(context, args, _req) {
    const dataTableService: DataTableService =
      Noco.nestApp.get(DataTableService);
    const model = await resolveTableByName(context, args.table_name);

    const columns = await model.getColumns(context);
    const resolvedAggregations = args.aggregations.map((agg) => {
      const lowerField = agg.field.toLowerCase();
      const col = columns.find((c) => c.title?.toLowerCase() === lowerField);
      if (!col) {
        NcError.get(context).fieldNotFound(agg.field);
      }
      return { field: col.id, type: agg.type };
    });

    const bulkFilterList = args.filter_groups.map((group) => ({
      alias: group.alias,
      where: group.where ? `@${group.where}` : undefined,
    }));

    return await dataTableService.bulkAggregate(context, {
      modelId: model.id,
      query: {
        aggregation: JSON.stringify(resolvedAggregations),
      },
      body: JSON.stringify(bulkFilterList),
    });
  },
  async buildMeta(context, args) {
    const model = await resolveTableByName(context, args.table_name);
    return { model: await buildModelMeta(context, model) };
  },
});

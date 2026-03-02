import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName, truncateResult } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DataTableService } from '~/services/data-table.service';
import Noco from '~/Noco';

export const queryRecordsTool: ChatToolDefinition = {
  name: 'query_records',
  description:
    'Query records from a table with optional filtering, sorting, and pagination. Returns matching rows.',
  parameters: {
    table_name: z.string().describe('The name of the table to query'),
    where: z
      .string()
      .optional()
      .describe(
        'Filter condition in NocoDB format, e.g., "(Status,eq,Active)~and(Priority,eq,High)"',
      ),
    sort: z
      .string()
      .optional()
      .describe(
        'Sort string, e.g., "-CreatedAt" for descending or "Title" for ascending',
      ),
    fields: z
      .string()
      .optional()
      .describe('Comma-separated list of field names to include in results'),
    limit: z
      .number()
      .optional()
      .describe('Maximum number of records to return (default 25, max 100)'),
    offset: z
      .number()
      .optional()
      .describe('Number of records to skip for pagination'),
  },
  permission: 'dataList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: {
      table_name: string;
      where?: string;
      sort?: string;
      fields?: string;
      limit?: number;
      offset?: number;
    },
    _req: NcRequest,
  ) {
    const dataService: DataTableService = Noco.nestApp.get(DataTableService);
    const model = await resolveTableByName(context, args.table_name);
    const defaultView = await model.getViews(context).then((v) => v[0]);

    const result = await dataService.dataList(context, {
      modelId: model.id,
      viewId: defaultView?.id,
      query: {
        where: args.where,
        sort: args.sort,
        fields: args.fields,
        limit: String(Math.min(args.limit || 25, 100)),
        offset: String(args.offset || 0),
      },
    });

    return truncateResult({
      records: result.list,
      pageInfo: result.pageInfo,
    });
  },
};

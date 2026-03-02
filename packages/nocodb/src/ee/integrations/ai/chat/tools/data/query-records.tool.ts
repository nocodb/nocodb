import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName, truncateResult } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DataV3Service } from '~/services/v3/data-v3.service';
import Noco from '~/Noco';

export const queryRecordsTool: ChatToolDefinition = {
  name: 'query_records',
  description:
    'Query records from a table with optional filtering, sorting, and pagination. ' +
    'Returns records in v3 format: each record has an "id" (the primary key value) and a "fields" object. ' +
    'Use the "id" value directly in get_record, update_records (rows[].id), and delete_records (row_ids) — ' +
    'never guess or construct row IDs yourself. ' +
    'Filter syntax: (FieldTitle,operator,value)~and(FieldTitle,operator,value). ' +
    'All filter operators are listed in the system prompt under "Filter Operators".',
  parameters: {
    table_name: z
      .string()
      .describe('The title of the table to query (case-insensitive).'),
    where: z
      .string()
      .optional()
      .describe(
        'Filter expression. Format: (FieldTitle,operator,value)~and(FieldTitle,operator,value). ' +
          'Operators: eq, neq, gt, lt, gte, lte, like, nlike, blank, notblank, null, notnull, ' +
          'in, allof, anyof, btw, nbtw, is, isnot, isWithin, checked, notchecked. ' +
          'Example: (Status,eq,Active)~and(Priority,gt,2) or (Name,like,%john%)',
      ),
    sort: z
      .string()
      .optional()
      .describe(
        'Sort as a JSON array: [{"field": "FieldTitle", "direction": "asc"}, {"field": "OtherField", "direction": "desc"}]. ' +
          '"direction" must be "asc" or "desc". ' +
          'Example: [{"field": "CreatedAt", "direction": "desc"}]',
      ),
    fields: z
      .string()
      .optional()
      .describe(
        'Comma-separated list of field titles to include in the fields object. ' +
          'If omitted, all fields are returned. Use to reduce response size for wide tables.',
      ),
    limit: z
      .number()
      .optional()
      .describe(
        'Maximum number of records to return. Default: 25, maximum: 100.',
      ),
    offset: z
      .number()
      .optional()
      .describe(
        'Number of records to skip for pagination. Use with limit to page through large datasets.',
      ),
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
    req: NcRequest,
  ) {
    const dataV3Service: DataV3Service = Noco.nestApp.get(DataV3Service);
    const model = await resolveTableByName(context, args.table_name);

    const result = await dataV3Service.dataList(context, {
      modelId: model.id,
      query: {
        where: args.where,
        sort: args.sort,
        fields: args.fields,
        limit: String(Math.min(args.limit || 25, 100)),
        offset: String(args.offset || 0),
      },
      req,
    });

    return truncateResult(result);
  },
};

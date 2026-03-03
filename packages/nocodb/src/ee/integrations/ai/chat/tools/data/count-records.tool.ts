import { z } from 'zod';
import { NcApiVersion, ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DataTableService } from '~/services/data-table.service';
import Noco from '~/Noco';

export const countRecordsTool: ChatToolDefinition = {
  name: 'count_records',
  description:
    'Count the number of records in a table, optionally filtered by a where clause. ' +
    'Use this to answer "how many records match..." questions without fetching the actual records. ' +
    'Much faster and cheaper than query_records + counting results manually. ' +
    'Returns: { count: <number> }.',
  parameters: {
    table_name: z
      .string()
      .describe(
        'The title of the table to count records in (case-insensitive).',
      ),
    where: z
      .string()
      .optional()
      .describe(
        'Where clause: (FieldTitle,op,value) chained with ~and / ~or. ' +
          'Operators: eq, neq, gt, lt, gte, lte, like ("%search%"), nlike, ' +
          'blank, notblank, null, notnull, empty, notempty, ' +
          'in ("A,B"), allof, anyof, nallof, nanyof, btw ("10,20"), nbtw, ' +
          'checked, notchecked, is, isnot, isWithin. ' +
          'Example: (Status,eq,Active)~and(CreatedAt,gt,2024-01-01)',
      ),
  },
  permission: 'dataCount',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: { table_name: string; where?: string },
    _req: NcRequest,
  ) {
    const dataService: DataTableService = Noco.nestApp.get(DataTableService);
    const model = await resolveTableByName(context, args.table_name);

    const result = await dataService.dataCount(context, {
      modelId: model.id,
      query: {
        where: args.where,
      },
      apiVersion: NcApiVersion.V3,
    });

    return {
      count: result.count,
    };
  },
};

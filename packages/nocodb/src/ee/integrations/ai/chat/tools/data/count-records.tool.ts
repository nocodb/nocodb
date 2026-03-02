import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DataTableService } from '~/services/data-table.service';
import Noco from '~/Noco';

export const countRecordsTool: ChatToolDefinition = {
  name: 'count_records',
  description:
    'Count the number of records in a table, optionally with a filter.',
  parameters: {
    table_name: z.string().describe('The name of the table'),
    where: z
      .string()
      .optional()
      .describe(
        'Optional filter condition in NocoDB format, e.g., "(Status,eq,Active)"',
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
    const defaultView = await model.getViews(context).then((v) => v[0]);

    const result = await dataService.dataCount(context, {
      modelId: model.id,
      viewId: defaultView?.id,
      query: {
        where: args.where,
      },
    });

    return {
      count: result.count,
      message: `Table "${args.table_name}" has ${result.count} records${
        args.where ? ' matching the filter' : ''
      }.`,
    };
  },
};

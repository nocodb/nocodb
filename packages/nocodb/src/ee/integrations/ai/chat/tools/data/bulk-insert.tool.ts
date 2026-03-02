import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DataTableService } from '~/services/data-table.service';
import Noco from '~/Noco';

export const bulkInsertTool: ChatToolDefinition = {
  name: 'bulk_insert',
  description:
    'Insert multiple records into a table at once. Provide an array of row objects.',
  parameters: {
    table_name: z.string().describe('The name of the table'),
    rows: z
      .array(z.record(z.any()))
      .describe(
        'Array of objects, each with field names as keys and their values.',
      ),
  },
  permission: 'bulkDataInsert',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: { table_name: string; rows: Record<string, any>[] },
    req: NcRequest,
  ) {
    const dataService: DataTableService = Noco.nestApp.get(DataTableService);
    const model = await resolveTableByName(context, args.table_name);
    const defaultView = await model.getViews(context).then((v) => v[0]);

    const result = await dataService.dataInsert(context, {
      modelId: model.id,
      viewId: defaultView?.id,
      body: args.rows,
      cookie: req,
    });

    return {
      inserted: Array.isArray(result) ? result.length : 1,
      message: `${args.rows.length} records inserted into table "${args.table_name}" successfully.`,
    };
  },
};

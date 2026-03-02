import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DataTableService } from '~/services/data-table.service';
import Noco from '~/Noco';

export const updateRecordTool: ChatToolDefinition = {
  name: 'update_record',
  description:
    'Update an existing record in a table. Provide the row ID and the fields to update.',
  parameters: {
    table_name: z.string().describe('The name of the table'),
    row_id: z.string().describe('The ID of the record to update'),
    data: z
      .record(z.any())
      .describe(
        'Object with field names as keys and their new values. Only include fields you want to change.',
      ),
  },
  permission: 'dataUpdate',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: { table_name: string; row_id: string; data: Record<string, any> },
    req: NcRequest,
  ) {
    const dataService: DataTableService = Noco.nestApp.get(DataTableService);
    const model = await resolveTableByName(context, args.table_name);
    const defaultView = await model.getViews(context).then((v) => v[0]);

    const result = await dataService.dataUpdate(context, {
      modelId: model.id,
      viewId: defaultView?.id,
      body: { Id: args.row_id, ...args.data },
      cookie: req,
    });

    return {
      record: result,
      message: `Record ${args.row_id} in table "${args.table_name}" updated successfully.`,
    };
  },
};

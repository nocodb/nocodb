import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DataTableService } from '~/services/data-table.service';
import Noco from '~/Noco';

export const deleteRecordTool: ChatToolDefinition = {
  name: 'delete_record',
  description: 'Delete a record from a table. This action cannot be undone.',
  parameters: {
    table_name: z.string().describe('The name of the table'),
    row_id: z.string().describe('The ID of the record to delete'),
  },
  permission: 'dataDelete',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: true,
  async execute(
    context: NcContext,
    args: { table_name: string; row_id: string },
    req: NcRequest,
  ) {
    const dataService: DataTableService = Noco.nestApp.get(DataTableService);
    const model = await resolveTableByName(context, args.table_name);
    const defaultView = await model.getViews(context).then((v) => v[0]);

    await dataService.dataDelete(context, {
      modelId: model.id,
      viewId: defaultView?.id,
      body: { Id: args.row_id },
      cookie: req,
    });

    return {
      message: `Record ${args.row_id} deleted from table "${args.table_name}".`,
    };
  },
};

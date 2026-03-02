import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DataTableService } from '~/services/data-table.service';
import Noco from '~/Noco';

export const getRecordTool: ChatToolDefinition = {
  name: 'get_record',
  description: 'Get a single record by its row ID.',
  parameters: {
    table_name: z.string().describe('The name of the table'),
    row_id: z.string().describe('The ID of the record to retrieve'),
  },
  permission: 'dataRead',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: { table_name: string; row_id: string },
    _req: NcRequest,
  ) {
    const dataService: DataTableService = Noco.nestApp.get(DataTableService);
    const model = await resolveTableByName(context, args.table_name);
    const defaultView = await model.getViews(context).then((v) => v[0]);

    return await dataService.dataRead(context, {
      modelId: model.id,
      viewId: defaultView?.id,
      rowId: args.row_id,
      query: {},
    });
  },
};

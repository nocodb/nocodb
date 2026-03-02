import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DataTableService } from '~/services/data-table.service';
import Noco from '~/Noco';

export const createRecordTool: ChatToolDefinition = {
  name: 'create_record',
  description:
    'Create a new record in a table. Provide field values as key-value pairs.',
  parameters: {
    table_name: z.string().describe('The name of the table'),
    data: z
      .record(z.any())
      .describe(
        'Object with field names as keys and their values. Use the field display name (title), not internal ID.',
      ),
  },
  permission: 'dataInsert',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: { table_name: string; data: Record<string, any> },
    req: NcRequest,
  ) {
    const dataService: DataTableService = Noco.nestApp.get(DataTableService);
    const model = await resolveTableByName(context, args.table_name);
    const defaultView = await model.getViews(context).then((v) => v[0]);

    const result = await dataService.dataInsert(context, {
      modelId: model.id,
      viewId: defaultView?.id,
      body: args.data,
      cookie: req,
    });

    return {
      record: result,
      message: `Record created in table "${args.table_name}" successfully.`,
    };
  },
};

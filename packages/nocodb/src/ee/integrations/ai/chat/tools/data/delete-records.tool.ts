import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DataV3Service } from '~/services/v3/data-v3.service';
import Noco from '~/Noco';

export const deleteRecordsTool: ChatToolDefinition = {
  name: 'delete_records',
  description:
    'Permanently delete one or more records from a table (1–10 at a time). This CANNOT be undone. ' +
    'You MUST call query_records first to obtain the IDs: each record in the response has an ' +
    '"id" field at the root level — collect those values and pass them all at once here. ' +
    'Do not call delete_records multiple times for the same batch — pass all IDs in a single call (max 10). ' +
    'Returns: { records: [{ id, deleted: true }, ...] }.',
  parameters: {
    table_name: z
      .string()
      .describe(
        'The title of the table containing the records (case-insensitive).',
      ),
    row_ids: z
      .array(z.string())
      .min(1)
      .max(10)
      .describe(
        'Array of primary key values ("id") of the records to delete (1–10 IDs). ' +
          'Get these from a prior query_records call — each record has an "id" field at the root level. ' +
          'Example: ["1", "2", "3"]',
      ),
  },
  permission: 'dataDelete',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: true,
  async execute(
    context: NcContext,
    args: { table_name: string; row_ids: string[] },
    req: NcRequest,
  ) {
    const dataV3Service: DataV3Service = Noco.nestApp.get(DataV3Service);
    const model = await resolveTableByName(context, args.table_name);
    const defaultView = await model.getViews(context).then((v) => v[0]);

    const result = await dataV3Service.dataDelete(context, {
      modelId: model.id,
      viewId: defaultView?.id,
      body: args.row_ids.map((id) => ({ id })),
      cookie: req,
    });

    return result;
  },
};

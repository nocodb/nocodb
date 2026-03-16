import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import {
  buildModelMeta,
  resolveTableByName,
} from '~/integrations/ai/chat/tools/helpers';
import { DataV3Service } from '~/services/v3/data-v3.service';
import Noco from '~/Noco';

export const deleteRecordsTool = defineChatTool({
  name: ChatToolName.DELETE_RECORDS,
  description:
    'Permanently delete 1–10 records from a table. This CANNOT be undone. ' +
    'MUST call query_records first to get row IDs — never guess or hardcode them. ' +
    'Pass all IDs in a single call (max 10) — do not call multiple times for the same batch. ' +
    'Deleting a record also removes its links in related tables. ' +
    'Returns { records: [{ id, deleted: true }, ...] }.',
  schema: z.object({
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
  }),
  visibility: 'action',
  category: 'data',
  permission: 'dataDelete',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: true,
  async execute(context, args, req) {
    const dataV3Service: DataV3Service = Noco.nestApp.get(DataV3Service);
    const model = await resolveTableByName(context, args.table_name);
    const defaultView = await model.getViews(context).then((v) => v[0]);

    return await dataV3Service.dataDelete(context, {
      modelId: model.id,
      viewId: defaultView?.id,
      body: args.row_ids.map((id) => ({ id })),
      cookie: req,
    });
  },
  async buildMeta(context, args) {
    const model = await resolveTableByName(context, args.table_name);
    return { model: await buildModelMeta(context, model) };
  },
});

import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import {
  resolveColumnByName,
  resolveTableByName,
} from '~/integrations/ai/chat/tools/helpers';
import { DataV3Service } from '~/services/v3/data-v3.service';
import Noco from '~/Noco';

export const unlinkRecordsTool = defineChatTool({
  name: ChatToolName.UNLINK_RECORDS,
  description:
    'Unlink (disassociate) 1–10 records from a source row through a Link/LTAR field. ' +
    'This removes the relationship only — records themselves are NOT deleted. ' +
    'Use query_records or list_linked_records first to see currently linked records and get their IDs. ' +
    'This is the correct way to remove relationships — never set Link/LTAR fields directly.',
  schema: z.object({
    table_name: z
      .string()
      .describe(
        'The title of the table that contains the link field (case-insensitive).',
      ),
    link_field_name: z
      .string()
      .describe(
        'The title of the LinkToAnotherRecord field (case-insensitive).',
      ),
    row_id: z
      .union([z.string(), z.number()])
      .describe(
        'The primary key value of the source record to unlink from. ' +
          'Get this from query_records.',
      ),
    linked_row_ids: z
      .array(z.union([z.string(), z.number()]))
      .min(1)
      .max(10)
      .describe(
        'Array of primary key values from the related table to unlink (1–10). ' +
          'Get these from list_linked_records.',
      ),
  }),
  visibility: 'action',
  category: 'data',
  permission: 'nestedDataUnlink',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: true,
  async execute(context, args, req) {
    const dataV3Service: DataV3Service = Noco.nestApp.get(DataV3Service);
    const model = await resolveTableByName(context, args.table_name);
    const column = await resolveColumnByName(
      context,
      model,
      args.link_field_name,
    );

    return await dataV3Service.nestedUnlink(context, {
      modelId: model.id,
      columnId: column.id,
      rowId: String(args.row_id),
      refRowIds: args.linked_row_ids.map(String),
      cookie: req,
    });
  },
});

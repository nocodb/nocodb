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

export const linkRecordsTool = defineChatTool({
  name: ChatToolName.LINK_RECORDS,
  description:
    'Link (associate) 1–10 records to a source row through a Link/LTAR field. ' +
    'Target records must already exist in the related table. ' +
    'Use query_records on the related table first to get the IDs to link. ' +
    'This is the correct way to create relationships — never set Link/LTAR fields directly in create_records or update_records. ' +
    'Example: link Orders 5 and 8 to Customer 1 via the "Orders" link field on Customers → ' +
    'table_name="Customers", link_field_name="Orders", row_id="1", linked_row_ids=["5", "8"].',
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
        'The primary key value of the source record to link from. Get this from query_records.',
      ),
    linked_row_ids: z
      .array(z.union([z.string(), z.number()]))
      .min(1)
      .max(10)
      .describe(
        'Array of primary key values from the related table to link to (1–10). ' +
          'Get these from query_records on the related table.',
      ),
  }),
  visibility: 'action',
  category: 'data',
  permission: 'nestedDataLink',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: false,
  async execute(context, args, req) {
    const dataV3Service: DataV3Service = Noco.nestApp.get(DataV3Service);
    const model = await resolveTableByName(context, args.table_name);
    const column = await resolveColumnByName(
      context,
      model,
      args.link_field_name,
    );

    return await dataV3Service.nestedLink(context, {
      modelId: model.id,
      columnId: column.id,
      rowId: String(args.row_id),
      refRowIds: args.linked_row_ids.map(String),
      cookie: req,
    });
  },
});

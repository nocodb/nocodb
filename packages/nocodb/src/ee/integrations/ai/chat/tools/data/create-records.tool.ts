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

export const createRecordsTool = defineChatTool({
  name: ChatToolName.CREATE_RECORDS,
  description:
    'Insert 1–10 records into a table. Returns inserted records as [{ id, fields }, ...]. ' +
    'Do NOT include the primary key — it is auto-generated. ' +
    'Field value rules: ' +
    'SingleSelect: must exactly match a defined option (case-sensitive). ' +
    'MultiSelect: comma-separated option values, e.g. "Tag1,Tag2". ' +
    'Checkbox: true/false. Date: "YYYY-MM-DD". DateTime: "YYYY-MM-DD HH:MM:SS". ' +
    'Link/LTAR fields: do NOT set directly — use link_records after creation. ' +
    'Call describe_table first to see field names, types, and available options.',
  schema: z.object({
    table_name: z
      .string()
      .describe(
        'The title of the table to insert records into (case-insensitive).',
      ),
    rows: z
      .array(z.object({ fields: z.record(z.any()) }))
      .min(1)
      .max(10)
      .describe(
        'Array of records to insert (1–10). Each element must be { "fields": { "FieldTitle": value, ... } }. ' +
          'Keys inside "fields" must exactly match field titles (case-sensitive). ' +
          'Do NOT include the primary key — it is auto-generated. ' +
          'Example: [{ "fields": { "Name": "Alice", "Status": "Active" } }, { "fields": { "Name": "Bob", "Status": "Inactive" } }]',
      ),
  }),
  visibility: 'action',
  category: 'data',
  permission: 'dataInsert',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: false,
  async execute(context, args, req) {
    const dataV3Service: DataV3Service = Noco.nestApp.get(DataV3Service);
    const model = await resolveTableByName(context, args.table_name);
    const defaultView = await model.getViews(context).then((v) => v[0]);

    const cookieWithTypecast = Object.assign({}, req, {
      query: { ...req.query, typecast: 'true', linksAsLtar: 'true' },
    });

    return await dataV3Service.dataInsert(context, {
      modelId: model.id,
      viewId: defaultView?.id,
      body: args.rows as { fields: Record<string, any> }[],
      cookie: cookieWithTypecast,
    });
  },
  async buildMeta(context, args) {
    const model = await resolveTableByName(context, args.table_name);
    return { model: await buildModelMeta(context, model) };
  },
});

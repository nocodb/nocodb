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

export const updateRecordsTool = defineChatTool({
  name: ChatToolName.UPDATE_RECORDS,
  description:
    'Update 1–10 existing records identified by their primary key ("id"). ' +
    'Only include fields you want to change — omitted fields are untouched. ' +
    'MUST call query_records first to get row IDs — never guess or hardcode them. ' +
    'Field value rules: ' +
    'SingleSelect: must exactly match a defined option (case-sensitive). ' +
    'MultiSelect: comma-separated option titles, e.g. "Tag1,Tag2". ' +
    'Checkbox: true/false. Date: "YYYY-MM-DD". DateTime: "YYYY-MM-DD HH:MM:SS". ' +
    'Link/LTAR fields: do NOT set directly — use link_records/unlink_records instead. ' +
    'Returns { records: [{ id, fields }, ...] }.',
  schema: z.object({
    table_name: z
      .string()
      .describe(
        'The title of the table containing the records (case-insensitive).',
      ),
    rows: z
      .array(
        z.object({
          id: z
            .string()
            .describe(
              'The primary key value ("id") of the record to update. ' +
                'Get this from a prior query_records call — each record has an "id" field at the root level.',
            ),
          fields: z
            .record(z.any())
            .describe(
              'Fields to update as { "FieldTitle": newValue, ... }. ' +
                'Keys must exactly match field titles (case-sensitive). ' +
                'Include only the fields you want to change — other fields are untouched.',
            ),
        }),
      )
      .min(1)
      .max(10)
      .describe(
        'Array of records to update (1–10). Each element must be { "id": "<row_id>", "fields": { "FieldTitle": newValue, ... } }. ' +
          'Example: [{ "id": "1", "fields": { "Status": "Done" } }, { "id": "2", "fields": { "Priority": 3 } }]',
      ),
  }),
  visibility: 'action',
  category: 'data',
  permission: 'dataUpdate',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: true,
  async execute(context, args, req) {
    const dataV3Service: DataV3Service = Noco.nestApp.get(DataV3Service);
    const model = await resolveTableByName(context, args.table_name);
    const defaultView = await model.getViews(context).then((v) => v[0]);

    const cookieWithTypecast = Object.assign({}, req, {
      query: { ...req.query, typecast: 'true', linksAsLtar: 'true' },
    });

    return await dataV3Service.dataUpdate(context, {
      modelId: model.id,
      viewId: defaultView?.id,
      body: args.rows as { id: string; fields: Record<string, any> }[],
      cookie: cookieWithTypecast,
    });
  },
  async buildMeta(context, args) {
    const model = await resolveTableByName(context, args.table_name);
    return { model: await buildModelMeta(context, model) };
  },
});

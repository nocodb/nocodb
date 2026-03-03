import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DataV3Service } from '~/services/v3/data-v3.service';
import Noco from '~/Noco';

export const updateRecordsTool: ChatToolDefinition = {
  name: 'update_records',
  description:
    'Update one or more existing records (1–10 per call), identified by their primary key values. ' +
    'Only include the fields you want to change — other fields are untouched. ' +
    'You MUST call query_records first to obtain the row IDs: each record in the response has an ' +
    '"id" field at the root level — use those values in the "id" of each row here. ' +
    'Field value rules: SingleSelect must exactly match one of the defined options (case-sensitive). ' +
    'MultiSelect: comma-separated option titles, e.g. "Tag1,Tag2". ' +
    'Checkbox: true or false. Date: "YYYY-MM-DD". DateTime: "YYYY-MM-DD HH:MM:SS". ' +
    'Returns updated records in v3 format: { records: [{ id, fields }, ...] }.',
  parameters: {
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
                'Keys must exactly match field titles from describe_table (case-sensitive). ' +
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
  },
  permission: 'dataUpdate',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: {
      table_name: string;
      rows: { id: string; fields: Record<string, any> }[];
    },
    req: NcRequest,
  ) {
    const dataV3Service: DataV3Service = Noco.nestApp.get(DataV3Service);
    const model = await resolveTableByName(context, args.table_name);
    const defaultView = await model.getViews(context).then((v) => v[0]);

    const result = await dataV3Service.dataUpdate(context, {
      modelId: model.id,
      viewId: defaultView?.id,
      body: args.rows,
      cookie: req,
    });

    return result;
  },
};

import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DataV3Service } from '~/services/v3/data-v3.service';
import Noco from '~/Noco';

export const createRecordsTool: ChatToolDefinition = {
  name: 'create_records',
  description:
    'Insert one or more records into a table (1–10 per call). ' +
    'Field value rules: ' +
    'SingleSelect must exactly match one of the defined options (case-sensitive). ' +
    'MultiSelect: comma-separated option values, e.g. "Tag1,Tag2". ' +
    'Checkbox: true or false. Date: "YYYY-MM-DD". DateTime: "YYYY-MM-DD HH:MM:SS". ' +
    'Do NOT include the primary key — it is auto-generated for every record. ' +
    'Returns inserted records in v3 format: { records: [{ id, fields }, ...] }.',
  parameters: {
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
  },
  permission: 'dataInsert',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: { table_name: string; rows: { fields: Record<string, any> }[] },
    req: NcRequest,
  ) {
    const dataV3Service: DataV3Service = Noco.nestApp.get(DataV3Service);
    const model = await resolveTableByName(context, args.table_name);
    const defaultView = await model.getViews(context).then((v) => v[0]);

    const cookieWithTypecast = Object.assign({}, req, {
      query: { ...(req as any).query, typecast: 'true' },
    });

    const result = await dataV3Service.dataInsert(context, {
      modelId: model.id,
      viewId: defaultView?.id,
      body: args.rows,
      cookie: cookieWithTypecast,
    });

    return result;
  },
};

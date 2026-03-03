import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName, resolveColumnByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DataV3Service } from '~/services/v3/data-v3.service';
import Noco from '~/Noco';

export const unlinkRecordsTool: ChatToolDefinition = {
  name: 'unlink_records',
  description:
    'Unlink (disassociate) one or more records from a source row through a LinkToAnotherRecord field. ' +
    'This removes the relationship only — it does NOT delete the records themselves. ' +
    'Use list_linked_records first to see which records are currently linked and get their IDs.',
  parameters: {
    table_name: z
      .string()
      .describe(
        'The title of the table that contains the link field (case-insensitive).',
      ),
    link_field_name: z
      .string()
      .describe(
        'The title of the LinkToAnotherRecord field (case-insensitive). ' +
          'Use describe_table to find it.',
      ),
    row_id: z
      .union([z.string(), z.number()])
      .describe(
        'The primary key value of the source record to unlink from. ' +
          'Get this from query_records or get_record.',
      ),
    linked_row_ids: z
      .array(z.union([z.string(), z.number()]))
      .min(1)
      .max(10)
      .describe(
        'Array of primary key values from the related table to unlink (1–10). ' +
          'Get these from list_linked_records.',
      ),
  },
  permission: 'nestedDataUnlink',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: true,
  async execute(
    context: NcContext,
    args: {
      table_name: string;
      link_field_name: string;
      row_id: string | number;
      linked_row_ids: (string | number)[];
    },
    req: NcRequest,
  ) {
    const dataV3Service: DataV3Service = Noco.nestApp.get(DataV3Service);
    const model = await resolveTableByName(context, args.table_name);
    const column = await resolveColumnByName(
      context,
      model,
      args.link_field_name,
    );

    const result = await dataV3Service.nestedUnlink(context, {
      modelId: model.id,
      columnId: column.id,
      rowId: String(args.row_id),
      refRowIds: args.linked_row_ids.map(String),
      cookie: req,
    });

    return result;
  },
};

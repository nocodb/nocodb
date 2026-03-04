import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveColumnByName, resolveTableByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DataV3Service } from '~/services/v3/data-v3.service';
import Noco from '~/Noco';

export const linkRecordsTool: ChatToolDefinition = {
  name: 'link_records',
  description:
    'Link (associate) one or more records to a source row through a LinkToAnotherRecord field. ' +
    'The target records must already exist in the related table. ' +
    'Use query_records on the related table first to get the IDs of records to link. ' +
    'Example: to link Orders 5 and 8 to Customer 1 via a "Orders" link field on the Customers table, ' +
    'call with table_name="Customers", link_field_name="Orders", row_id=1, linked_row_ids=[5, 8].',
  parameters: {
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
        'The primary key value of the source record to link from. ' +
          'Get this from query_records or get_record.',
      ),
    linked_row_ids: z
      .array(z.union([z.string(), z.number()]))
      .min(1)
      .max(10)
      .describe(
        'Array of primary key values from the related table to link to (1–10). ' +
          'Get these from query_records on the related table.',
      ),
  },
  permission: 'nestedDataLink',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: false,
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

    const result = await dataV3Service.nestedLink(context, {
      modelId: model.id,
      columnId: column.id,
      rowId: String(args.row_id),
      refRowIds: args.linked_row_ids.map(String),
      cookie: req,
    });

    return result;
  },
};

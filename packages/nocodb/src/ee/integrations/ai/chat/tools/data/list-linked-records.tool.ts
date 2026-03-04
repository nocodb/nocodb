import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveColumnByName, resolveTableByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DataV3Service } from '~/services/v3/data-v3.service';
import Noco from '~/Noco';

export const listLinkedRecordsTool: ChatToolDefinition = {
  name: 'list_linked_records',
  description:
    'List records linked to a specific row through a LinkToAnotherRecord field. ' +
    'Returns the linked records with their fields. ' +
    'Use query_records first to get the row_id of the source record. ' +
    'For one-to-many (om) and many-to-many (mm) fields, returns an array of linked records. ' +
    'For one-to-one (oo) or many-to-one (mo), returns a single record or null.',
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
        'The primary key value of the source record. ' +
          'Get this from query_records or get_record.',
      ),
    limit: z
      .number()
      .optional()
      .describe('Maximum number of linked records to return. Default: 25.'),
    offset: z
      .number()
      .optional()
      .describe('Number of linked records to skip for pagination.'),
  },
  permission: 'nestedDataList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  async execute(
    context: NcContext,
    args: {
      table_name: string;
      link_field_name: string;
      row_id: string | number;
      limit?: number;
      offset?: number;
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
    const defaultView = await model.getViews(context).then((v) => v[0]);

    const result = await dataV3Service.nestedDataList(context, {
      modelId: model.id,
      rowId: String(args.row_id),
      columnId: column.id,
      viewId: defaultView?.id,
      query: {
        limit: String(Math.min(args.limit || 25, 100)),
        offset: String(args.offset || 0),
      },
      req,
    });

    return result;
  },
};

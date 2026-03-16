import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import {
  buildModelMeta,
  resolveColumnByName,
  resolveTableByName,
} from '~/integrations/ai/chat/tools/helpers';
import { DataV3Service } from '~/services/v3/data-v3.service';
import Noco from '~/Noco';

export const listLinkedRecordsTool = defineChatTool({
  name: ChatToolName.LIST_LINKED_RECORDS,
  description:
    'List records linked to a specific row through a Link/LTAR field, with pagination. ' +
    'Note: query_records already returns linked records inline (up to the default limit) — ' +
    'use this tool only when you need to paginate through many linked records beyond that limit. ' +
    'Returns linked records as { id, fields } objects. ' +
    'For hm (has-many) and mm (many-to-many): returns an array. ' +
    'For oo (one-to-one) and bt (belongs-to): returns a single record or null.',
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
        'The primary key value of the source record. ' +
          'Get this from query_records.',
      ),
    limit: z
      .number()
      .optional()
      .describe('Maximum number of linked records to return. Default: 25.'),
    offset: z
      .number()
      .optional()
      .describe('Number of linked records to skip for pagination.'),
  }),
  visibility: 'data',
  category: 'data',
  permission: 'nestedDataList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  async execute(context, args, req) {
    const dataV3Service: DataV3Service = Noco.nestApp.get(DataV3Service);
    const model = await resolveTableByName(context, args.table_name);
    const column = await resolveColumnByName(
      context,
      model,
      args.link_field_name,
    );
    const defaultView = await model.getViews(context).then((v) => v[0]);

    return await dataV3Service.nestedDataList(context, {
      modelId: model.id,
      rowId: String(args.row_id),
      columnId: column.id,
      viewId: defaultView?.id,
      query: {
        limit: String(Math.min(args.limit || 25, 100)),
        offset: String(args.offset || 0),
        linksAsLtar: 'true',
      },
      req,
    });
  },
  async buildMeta(context, args) {
    const model = await resolveTableByName(context, args.table_name);
    return { model: await buildModelMeta(context, model) };
  },
});

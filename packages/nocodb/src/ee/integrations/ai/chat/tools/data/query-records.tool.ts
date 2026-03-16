import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import {
  buildModelMeta,
  buildRelatedModelsMeta,
  resolveTableByName,
} from '~/integrations/ai/chat/tools/helpers';
import { whereDescription } from '~/mcp/descriptions';
import { DataV3Service } from '~/services/v3/data-v3.service';
import Noco from '~/Noco';

export const queryRecordsTool = defineChatTool({
  name: ChatToolName.QUERY_RECORDS,
  description:
    'Query records from a table with filtering, sorting, field selection, and pagination. ' +
    'Returns { records: [{ id, fields }, ...] }. ' +
    'Link/LTAR fields return actual linked records inline (not counts), each as { id, fields }. ' +
    'The "id" at root level is the primary key — use it directly in update_records, delete_records, ' +
    'link_records, and unlink_records. Never guess or construct row IDs. ' +
    'Call describe_table first to learn field names and types for filtering.',
  schema: z.object({
    table_name: z
      .string()
      .describe('The title of the table to query (case-insensitive).'),
    where: z.string().optional().describe(whereDescription),
    sort: z
      .string()
      .optional()
      .describe(
        'Sort as a JSON array: [{"field": "FieldTitle", "direction": "asc"}, {"field": "OtherField", "direction": "desc"}]. ' +
          '"direction" must be "asc" or "desc". ' +
          'Example: [{"field": "CreatedAt", "direction": "desc"}]',
      ),
    fields: z
      .string()
      .optional()
      .describe(
        'Comma-separated list of field titles to include in the fields object. ' +
          'If omitted, all fields are returned. Use to reduce response size for wide tables.',
      ),
    limit: z
      .number()
      .optional()
      .describe(
        'Maximum number of records to return. Default: 25, maximum: 100.',
      ),
    offset: z
      .number()
      .optional()
      .describe(
        'Number of records to skip for pagination. Use with limit to page through large datasets.',
      ),
  }),
  visibility: 'data',
  category: 'data',
  permission: 'dataList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  async execute(context, args, req) {
    const dataV3Service: DataV3Service = Noco.nestApp.get(DataV3Service);
    const model = await resolveTableByName(context, args.table_name);

    return await dataV3Service.dataList(
      context,
      {
        modelId: model.id,
        query: {
          where: args.where,
          sort: args.sort,
          fields: args.fields,
          limit: String(Math.min(args.limit || 25, 100)),
          offset: String(args.offset || 0),
          linksAsLtar: 'true',
        },
        req,
      },
      false,
    );
  },
  async buildMeta(context, args) {
    const model = await resolveTableByName(context, args.table_name);
    const modelMeta = await buildModelMeta(context, model);
    const columns = await model.getColumns(context);
    const { modelMap, columnModelMap } = await buildRelatedModelsMeta(
      context,
      columns,
    );

    return { model: modelMeta, modelMap, columnModelMap };
  },
});

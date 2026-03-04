import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DataV3Service } from '~/services/v3/data-v3.service';
import Noco from '~/Noco';

export const getRecordTool: ChatToolDefinition = {
  name: 'get_record',
  description:
    'Get a single record by its primary key value. ' +
    'Returns the record in v3 format: { id: <pk_value>, fields: { fieldName: value, ... } }. ' +
    'The row_id is the "id" value returned by query_records — always fetch it from query_records first.',
  parameters: {
    table_name: z
      .string()
      .describe(
        'The title of the table containing the record (case-insensitive).',
      ),
    row_id: z
      .string()
      .describe(
        'The primary key value ("id") of the record to fetch. ' +
          'Get this from a prior query_records call — each record has an "id" field at the root level.',
      ),
  },
  permission: 'dataRead',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  async execute(
    context: NcContext,
    args: { table_name: string; row_id: string },
    req: NcRequest,
  ) {
    const dataV3Service: DataV3Service = Noco.nestApp.get(DataV3Service);
    const model = await resolveTableByName(context, args.table_name);
    const defaultView = await model.getViews(context).then((v) => v[0]);

    return await dataV3Service.dataRead(context, {
      modelId: model.id,
      viewId: defaultView?.id,
      rowId: args.row_id,
      query: {},
      req,
    });
  },
};

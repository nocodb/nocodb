import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';

export const describeTableTool: ChatToolDefinition = {
  name: 'describe_table',
  description:
    'Get the full schema of a table: all user-visible fields with their name, type, ' +
    'required flag, display field flag, and available options for SingleSelect/MultiSelect fields. ' +
    'Call this before creating or modifying fields, and before writing records to a table you have not ' +
    'seen yet — it tells you exact field names, types, and option values that records must match.',
  parameters: {
    table_name: z
      .string()
      .describe(
        'The title of the table to describe (case-insensitive). Use list_tables to get valid names.',
      ),
  },
  permission: 'tableGet',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: { table_name: string },
    _req: NcRequest,
  ) {
    const model = await resolveTableByName(context, args.table_name);
    const columns = await model.getColumns(context);

    return {
      id: model.id,
      title: model.title,
      description: model.description || null,
      columns: columns
        .filter((c) => !c.system)
        .map((c) => ({
          id: c.id,
          title: c.title,
          type: c.uidt,
          required: !!c.rqd,
          primary: !!c.pv,
          description: c.description || null,
          options: c.colOptions?.options?.map((o) => o.title) || undefined,
        })),
    };
  },
};

import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveTableByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { ColumnsService } from '~/services/columns.service';
import Noco from '~/Noco';

export const addFieldTool: ChatToolDefinition = {
  name: 'add_field',
  description: 'Add a new field (column) to an existing table.',
  parameters: {
    table_name: z
      .string()
      .describe('The name of the table to add the field to'),
    title: z.string().describe('Name of the new field'),
    uidt: z
      .string()
      .describe(
        'Field type (e.g., SingleLineText, Number, Email, SingleSelect, MultiSelect, Date, DateTime, Checkbox, Rating, URL, Currency, Duration, Percent, PhoneNumber, LongText)',
      ),
    dtxp: z
      .string()
      .optional()
      .describe(
        'For select fields, comma-separated options (e.g., "Option1,Option2,Option3")',
      ),
  },
  permission: 'columnCreate',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: { table_name: string; title: string; uidt: string; dtxp?: string },
    req: NcRequest,
  ) {
    const columnsService: ColumnsService = Noco.nestApp.get(ColumnsService);
    const model = await resolveTableByName(context, args.table_name);

    const column = await columnsService.columnAdd(context, {
      tableId: model.id,
      column: {
        title: args.title,
        uidt: args.uidt,
        ...(args.dtxp ? { dtxp: args.dtxp } : {}),
      } as any,
      req,
      user: (req as any).user,
    });

    return {
      id: column?.id,
      title: args.title,
      type: args.uidt,
      message: `Field "${args.title}" added to table "${args.table_name}" successfully.`,
    };
  },
};

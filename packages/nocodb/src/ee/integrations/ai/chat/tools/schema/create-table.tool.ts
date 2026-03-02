import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { TablesService } from '~/services/tables.service';
import Noco from '~/Noco';

export const createTableTool: ChatToolDefinition = {
  name: 'create_table',
  description:
    'Create a new table in the current base with the specified title and columns.',
  parameters: {
    title: z.string().describe('The name for the new table'),
    columns: z
      .array(
        z.object({
          title: z.string().describe('Column name'),
          uidt: z
            .string()
            .describe(
              'Column type (e.g., SingleLineText, Number, Email, SingleSelect, MultiSelect, Date, DateTime, Checkbox, Rating, URL, Currency, Duration, Percent, PhoneNumber, LongText)',
            ),
          dtxp: z
            .string()
            .optional()
            .describe(
              'For select fields, comma-separated options (e.g., "Option1,Option2,Option3")',
            ),
        }),
      )
      .optional()
      .describe(
        'Columns to create. If not provided, a default Title column is created.',
      ),
  },
  permission: 'tableCreate',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: {
      title: string;
      columns?: Array<{ title: string; uidt: string; dtxp?: string }>;
    },
    req: NcRequest,
  ) {
    const tablesService: TablesService = Noco.nestApp.get(TablesService);

    const table = await tablesService.tableCreate(context, {
      baseId: context.base_id,
      table: {
        title: args.title,
        columns: args.columns || [],
      } as any,
      user: (req as any).user,
      req,
    });

    return {
      id: table.id,
      title: table.title,
      message: `Table "${table.title}" created successfully.`,
    };
  },
};

import { z } from 'zod';
import { ProjectRoles, ViewTypes } from 'nocodb-sdk';
import { resolveTableByName } from '../helpers';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import View from '~/models/View';

const VIEW_TYPE_MAP: Record<string, ViewTypes> = {
  grid: ViewTypes.GRID,
  form: ViewTypes.FORM,
  gallery: ViewTypes.GALLERY,
  kanban: ViewTypes.KANBAN,
  calendar: ViewTypes.CALENDAR,
};

export const createViewTool: ChatToolDefinition = {
  name: 'create_view',
  description:
    'Create a new view for a table (grid, form, gallery, kanban, or calendar).',
  parameters: {
    table_name: z.string().describe('The name of the table'),
    title: z.string().describe('Name for the new view'),
    type: z
      .enum(['grid', 'form', 'gallery', 'kanban', 'calendar'])
      .describe('Type of view to create'),
  },
  permission: 'viewCreate',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: { table_name: string; title: string; type: string },
    req: NcRequest,
  ) {
    const model = await resolveTableByName(context, args.table_name);

    const viewType = VIEW_TYPE_MAP[args.type];
    if (!viewType) {
      throw new Error(`Invalid view type: ${args.type}`);
    }

    const view = await View.insert(context, {
      view: {
        title: args.title,
        type: viewType,
        fk_model_id: model.id,
      } as any,
      req,
    });

    return {
      id: view.id,
      title: view.title,
      type: args.type,
      message: `${args.type} view "${args.title}" created for table "${args.table_name}".`,
    };
  },
};

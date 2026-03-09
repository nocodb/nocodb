import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DashboardsService } from '~/services/dashboards.service';
import Noco from '~/Noco';

export const createDashboardTool: ChatToolDefinition = {
  name: 'create_dashboard',
  description:
    'Create a new dashboard in the current base. ' +
    'A dashboard is a visual canvas where widgets (charts, metrics, text, iframes) can be placed to build data-driven views. ' +
    'After creating a dashboard, use create_widget to add widgets to it.',
  parameters: {
    title: z.string().describe('The display name for the new dashboard.'),
    description: z
      .string()
      .optional()
      .describe(
        'An optional description explaining the purpose of the dashboard.',
      ),
  },
  permission: 'dashboardCreate',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: { title: string; description?: string },
    req: NcRequest,
  ) {
    const service: DashboardsService = Noco.nestApp.get(DashboardsService);

    const dashboard = await service.dashboardCreate(
      context,
      {
        title: args.title,
        ...(args.description && { description: args.description }),
        base_id: context.base_id,
        fk_workspace_id: context.workspace_id,
      },
      req,
    );

    return {
      id: dashboard.id,
      title: dashboard.title,
      message: `Dashboard "${dashboard.title}" created successfully.`,
    };
  },
};

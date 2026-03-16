import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import { DashboardsService } from '~/services/dashboards.service';
import Noco from '~/Noco';

export const listDashboardsTool = defineChatTool({
  name: ChatToolName.LIST_DASHBOARDS,
  description:
    'List all dashboards in the current base. Returns id, title, and description for each dashboard. ' +
    'Use this to discover available dashboards before creating, updating, or deleting widgets.',
  schema: z.object({}),
  permission: 'dashboardList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  visibility: 'hidden',
  category: 'dashboard',
  async execute(context, _args, _req) {
    const service: DashboardsService = Noco.nestApp.get(DashboardsService);

    const dashboards = await service.dashboardList(context, context.base_id);

    return dashboards.map((d: any) => ({
      id: d.id,
      title: d.title,
      description: d.description || null,
      order: d.order,
    }));
  },
});

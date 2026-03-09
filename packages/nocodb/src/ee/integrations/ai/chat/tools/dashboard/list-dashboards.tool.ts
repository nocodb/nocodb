import { ProjectRoles } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DashboardsService } from '~/services/dashboards.service';
import Noco from '~/Noco';

export const listDashboardsTool: ChatToolDefinition = {
  name: 'list_dashboards',
  description:
    "List all dashboards in the current base. Returns each dashboard's id, title, description." +
    'Use this to discover available dashboards before creating or modifying widgets.',
  parameters: {},
  permission: 'dashboardList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  async execute(context: NcContext, _args: any, _req: NcRequest) {
    const service: DashboardsService = Noco.nestApp.get(DashboardsService);

    const dashboards = await service.dashboardList(context, context.base_id);

    return dashboards.map((d: any) => ({
      id: d.id,
      title: d.title,
      description: d.description || null,
      order: d.order,
    }));
  },
};

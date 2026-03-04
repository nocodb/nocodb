import { extractRolesObj, ProjectRoles } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { TablesService } from '~/services/tables.service';
import Noco from '~/Noco';

export const listTablesTool: ChatToolDefinition = {
  name: 'list_tables',
  description:
    "List all tables in the current base. Returns each table's id, title, description, and " +
    'column count. Use this first to discover available tables before operating on them.',
  parameters: {},
  permission: 'tableList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  async execute(context: NcContext, _args: any, req: NcRequest) {
    const tablesService: TablesService = Noco.nestApp.get(TablesService);

    const tables = await tablesService.getAccessibleTables(context, {
      baseId: context.base_id,
      includeM2M: false,
      roles: extractRolesObj(req.user?.base_roles || req.user?.roles),
      user: req.user,
    });

    return tables.map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description || null,
      columns_count: t.columns?.length || 0,
    }));
  },
};

import { z } from 'zod';
import { extractRolesObj, ProjectRoles } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { TablesService } from '~/services/tables.service';
import Noco from '~/Noco';

export const listTablesTool: ChatToolDefinition = {
  name: 'list_tables',
  description:
    'List all tables in the current base with their field counts and descriptions.',
  parameters: {},
  permission: 'tableList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  async execute(context: NcContext, _args: any, req: NcRequest) {
    const tablesService: TablesService = Noco.nestApp.get(TablesService);

    const tables = await tablesService.getAccessibleTables(context, {
      baseId: context.base_id,
      includeM2M: false,
      roles: extractRolesObj(
        (req as any).user?.base_roles || (req as any).user?.roles,
      ),
      user: (req as any).user,
    });

    return tables.map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description || null,
      columns_count: t.columns?.length || 0,
    }));
  },
};

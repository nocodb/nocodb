import { z } from 'zod';
import { extractRolesObj, ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import { TablesV3Service } from '~/services/v3/tables-v3.service';
import Noco from '~/Noco';

export const listTablesTool = defineChatTool({
  name: ChatToolName.LIST_TABLES,
  description:
    'List all tables in the current base. Returns id, title, description, and field count for each table in V3 format. ' +
    'Use this first to discover available tables before querying data or describing schemas. ' +
    'Many-to-many junction tables are excluded from the list.',
  schema: z.object({}),
  permission: 'tableList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  visibility: 'hidden',
  category: 'schema',
  async execute(context, _args, req) {
    const tablesV3Service: TablesV3Service = Noco.nestApp.get(TablesV3Service);

    const tables = await tablesV3Service.getAccessibleTables(context, {
      baseId: context.base_id,
      includeM2M: false,
      roles: extractRolesObj(req.user?.base_roles || req.user?.roles),
      user: req.user,
    });

    return tables.map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description || null,
    }));
  },
});

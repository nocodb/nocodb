import { ProjectRoles } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import Base from '~/models/Base';

export const listBasesTool: ChatToolDefinition = {
  name: 'list_bases',
  description:
    "List all bases in the current workspace. Returns each base's id and title. " +
    'Use this when the user is not inside a base, or wants to know which bases are available. ' +
    'Note: you can only operate on the base the user currently has open — ' +
    'if they want to work on a different base, ask them to open it from the sidebar.',
  parameters: {},
  scope: 'workspace',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  async execute(context: NcContext, _args: any, req: NcRequest) {
    // Use listByWorkspaceAndUser to respect private base access rules —
    // Base.list() returns ALL bases including ones the user cannot access.
    const bases = await Base.listByWorkspaceAndUser(
      context.workspace_id,
      req.user.id,
    );

    return bases.map((b: any) => ({
      id: b.id,
      title: b.title,
      description: b.description || null,
    }));
  },
};

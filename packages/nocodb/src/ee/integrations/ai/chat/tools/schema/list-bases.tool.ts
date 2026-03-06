import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import Base from '~/models/Base';

export const listBasesTool: ChatToolDefinition = {
  name: 'list_bases',
  description:
    "List all bases in the current workspace that the user can access. Returns each base's id and title. " +
    'Use this to discover available bases. ' +
    'To read data from a different base, use base_proxy with the base id. ' +
    'For write operations on another base, ask the user to navigate to it first.',
  parameters: {},
  scope: 'workspace',
  // listByWorkspaceAndUser already filters to accessible bases only.
  requiredRole: null,
  permission: 'workspaceBaseList',
  isDangerous: false,
  readonly: true,
  async execute(context: NcContext, _args: any, req: NcRequest) {
    // Use listByWorkspaceAndUser to respect private base access rules
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

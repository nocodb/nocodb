import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';

export const navigateBaseTool: ChatToolDefinition = {
  name: 'navigate_base',
  description:
    'Navigate the user to a different base in the UI. ' +
    'Use list_bases to find available bases first. ' +
    'This changes the active base context for subsequent operations.',
  parameters: {
    base_id: z.string().describe('The ID of the base to navigate to.'),
  },
  scope: 'workspace',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: true,
  readonly: true,
  async execute(
    _context: NcContext,
    args: { base_id: string },
    _req: NcRequest,
  ) {
    return {
      __ui_action: 'navigate_base',
      base_id: args.base_id,
      message: `Navigating to base.`,
    };
  },
};

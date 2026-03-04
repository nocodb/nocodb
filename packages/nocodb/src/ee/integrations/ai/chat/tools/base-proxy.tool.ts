import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import type { ChatToolDefinition } from './chat-tool-registry';

export const baseProxyTool: ChatToolDefinition = {
  name: 'base_proxy',
  description:
    'Run a read-only tool against a different base in this workspace. ' +
    'Call list_bases first to get the target base_id. ' +
    'Supports: {{PROXIABLE_TOOLS}}. ' +
    'Write operations are blocked — ask the user to navigate to the base first.',
  descriptionVars: (tools) => ({
    PROXIABLE_TOOLS: tools
      .filter((t) => t.scope === 'base' && t.readonly)
      .map((t) => t.name)
      .join(', '),
  }),
  parameters: {
    base_id: z
      .string()
      .describe('The ID of the target base (from list_bases).'),
    tool_name: z
      .string()
      .describe(
        'The read-only tool to execute on the target base ' +
          '(e.g. "query_records", "describe_table", "count_records").',
      ),
    tool_args: z
      .record(z.string(), z.any())
      .describe(
        'Arguments for the tool — same as you would pass when calling it directly.',
      ),
  },
  scope: 'workspace',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  async execute() {
    // Never called directly — intercepted by executeTool in ChatToolRegistry.
    throw new Error('base_proxy must be executed through the registry');
  },
};

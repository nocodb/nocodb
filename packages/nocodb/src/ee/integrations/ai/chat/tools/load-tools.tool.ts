import { z } from 'zod';
import { EXTENDED_CATEGORIES } from './extended-categories';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from './chat-tool-registry';

/**
 * Meta-tool that loads extended tool categories on demand.
 *
 * When called, the execute function returns the category marker.
 * The actual tool-set mutation and tool name resolution is handled
 * by the chat service's onStepFinish callback — it detects this
 * tool name in the step results and refreshes the Vercel tools
 * object in-place so the LLM's next step has access to the new tools.
 */
export const loadToolsTool: ChatToolDefinition = {
  name: 'load_tools',
  description:
    'Load additional tool categories to expand your capabilities. ' +
    'Not all tools are available by default — some are grouped into categories ' +
    'that must be loaded first. Call this with a category name to make those tools available.\n\n' +
    'Available categories:\n' +
    Object.entries(EXTENDED_CATEGORIES)
      .map(([cat, desc]) => `- "${cat}": ${desc}`)
      .join('\n') +
    '\n\nAfter loading, the tools become available immediately for subsequent actions in this conversation.',
  parameters: {
    category: z
      .string()
      .describe(
        'The category to load. Available: ' +
          Object.keys(EXTENDED_CATEGORIES).join(', ') +
          '.',
      ),
  },
  scope: 'common',
  requiredRole: null,
  isDangerous: false,
  readonly: true,
  async execute(
    _context: NcContext,
    args: { category: string },
    _req: NcRequest,
  ) {
    const category = args.category;

    if (!EXTENDED_CATEGORIES[category]) {
      return {
        error: `Unknown category "${category}". Available: ${Object.keys(
          EXTENDED_CATEGORIES,
        ).join(', ')}`,
      };
    }

    // Return a marker — the chat service's onStepFinish detects
    // __load_category and handles tool mutation + message injection.
    return {
      __load_category: category,
      message: `Category "${category}" is now loading.`,
    };
  },
};

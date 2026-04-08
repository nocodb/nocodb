import { z } from 'zod';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';

/**
 * Announce tool — lets the LLM update the live progress status shown to the
 * user. Call this as the FIRST action before doing any real work. The message
 * is broadcast immediately and replaces the fixed per-agent label.
 *
 * Visibility is 'hidden' — it never appears in the ThinkingSection timeline.
 */
export const announceTool = defineChatTool({
  name: ChatToolName.ANNOUNCE,
  description:
    'Update the progress indicator shown to the user. ' +
    'Call this as your very first action with a single sentence describing ' +
    'what you are about to do. Use present continuous tense, plain text only. ' +
    'Do NOT call this after work has started — only once, before you begin.',
  schema: z.object({
    message: z
      .string()
      .describe(
        'One-sentence status in present continuous tense, plain text. Max ~60 characters. ' +
          "Use the USER'S language (not always English). " +
          'Describe the ACTION, not the routing or internal plan. ' +
          'GOOD: "Creating table Projects", "Searching Orders", "Adding 5 fields to Tasks". ' +
          'BAD: "Routing to builder", "Analyzing schema changes and outlining a plan", ' +
          '"Creating a new department link field on Questions to reference Departments". ' +
          'Keep it short and user-facing — no technical jargon (field types, IDs, internal details).',
      ),
  }),
  scope: 'common',
  requiredRole: null,
  isDangerous: false,
  readonly: true,
  visibility: 'hidden',
  category: 'interaction',
  async execute(_context, args, _req) {
    return { announced: args.message };
  },
});

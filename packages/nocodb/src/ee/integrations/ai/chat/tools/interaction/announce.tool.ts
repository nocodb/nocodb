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
        'One-sentence status in present continuous tense, plain text. ' +
          'Examples: "Searching Orders where Status is Active", ' +
          '"Creating table Projects with 5 fields", ' +
          '"Updating 3 records in Tasks".',
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

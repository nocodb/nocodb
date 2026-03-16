import { z } from 'zod';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';

export const askUserTool = defineChatTool({
  name: ChatToolName.ASK_USER,
  description: `Ask the user one or more questions with predefined options. Use when the request is  ambiguous or when the user needs to choose between approaches. You can ask up to 4 questions at once — each with its own options. The user can also type a custom answer or skip.`,
  schema: z.object({
    questions: z
      .array(
        z.object({
          question: z.string().describe('The question to display'),
          options: z
            .array(z.string())
            .min(2)
            .max(5)
            .describe('2–5 short option labels'),
        }),
      )
      .min(1)
      .max(4)
      .describe(
        'Array of 1–4 questions, each with its own options. Use multiple questions to gather several decisions at once.',
      ),
  }),
  scope: 'common',
  requiredRole: null,
  isDangerous: false,
  readonly: true,
  uiOnly: true,
  visibility: 'ui',
  category: 'interaction',
  async execute(_context, args, _req) {
    return {
      __requires_user_input: true,
      questions: args.questions,
    };
  },
});

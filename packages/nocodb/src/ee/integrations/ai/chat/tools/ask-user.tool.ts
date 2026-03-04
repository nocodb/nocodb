import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from './chat-tool-registry';

export const askUserTool: ChatToolDefinition = {
  name: 'ask_user',
  description:
    'Ask the user one or more questions with predefined options. Use when the request is ' +
    'ambiguous or when the user needs to choose between approaches. You can ask up to 4 ' +
    'questions at once — each with its own options. The user can also type a custom answer or skip.',
  parameters: {
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
        'Array of 1–4 questions, each with its own options. ' +
          'Use multiple questions to gather several decisions at once.',
      ),
  },
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  async execute(
    _context: NcContext,
    args: { questions: { question: string; options: string[] }[] },
    _req: NcRequest,
  ) {
    return {
      __requires_user_input: true,
      questions: args.questions,
    };
  },
};

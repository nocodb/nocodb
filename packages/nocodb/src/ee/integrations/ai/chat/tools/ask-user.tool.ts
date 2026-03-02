import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from './chat-tool-registry';

export const askUserTool: ChatToolDefinition = {
  name: 'ask_user',
  description:
    'Ask the user a question with predefined options. Use when the user\'s request is ' +
    'ambiguous or when they need to choose between approaches. Provide 2–5 short option labels. ' +
    'The user can also type a custom answer or skip entirely.',
  parameters: {
    question: z.string().describe('The question to display to the user'),
    options: z
      .array(z.string())
      .min(2)
      .max(5)
      .describe('2–5 short option labels for the user to choose from'),
  },
  permission: 'tableList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  async execute(_context: NcContext, args: { question: string; options: string[] }, _req: NcRequest) {
    return { __requires_user_input: true, question: args.question, options: args.options };
  },
};

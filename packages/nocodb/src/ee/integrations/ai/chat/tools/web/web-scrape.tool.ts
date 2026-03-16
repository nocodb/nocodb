import { z } from 'zod';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import { exaClient } from '~/integrations/ai/chat/tools/web/exa-client';

export const webScrapeTool = defineChatTool({
  name: ChatToolName.WEB_SCRAPE,
  description:
    'Fetch and read the content of a specific webpage URL. Returns clean text. ' +
    'Use this when the user provides a URL and wants to read, summarize, or extract data from it. ' +
    'Also useful for fetching documentation pages, articles, or any public web content.',
  schema: z.object({
    url: z.string().describe('The URL of the webpage to read.'),
  }),
  permission: undefined,
  scope: 'common',
  requiredRole: null,
  isDangerous: false,
  readonly: true,
  visibility: 'data',
  category: 'web',
  async execute(_context, args, _req) {
    const client = exaClient();
    if (!client) {
      return { error: 'Web scrape is not configured. EXA_API_KEY is missing.' };
    }

    const result = await client.getContents([args.url], {
      text: { maxCharacters: 10000 },
    });

    if (!result.results?.length) {
      return { error: 'Could not retrieve content from the URL.' };
    }

    const page = result.results[0];
    return {
      title: page.title || 'Untitled',
      url: page.url,
      favicon: page.favicon || null,
      text: page.text || '',
    };
  },
  async buildMeta(_context, _args, result) {
    if (!result?.url) return undefined;
    return {
      webResults: [
        {
          title: result.title,
          url: result.url,
          favicon: result.favicon || null,
        },
      ],
    };
  },
});

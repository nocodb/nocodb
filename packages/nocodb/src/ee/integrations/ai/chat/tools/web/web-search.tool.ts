import { z } from 'zod';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import { exaClient } from '~/integrations/ai/chat/tools/web/exa-client';

export const webSearchTool = defineChatTool({
  name: ChatToolName.WEB_SEARCH,
  description:
    'Search the web using Exa AI. Returns search results with page content. ' +
    'Use this when the user asks a question that requires up-to-date information from the internet, ' +
    'or when you need to look up facts, documentation, or current events that are not in the base.',
  schema: z.object({
    query: z.string().describe('The search query.'),
    num_results: z
      .number()
      .optional()
      .describe('Number of results to return. Defaults to 5, max 10.'),
    category: z
      .enum([
        'company',
        'research paper',
        'news',
        'pdf',
        'github',
        'personal site',
        'people',
        'financial report',
      ])
      .optional()
      .describe('Optional category to focus the search.'),
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
      return { error: 'Web search is not configured. EXA_API_KEY is missing.' };
    }

    const results = await client.searchAndContents(args.query, {
      type: 'auto',
      numResults: Math.min(args.num_results || 5, 10),
      text: { maxCharacters: 6000 },
      ...(args.category ? { category: args.category as any } : {}),
    });

    if (!results.results?.length) {
      return { results: [] };
    }

    return {
      results: results.results.map((r, i) => ({
        index: i + 1,
        title: r.title || 'Untitled',
        url: r.url,
        publishedDate: r.publishedDate || null,
        favicon: r.favicon || null,
        text: r.text || '',
      })),
    };
  },
  async buildMeta(_context, _args, result) {
    if (!result?.results?.length) return undefined;
    return {
      webResults: result.results.map(
        (r: {
          title: string;
          url: string;
          publishedDate?: string;
          favicon?: string;
        }) => ({
          title: r.title,
          url: r.url,
          publishedDate: r.publishedDate || null,
          favicon: r.favicon || null,
        }),
      ),
    };
  },
});

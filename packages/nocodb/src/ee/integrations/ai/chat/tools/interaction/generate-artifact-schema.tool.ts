import { z } from 'zod';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';

/**
 * V3 column types the LLM may use when defining artifact schemas.
 * Kept to types that make sense for generated/virtual data.
 */
const V3_ARTIFACT_TYPES = [
  'SingleLineText',
  'LongText',
  'Number',
  'Decimal',
  'Currency',
  'Percent',
  'Date',
  'DateTime',
  'Year',
  'SingleSelect',
  'MultiSelect',
  'Checkbox',
  'URL',
  'Email',
  'PhoneNumber',
  'Rating',
] as const;

export const generateArtifactSchemaTool = defineChatTool({
  name: ChatToolName.GENERATE_ARTIFACT_SCHEMA,
  description: `Define the column schema for an <nc-data> table before outputting it. \
Uses NocoDB V3 field types so the rendered table displays proper formatting (currency, dates, selects with colors) \
and can be saved to the base directly.`,
  schema: z.object({
    title: z.string().describe('Table name for the dataset'),
    description: z
      .string()
      .optional()
      .describe('Brief description of what data will be shown'),
    columns: z
      .array(
        z.object({
          title: z.string().describe('Column header name'),
          type: z
            .enum(V3_ARTIFACT_TYPES)
            .describe('NocoDB V3 field type'),
          options: z
            .record(z.any())
            .optional()
            .describe(
              'Type-specific options. Currency: {locale,code}. Select: {choices:[{title,color}]}. Date: {date_format}. Percent: {show_as_progress}.',
            ),
        }),
      )
      .describe('Column definitions in NocoDB V3 format'),
  }),
  scope: 'common',
  requiredRole: null,
  isDangerous: false,
  readonly: true,
  visibility: 'hidden',
  category: 'interaction',
  async execute(_context, args, _req) {
    return {
      type: 'artifact_schema',
      title: args.title,
      description: args.description,
      columns: args.columns,
    };
  },
});

import { z } from 'zod';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import {
  DateFormatValues,
  TimeFormatValues,
} from '~/integrations/ai/chat/tools/schema/field-options.schema';

const choicesOption = z.object({
  choices: z.array(
    z.object({
      title: z.string().describe('Choice label.'),
      color: z.string().optional().describe('Hex color (e.g. "#36BFFF").'),
    }),
  ),
});

const validationOption = z.object({
  validation: z.boolean().optional().describe('Enable validation.'),
});

const artifactColumnSchema = z.discriminatedUnion('type', [
  z.object({
    title: z.string().describe('Column header name'),
    type: z.literal('SingleLineText'),
  }),
  z.object({
    title: z.string().describe('Column header name'),
    type: z.literal('Year'),
  }),
  z.object({
    title: z.string().describe('Column header name'),
    type: z.literal('LongText'),
    options: z
      .object({
        rich_text: z
          .boolean()
          .optional()
          .describe('Enable rich text formatting.'),
      })
      .optional(),
  }),
  z.object({
    title: z.string().describe('Column header name'),
    type: z.literal('Number'),
    options: z
      .object({
        locale_string: z
          .boolean()
          .optional()
          .describe('Show thousand separator.'),
      })
      .optional(),
  }),
  z.object({
    title: z.string().describe('Column header name'),
    type: z.literal('Decimal'),
    options: z
      .object({
        precision: z
          .number()
          .int()
          .min(0)
          .max(5)
          .optional()
          .describe('Decimal places (0–5).'),
      })
      .optional(),
  }),
  z.object({
    title: z.string().describe('Column header name'),
    type: z.literal('Currency'),
    options: z
      .object({
        code: z
          .string()
          .optional()
          .describe('ISO 4217 code (e.g. "USD", "EUR").'),
        locale: z.string().optional().describe('BCP 47 locale (e.g. "en-US").'),
      })
      .optional(),
  }),
  z.object({
    title: z.string().describe('Column header name'),
    type: z.literal('Percent'),
    options: z
      .object({
        show_as_progress: z
          .boolean()
          .optional()
          .describe('Render as progress bar.'),
      })
      .optional(),
  }),
  z.object({
    title: z.string().describe('Column header name'),
    type: z.literal('Date'),
    options: z
      .object({
        date_format: z.enum(DateFormatValues).optional(),
      })
      .optional(),
  }),
  z.object({
    title: z.string().describe('Column header name'),
    type: z.literal('DateTime'),
    options: z
      .object({
        date_format: z.enum(DateFormatValues).optional(),
        time_format: z.enum(TimeFormatValues).optional(),
        '12hr_format': z.boolean().optional().describe('Use 12-hour format.'),
      })
      .optional(),
  }),
  z.object({
    title: z.string().describe('Column header name'),
    type: z.literal('SingleSelect'),
    options: choicesOption.optional(),
  }),
  z.object({
    title: z.string().describe('Column header name'),
    type: z.literal('MultiSelect'),
    options: choicesOption.optional(),
  }),
  z.object({
    title: z.string().describe('Column header name'),
    type: z.literal('Checkbox'),
    options: z
      .object({
        icon: z
          .enum([
            'square',
            'circle-check',
            'circle-filled',
            'star',
            'heart',
            'thumbs-up',
            'flag',
          ])
          .optional(),
        color: z.string().optional().describe('Hex color (e.g. "#fcb401").'),
      })
      .optional(),
  }),
  z.object({
    title: z.string().describe('Column header name'),
    type: z.literal('Rating'),
    options: z
      .object({
        icon: z
          .enum(['star', 'heart', 'circle-filled', 'thumbs-up', 'flag'])
          .optional(),
        color: z.string().optional().describe('Hex color (e.g. "#fcb401").'),
        max_value: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .describe('Maximum value (1–10).'),
      })
      .optional(),
  }),

  // ── Contact / validation ──
  z.object({
    title: z.string().describe('Column header name'),
    type: z.literal('URL'),
    options: validationOption.optional(),
  }),
  z.object({
    title: z.string().describe('Column header name'),
    type: z.literal('Email'),
    options: validationOption.optional(),
  }),
  z.object({
    title: z.string().describe('Column header name'),
    type: z.literal('PhoneNumber'),
    options: validationOption.optional(),
  }),
]);

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
    columns: z.array(artifactColumnSchema).describe('Column definitions'),
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

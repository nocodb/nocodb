import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import type { TableFieldBaseCreateV3Type } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import {
  DateFormatValues,
  DurationFormatValues,
  TimeFormatValues,
} from '~/integrations/ai/chat/tools/schema/field-options.schema';
import { TablesV3Service } from '~/services/v3/tables-v3.service';
import Noco from '~/Noco';

const fieldBase = {
  title: z.string().describe('Display name of the field.'),
  description: z.string().optional().describe('Optional field description.'),
  default_value: z
    .union([z.string(), z.boolean(), z.number()])
    .optional()
    .describe('Default value for the field.'),
};

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

const createTableFieldSchema = z.discriminatedUnion('type', [
  z.object({ ...fieldBase, type: z.literal('SingleLineText') }),
  z.object({ ...fieldBase, type: z.literal('Year') }),
  z.object({ ...fieldBase, type: z.literal('Attachment') }),
  z.object({ ...fieldBase, type: z.literal('JSON') }),
  z.object({
    ...fieldBase,
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
    ...fieldBase,
    type: z.literal('PhoneNumber'),
    options: validationOption.optional(),
  }),
  z.object({
    ...fieldBase,
    type: z.literal('URL'),
    options: validationOption.optional(),
  }),
  z.object({
    ...fieldBase,
    type: z.literal('Email'),
    options: validationOption.optional(),
  }),
  z.object({
    ...fieldBase,
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
    ...fieldBase,
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
    ...fieldBase,
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
    ...fieldBase,
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
    ...fieldBase,
    type: z.literal('Duration'),
    options: z
      .object({
        duration_format: z.enum(DurationFormatValues).optional(),
      })
      .optional(),
  }),
  z.object({
    ...fieldBase,
    type: z.literal('Date'),
    options: z
      .object({
        date_format: z.enum(DateFormatValues).optional(),
      })
      .optional(),
  }),
  z.object({
    ...fieldBase,
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
    ...fieldBase,
    type: z.literal('Time'),
    options: z
      .object({
        '12hr_format': z.boolean().optional().describe('Use 12-hour format.'),
      })
      .optional(),
  }),
  z.object({
    ...fieldBase,
    type: z.literal('SingleSelect'),
    options: choicesOption.optional(),
  }),
  z.object({
    ...fieldBase,
    type: z.literal('MultiSelect'),
    options: choicesOption.optional(),
  }),
  z.object({
    ...fieldBase,
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
  z.object({
    ...fieldBase,
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
    ...fieldBase,
    type: z.literal('User'),
    options: z
      .object({
        allow_multiple_users: z
          .boolean()
          .optional()
          .describe('Allow selecting multiple users.'),
      })
      .optional(),
  }),
]);

export const createTableTool = defineChatTool({
  name: ChatToolName.CREATE_TABLE,
  description:
    'Create a new table in the base with optional initial fields. ' +
    'An auto-increment ID primary key is always added automatically — do NOT include it. ' +
    'Only basic field types are supported during creation (text, number, date, select, etc.). ' +
    'Links, Lookup, Rollup, Formula, Barcode, QrCode, and Button fields must be added after via add_field. ' +
    'If fields are omitted, only the ID column is created — use add_field to add more later.',
  schema: z.object({
    title: z
      .string()
      .describe(
        'Display name of the new table. Must be unique within the base.',
      ),
    description: z
      .string()
      .optional()
      .describe('Optional description of the table.'),
    fields: z
      .array(createTableFieldSchema)
      .optional()
      .describe(
        'Optional list of fields to create with the table. Do NOT include an ID field. ' +
          'Link fields are not supported here — use add_field after table creation.',
      ),
  }),
  permission: 'tableCreate',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: false,
  visibility: 'action',
  category: 'schema',
  async execute(context, args, req) {
    const tablesV3Service: TablesV3Service = Noco.nestApp.get(TablesV3Service);

    const fields = (args.fields || [])
      .map((f) => {
        if (!f.title) return;
        const field: Record<string, any> = {
          title: f.title,
          type: f.type as TableFieldBaseCreateV3Type['type'],
        };
        if (f.description) field.description = f.description;
        if ('options' in f && f.options) field.options = f.options;
        if (f.default_value !== undefined)
          field.default_value = f.default_value;
        return field;
      })
      .filter(Boolean);

    const table = await tablesV3Service.tableCreate(context, {
      baseId: context.base_id,
      table: {
        title: args.title,
        ...(args.description ? { description: args.description } : {}),
        fields: fields as any,
      },
      user: req.user,
      req,
    });

    return {
      id: table.id,
      title: table.title,
      message: `Table "${table.title}" created successfully.`,
    };
  },
});

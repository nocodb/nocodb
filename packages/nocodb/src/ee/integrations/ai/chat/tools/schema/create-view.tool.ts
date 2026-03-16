import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import {
  resolveColumnByName,
  resolveTableByName,
} from '~/integrations/ai/chat/tools/helpers';
import { ViewsV3Service } from '~/services/v3/views-v3.service';
import Noco from '~/Noco';

export const createViewTool = defineChatTool({
  name: ChatToolName.CREATE_VIEW,
  description:
    'Create a new view for a table. Views are independent configurations of the same data — ' +
    'each has its own filters, sorts, field visibility, and group-by settings. ' +
    'After creating, configure with add_filter, add_sort, set_group_by, or update_view_fields. ' +
    'New views inherit all fields as visible — use update_view_fields to hide fields. ' +
    'Kanban requires a SingleSelect field for stack_by. Calendar requires at least one Date/DateTime field for date_ranges.',
  schema: z.object({
    table_name: z
      .string()
      .describe('The title of the table to add a view to (case-insensitive).'),
    title: z
      .string()
      .describe(
        'Display name for the new view. Must be unique within the table.',
      ),
    type: z
      .enum(['grid', 'gallery', 'kanban', 'calendar', 'form'])
      .describe(
        'View type: "grid" (spreadsheet — most common), "gallery" (card layout), ' +
          '"kanban" (grouped columns, requires a SingleSelect field), ' +
          '"calendar" (date-based, requires a Date/DateTime field), ' +
          '"form" (data entry form).',
      ),
    description: z
      .string()
      .optional()
      .describe('Optional description of the view.'),
    lock_type: z
      .enum(['collaborative', 'locked', 'personal'])
      .optional()
      .describe(
        'Lock type: "collaborative" (default — all editors can modify), ' +
          '"locked" (only creator can modify view config), ' +
          '"personal" (only visible to creator).',
      ),
    options: z
      .record(z.any())
      .optional()
      .describe(
        'Type-specific view options. Structure depends on the view type:\n\n' +
          '• Kanban (REQUIRED): { "stack_by": { "field_name": "Status", "stack_order": ["Todo", "In Progress", "Done"] } }\n' +
          '  → field_name must be a SingleSelect field. stack_order is optional (defaults to option order).\n' +
          '  → field_name is resolved to field_id automatically.\n' +
          '  → Optionally: { "cover_field_name": "Photo" } — Attachment field for card cover images.\n\n' +
          '• Calendar (REQUIRED): { "date_ranges": [{ "start_date_field_name": "Start Date", "end_date_field_name": "End Date" }] }\n' +
          '  → start_date_field_name is required, end_date_field_name is optional (for single-day events).\n' +
          '  → field names are resolved to field_id automatically.\n\n' +
          '• Gallery (optional): { "cover_field_name": "Photo" }\n' +
          '  → Attachment field for card cover images. Defaults to first Attachment field.\n\n' +
          '• Grid (optional): { "row_height": "short" | "medium" | "tall" | "extra" }\n\n' +
          '• Form: no options needed.',
      ),
  }),
  permission: 'viewCreate',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: false,
  visibility: 'action',
  category: 'schema',
  async execute(context, args, req) {
    const viewsV3Service: ViewsV3Service = Noco.nestApp.get(ViewsV3Service);
    const model = await resolveTableByName(context, args.table_name);

    const body: Record<string, any> = {
      title: args.title,
      type: args.type,
    };
    if (args.description) body.description = args.description;
    if (args.lock_type) body.lock_type = args.lock_type;

    if (args.options) {
      const options = { ...args.options };

      // Resolve Kanban stack_by field_name → field_id
      if (args.type === 'kanban' && options.stack_by?.field_name) {
        const stackColumn = await resolveColumnByName(
          context,
          model,
          options.stack_by.field_name,
        );
        options.stack_by = {
          field_id: stackColumn.id,
          ...(options.stack_by.stack_order
            ? { stack_order: options.stack_by.stack_order }
            : {}),
        };
      }

      // Resolve Kanban/Gallery cover_field_name → cover_field_id
      if (options.cover_field_name) {
        const coverColumn = await resolveColumnByName(
          context,
          model,
          options.cover_field_name,
        );
        options.cover_field_id = coverColumn.id;
        delete options.cover_field_name;
      }

      // Resolve Calendar date_ranges field names → field IDs
      if (args.type === 'calendar' && options.date_ranges) {
        options.date_ranges = await Promise.all(
          options.date_ranges.map(async (range: any) => {
            const resolved: Record<string, any> = {};

            if (range.start_date_field_name) {
              const startCol = await resolveColumnByName(
                context,
                model,
                range.start_date_field_name,
              );
              resolved.start_date_field_id = startCol.id;
            } else if (range.start_date_field_id) {
              resolved.start_date_field_id = range.start_date_field_id;
            }

            if (range.end_date_field_name) {
              const endCol = await resolveColumnByName(
                context,
                model,
                range.end_date_field_name,
              );
              resolved.end_date_field_id = endCol.id;
            } else if (range.end_date_field_id) {
              resolved.end_date_field_id = range.end_date_field_id;
            }

            return resolved;
          }),
        );
      }

      body.options = options;
    }

    req.body = body;

    const view = await viewsV3Service.create(context, {
      tableId: model.id!,
      req,
    });

    return {
      id: view.id,
      title: view.title,
      type: args.type,
      message: `${args.type} view "${args.title}" created for table "${args.table_name}".`,
    };
  },
});

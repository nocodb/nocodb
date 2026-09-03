import { z } from 'zod';
import { runTool } from '~/mcp/tools/tool-helpers';
import type {
  FieldOptionAddItemV3Type,
  FieldOptionDeleteItemV3Type,
  FieldUpdateV3Type,
  FieldV3Type,
} from 'nocodb-sdk';
import type { McpToolRegisterCtx } from '~/mcp/tools/tool-helpers';
import type { ColumnsV3Service } from '~/services/v3/columns-v3.service';
import type { TablesV3Service } from '~/services/v3/tables-v3.service';

export function registerFieldTools(
  ctx: McpToolRegisterCtx & {
    service: ColumnsV3Service;
    tablesService: TablesV3Service;
  },
) {
  const { server, context, req, user, roles, service, tablesService } = ctx;

  // List fields — derived from the table schema (read-only, any access level).
  server.registerTool(
    'listFields',
    {
      title: 'List Fields',
      description: 'List all fields (columns) of a table',
      annotations: {
        title: 'List Fields',
        readOnlyHint: true,
        idempotentHint: true,
      },
      inputSchema: { tableId: z.string().describe('Table ID') },
    },
    async ({ tableId }) =>
      runTool(async () => {
        const table = await tablesService.getTableWithAccessibleViews(context, {
          tableId,
          user,
        });
        return { list: (table as { fields?: unknown[] })?.fields ?? [] };
      }),
  );

  server.registerTool(
    'getField',
    {
      title: 'Get Field',
      description: 'Get a single field (column) by ID',
      annotations: {
        title: 'Get Field',
        readOnlyHint: true,
        idempotentHint: true,
      },
      inputSchema: { fieldId: z.string().describe('Field/column ID') },
    },
    async ({ fieldId }) =>
      runTool(() => service.columnGet(context, { columnId: fieldId })),
  );

  if (!roles.isCreatorPlus) return;

  server.registerTool(
    'createField',
    {
      title: 'Create Field',
      description: 'Add a new field (column) to a table',
      annotations: { title: 'Create Field', readOnlyHint: false },
      inputSchema: {
        tableId: z.string().describe('Table ID'),
        field: z
          .custom<FieldV3Type>()
          .describe('Field definition (title, type and type-specific options)'),
      },
    },
    async ({ tableId, field }) =>
      runTool(() =>
        service.columnAdd(context, { tableId, column: field, req, user }),
      ),
  );

  server.registerTool(
    'updateField',
    {
      title: 'Update Field',
      description: 'Update an existing field (column)',
      annotations: { title: 'Update Field', readOnlyHint: false },
      inputSchema: {
        fieldId: z.string().describe('Field/column ID'),
        field: z
          .custom<FieldUpdateV3Type>()
          .describe('Field properties to update'),
      },
    },
    async ({ fieldId, field }) =>
      runTool(() =>
        service.columnUpdate(context, {
          columnId: fieldId,
          column: field,
          req,
          user,
        }),
      ),
  );

  server.registerTool(
    'deleteField',
    {
      title: 'Delete Field',
      description: 'Delete a field (column) from a table',
      annotations: {
        title: 'Delete Field',
        readOnlyHint: false,
        destructiveHint: true,
      },
      inputSchema: { fieldId: z.string().describe('Field/column ID') },
    },
    async ({ fieldId }) =>
      runTool(() => service.columnDelete(context, { columnId: fieldId, req })),
  );

  server.registerTool(
    'addFieldOptions',
    {
      title: 'Add Field Options',
      description:
        'Add select options (choices) to a single/multi select field',
      annotations: { title: 'Add Field Options', readOnlyHint: false },
      inputSchema: {
        fieldId: z.string().describe('Field/column ID'),
        choices: z
          .array(z.custom<FieldOptionAddItemV3Type>())
          .describe('Choices to add, e.g. [{ "title": "Open" }]'),
      },
    },
    async ({ fieldId, choices }) =>
      runTool(() =>
        service.columnOptionsAdd(context, {
          columnId: fieldId,
          choices,
          req,
          user,
        }),
      ),
  );

  server.registerTool(
    'removeFieldOptions',
    {
      title: 'Remove Field Options',
      description:
        'Remove select options (choices) from a single/multi select field',
      annotations: {
        title: 'Remove Field Options',
        readOnlyHint: false,
        destructiveHint: true,
      },
      inputSchema: {
        fieldId: z.string().describe('Field/column ID'),
        choices: z
          .array(z.custom<FieldOptionDeleteItemV3Type>())
          .describe('Choices to remove (by id or title)'),
      },
    },
    async ({ fieldId, choices }) =>
      runTool(() =>
        service.columnOptionsDelete(context, {
          columnId: fieldId,
          choices,
          req,
          user,
        }),
      ),
  );
}

import { z } from 'zod';
import { runTool } from '~/mcp/tools/tool-helpers';
import type { McpToolRegisterCtx } from '~/mcp/tools/tool-helpers';
import type { TablesV3Service } from '~/services/v3/tables-v3.service';

export function registerTableTools(
  ctx: McpToolRegisterCtx & { service: TablesV3Service },
) {
  const { server, context, req, user, roles, service } = ctx;

  if (roles.isCreatorPlus) {
    server.registerTool(
      'createTable',
      {
        title: 'Create Table',
        description: 'Create a new table in the current base',
        annotations: { title: 'Create Table', readOnlyHint: false },
        inputSchema: {
          title: z.string().describe('Table title'),
          description: z.string().optional().describe('Table description'),
          fields: z
            .array(z.record(z.string(), z.any()))
            .optional()
            .describe('Field definitions to create with the table'),
          source_id: z
            .string()
            .optional()
            .describe('Optional data source ID for external sources'),
        },
      },
      async ({ title, description, fields, source_id }) =>
        runTool(() =>
          service.tableCreate(context, {
            baseId: context.base_id,
            sourceId: source_id,
            table: { title, description, fields } as any,
            user,
            req,
          }),
        ),
    );

    server.registerTool(
      'updateTable',
      {
        title: 'Update Table',
        description: 'Update an existing table',
        annotations: { title: 'Update Table', readOnlyHint: false },
        inputSchema: {
          tableId: z.string().describe('Table ID'),
          title: z.string().optional().describe('New table title'),
          description: z.string().optional().describe('New table description'),
          meta: z
            .record(z.string(), z.any())
            .optional()
            .describe('Table meta configuration'),
        },
      },
      async ({ tableId, title, description, meta }) =>
        runTool(() =>
          service.tableUpdate(context, {
            tableId,
            table: { title, description, meta } as any,
            baseId: context.base_id,
            user,
            req,
          }),
        ),
    );

    server.registerTool(
      'deleteTable',
      {
        title: 'Delete Table',
        description: 'Delete a table from the current base',
        annotations: {
          title: 'Delete Table',
          readOnlyHint: false,
          destructiveHint: true,
        },
        inputSchema: {
          tableId: z.string().describe('Table ID'),
        },
      },
      async ({ tableId }) =>
        runTool(() => service.tableDelete(context, { tableId, req })),
    );
  }
}

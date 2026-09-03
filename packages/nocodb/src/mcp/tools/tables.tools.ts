import { z } from 'zod';
import type {
  TableCreateFieldV3Type,
  TableCreateV3Type,
  TableMetaV3Type,
  TableUpdateV3Type,
} from 'nocodb-sdk';
import type { McpToolRegisterCtx } from '~/mcp/tools/tool-helpers';
import type { TablesV3Service } from '~/services/v3/tables-v3.service';
import {
  hasNoDeprecatedLinksType,
  REJECT_DEPRECATED_LINKS_MESSAGE,
  runTool,
} from '~/mcp/tools/tool-helpers';

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
            .array(z.custom<TableCreateFieldV3Type>())
            .optional()
            .refine(hasNoDeprecatedLinksType, {
              message: REJECT_DEPRECATED_LINKS_MESSAGE,
            })
            .describe(
              'Field definitions to create with the table. For relation fields, use type "LinkToAnotherRecord" — the deprecated "Links" type is rejected.',
            ),
          source_id: z
            .string()
            .optional()
            .describe('Optional data source ID for external sources'),
        },
      },
      async ({ title, description, fields, source_id }) => {
        const table: TableCreateV3Type = { title, description, fields };
        return runTool(() =>
          service.tableCreate(context, {
            baseId: context.base_id,
            sourceId: source_id,
            table,
            user,
            req,
          }),
        );
      },
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
            .custom<TableMetaV3Type>()
            .optional()
            .describe('Table meta configuration'),
        },
      },
      async ({ tableId, title, description, meta }) => {
        // Only forward keys the caller actually supplied — sending explicit
        // `undefined`s would otherwise blank out title/description on update.
        const table: TableUpdateV3Type = {
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(meta !== undefined ? { meta } : {}),
        };
        return runTool(() =>
          service.tableUpdate(context, {
            tableId,
            table,
            baseId: context.base_id,
            user,
            req,
          }),
        );
      },
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

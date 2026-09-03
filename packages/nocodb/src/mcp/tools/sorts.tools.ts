import { z } from 'zod';
import { runTool } from '~/mcp/tools/tool-helpers';
import type { SortCreateV3Type, SortUpdateV3Type } from 'nocodb-sdk';
import type { McpToolRegisterCtx } from '~/mcp/tools/tool-helpers';
import type { SortsV3Service } from '~/services/v3/sorts-v3.service';

export function registerSortTools(
  ctx: McpToolRegisterCtx & { service: SortsV3Service },
) {
  const { server, context, req, roles, service } = ctx;

  server.registerTool(
    'listSorts',
    {
      title: 'List Sorts',
      description: 'List sorts of a view',
      annotations: {
        title: 'List Sorts',
        readOnlyHint: true,
        idempotentHint: true,
      },
      inputSchema: { viewId: z.string().describe('View ID') },
    },
    async ({ viewId }) =>
      runTool(async () => ({
        list: await service.sortList(context, { viewId }),
      })),
  );

  if (!roles.isEditorPlus) return;

  server.registerTool(
    'addSort',
    {
      title: 'Add Sort',
      description: 'Add a sort to a view',
      annotations: { title: 'Add Sort', readOnlyHint: false },
      inputSchema: {
        viewId: z.string().describe('View ID'),
        field_id: z.string().describe('Field/column ID to sort by'),
        direction: z
          .enum(['asc', 'desc'])
          .optional()
          .describe('Sort direction (default: asc)'),
      },
    },
    async ({ viewId, field_id, direction }) => {
      const sort: SortCreateV3Type = { field_id, direction };
      return runTool(() => service.sortCreate(context, { sort, viewId, req }));
    },
  );

  server.registerTool(
    'updateSort',
    {
      title: 'Update Sort',
      description: 'Update an existing sort on a view',
      annotations: { title: 'Update Sort', readOnlyHint: false },
      inputSchema: {
        viewId: z.string().describe('View ID'),
        sortId: z.string().describe('Sort ID'),
        field_id: z.string().optional().describe('Field/column ID to sort by'),
        direction: z
          .enum(['asc', 'desc'])
          .optional()
          .describe('Sort direction'),
      },
    },
    async ({ viewId, sortId, field_id, direction }) => {
      const sort: SortUpdateV3Type = { id: sortId, field_id, direction };
      return runTool(() =>
        service.sortUpdate(context, { sortId, sort, req, viewId }),
      );
    },
  );

  server.registerTool(
    'deleteSort',
    {
      title: 'Delete Sort',
      description: 'Delete a sort from a view',
      annotations: {
        title: 'Delete Sort',
        readOnlyHint: false,
        destructiveHint: true,
      },
      inputSchema: {
        viewId: z.string().describe('View ID'),
        sortId: z.string().describe('Sort ID'),
      },
    },
    async ({ viewId, sortId }) =>
      runTool(async () => {
        await service.sortDelete(context, { viewId, sortId, req });
        return { success: true };
      }),
  );
}

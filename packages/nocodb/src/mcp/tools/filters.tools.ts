import { z } from 'zod';
import { runTool } from '~/mcp/tools/tool-helpers';
import type { FilterCreateV3Type, FilterUpdateV3Type } from 'nocodb-sdk';
import type { McpToolRegisterCtx } from '~/mcp/tools/tool-helpers';
import type { FiltersV3Service } from '~/services/v3/filters-v3.service';

const filterCreateSchema = z.custom<FilterCreateV3Type>();
const filterUpdateSchema = z.custom<FilterUpdateV3Type>();

const filterBodyDescription =
  'Filter definition. A filter group has the shape ' +
  '{ group_operator: "AND"|"OR", filters: [{ field_id, operator, value }, ...] } ' +
  'and groups may be nested inside `filters`.';

export function registerFilterTools(
  ctx: McpToolRegisterCtx & { service: FiltersV3Service },
) {
  const { server, context, req, user, roles, service } = ctx;

  server.registerTool(
    'listFilters',
    {
      title: 'List Filters',
      description: 'List filters of a view',
      annotations: {
        title: 'List Filters',
        readOnlyHint: true,
        idempotentHint: true,
      },
      inputSchema: { viewId: z.string().describe('View ID') },
    },
    async ({ viewId }) =>
      runTool(async () => ({
        list: await service.filterList(context, { viewId }),
      })),
  );

  if (!roles.isEditorPlus) return;

  server.registerTool(
    'createFilter',
    {
      title: 'Create Filter',
      description: 'Create a filter (or filter group) on a view',
      annotations: { title: 'Create Filter', readOnlyHint: false },
      inputSchema: {
        viewId: z.string().describe('View ID'),
        filter: filterCreateSchema.describe(filterBodyDescription),
      },
    },
    async ({ viewId, filter }) =>
      runTool(() =>
        service.filterCreate(context, { filter, viewId, user, req }),
      ),
  );

  server.registerTool(
    'updateFilter',
    {
      title: 'Update Filter',
      description: 'Update a single filter on a view',
      annotations: { title: 'Update Filter', readOnlyHint: false },
      inputSchema: {
        viewId: z.string().describe('View ID'),
        filter: filterUpdateSchema.describe(
          'Filter to update — must include its `id`',
        ),
      },
    },
    async ({ viewId, filter }) =>
      runTool(() =>
        service.filterUpdate(context, {
          filterId: filter.id,
          filter,
          user,
          viewId,
          req,
        }),
      ),
  );

  server.registerTool(
    'replaceFilters',
    {
      title: 'Replace Filters',
      description:
        'Replace the entire filter set of a view with the provided filter group',
      annotations: { title: 'Replace Filters', readOnlyHint: false },
      inputSchema: {
        viewId: z.string().describe('View ID'),
        filter: filterCreateSchema.describe(filterBodyDescription),
      },
    },
    async ({ viewId, filter }) =>
      runTool(() =>
        service.filterReplace(context, { filter, user, req, viewId }),
      ),
  );

  server.registerTool(
    'deleteFilter',
    {
      title: 'Delete Filter',
      description: 'Delete a filter from a view',
      annotations: {
        title: 'Delete Filter',
        readOnlyHint: false,
        destructiveHint: true,
      },
      inputSchema: {
        viewId: z.string().describe('View ID'),
        filterId: z.string().describe('Filter ID'),
      },
    },
    async ({ viewId, filterId }) =>
      runTool(() => service.filterDelete(context, { req, viewId, filterId })),
  );
}

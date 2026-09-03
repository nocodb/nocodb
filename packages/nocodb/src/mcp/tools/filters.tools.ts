import { z } from 'zod';
import { runTool } from '~/mcp/tools/tool-helpers';
import type { FilterCreateV3Type, FilterUpdateV3Type } from 'nocodb-sdk';
import type { McpToolRegisterCtx } from '~/mcp/tools/tool-helpers';
import type { FiltersV3Service } from '~/services/v3/filters-v3.service';

// A single leaf condition.
const filterLeafSchema = z.object({
  field_id: z.string().describe('Field/column ID this condition applies to'),
  operator: z.string().describe('Comparison operator (e.g. eq, gt, lt, like)'),
  sub_operator: z
    .string()
    .nullish()
    .describe('Secondary operator, when the operator requires one'),
  value: z
    .union([z.string(), z.number(), z.boolean(), z.null()])
    .optional()
    .describe('Value to compare against'),
  parent_id: z
    .string()
    .optional()
    .describe('Parent group ID; defaults to root'),
});

// A group of conditions. Nested groups are accepted as loose objects so the
// advertised JSON Schema stays finite; the service re-validates the full tree
// with ajv against `swagger-v3.json#/components/schemas/FilterCreate`.
const filterGroupSchema = z.object({
  group_operator: z
    .enum(['AND', 'OR'])
    .describe('Logical operator combining the group members'),
  filters: z
    .array(z.union([filterLeafSchema, z.record(z.string(), z.unknown())]))
    .describe('Leaf conditions and/or nested filter groups'),
  parent_id: z
    .string()
    .optional()
    .describe('Parent group ID; defaults to root'),
});

// Required filter body — either a single condition or a (nestable) group.
const filterCreateSchema = z.union([filterLeafSchema, filterGroupSchema]);
const filterUpdateSchema = z.intersection(
  z.object({ id: z.string().describe('Filter ID to update') }),
  filterCreateSchema,
);

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
        service.filterCreate(context, {
          filter: filter as FilterCreateV3Type,
          viewId,
          user,
          req,
        }),
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
          filter: filter as FilterUpdateV3Type,
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
        service.filterReplace(context, {
          filter: filter as FilterCreateV3Type,
          user,
          req,
          viewId,
        }),
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

import { Injectable } from '@nestjs/common';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { extractRolesObj, NcApiVersion } from 'nocodb-sdk';
import type { NcContext, NcRequest, UserType } from 'nocodb-sdk';
import type { Request, Response } from 'express';
import type { McpToolRegisterCtx } from '~/mcp/tools/tool-helpers';
import type {
  DataDeleteRequest,
  DataInsertRequest,
  DataUpdateRequest,
} from '~/services/v3/data-v3.types';
import { NcError } from '~/helpers/catchError';
import { resolveAttachmentFilePath } from '~/helpers/attachmentHelpers';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { MCP_DATA_PAYLOAD_LIMIT, V3_DATA_PAYLOAD_LIMIT } from '~/constants';
import { unitsForBulk } from '~/mcp/tools/tool-units';
import { BasesV3Service } from '~/services/v3/bases-v3.service';
import { TablesV3Service } from '~/services/v3/tables-v3.service';
import { DataV3Service } from '~/services/v3/data-v3.service';
import { DataTableService } from '~/services/data-table.service';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { serialize } from '~/helpers/serialize';
import { AuditsService } from '~/services/audits.service';
import { isEE } from '~/utils';
import {
  aggregationDescription,
  whereDescription,
  whereDescriptionRef,
} from '~/mcp/descriptions';
import {
  fieldsSchema,
  serializeSort,
  sortSchema,
  viewIdSchema,
} from '~/mcp/data-schemas';
import { strictRegistrar } from '~/mcp/tools/strict-schema';
import {
  callScopedRegistrar,
  scopeAuditFieldsPerCall,
} from '~/mcp/tools/call-scope';
import { defaultLimitConfig } from '~/helpers/extractLimitAndOffset';
import {
  getRoleFlags,
  resolveLinkField,
  runBaseTool,
} from '~/mcp/tools/tool-helpers';
import { baseIdInput, McpFixedBaseScope } from '~/mcp/tools/tool-scope';
import {
  filterInputDescription,
  filterInputSchema,
  resolveWhere,
} from '~/mcp/tools/filter-input';

@Injectable()
export class McpService {
  constructor(
    protected readonly baseV3Service: BasesV3Service,
    protected readonly tablesV3Service: TablesV3Service,
    protected readonly datasV3Service: DataV3Service,
    protected readonly dataTableService: DataTableService,
    protected readonly auditService: AuditsService,
  ) {}

  async handleRequest(
    tokenId: string,
    context: NcContext,
    req: NcRequest,
    res: Response,
  ) {
    // Before any tool registers: handlers close over `req`, and a JSON-RPC
    // batch runs them concurrently over that one object.
    scopeAuditFieldsPerCall(req);

    const server = await this.createServer({ context, user: req.user, req });

    return this.serve(server, req, res);
  }

  // CE lists every tool it has, so it advertises no discovery instructions —
  // EE overrides this to add them only when something actually deferred.
  protected async createServer(opts: {
    context: NcContext;
    user: UserType & {
      base_roles?: Record<string, boolean>;
      workspace_roles?: Record<string, boolean>;
    };
    req: NcRequest;
  }): Promise<McpServer> {
    const server = this.newServer();

    await this.registerTools({
      ...opts,
      server: strictRegistrar(callScopedRegistrar(server)),
    });

    return server;
  }

  protected newServer(instructions?: string) {
    return new McpServer(
      {
        name: `NocoDB MCP Server`,
        version: '1.0.0',
      },
      instructions ? { instructions } : undefined,
    );
  }

  protected async serve(server: McpServer, req: NcRequest, res: Response) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on('close', () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req as Request, res, req.body);
  }

  protected async registerTools({
    server,
    context,
    user,
    req,
  }: {
    context: NcContext;
    user: UserType & {
      base_roles?: Record<string, boolean>;
      workspace_roles?: Record<string, boolean>;
    };
    // EE passes the registry proxy here, which implements only registerTool.
    server: Pick<McpServer, 'registerTool'>;
    req: NcRequest;
  }) {
    this.registerCoreTools({
      server,
      context,
      user,
      req,
      roles: getRoleFlags(user),
      scope: new McpFixedBaseScope({ context, user, req }),
    });
  }

  /**
   * The base-addressed tools every edition offers. Written against
   * `ctx.scope`, so the same registration serves a session pinned to one base
   * and an account-wide session that names its base per call.
   */
  protected registerCoreTools(ctx: McpToolRegisterCtx) {
    const { server, roles } = ctx;
    const inBase = baseIdInput(ctx.scope);

    // Base Details
    server.registerTool(
      'getBaseInfo',
      {
        title: 'Get Base Info',
        description: 'Fetch information about current base',
        annotations: {
          title: 'Get Base Info',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
        inputSchema: { ...inBase },
      },
      async ({ baseId }) =>
        runBaseTool(
          ctx,
          { op: 'baseGet', scope: 'base' },
          { baseId },
          (target) =>
            this.baseV3Service.getProject(target.context, {
              baseId: target.context.base_id,
            }),
        ),
    );

    // List Tables
    server.registerTool(
      'getTablesList',
      {
        title: 'List Tables',
        annotations: {
          title: 'List Tables',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
        description:
          'List tables accessible by user. Returns {list: [tables...]}',
        inputSchema: { ...inBase },
      },
      async ({ baseId }) =>
        runBaseTool(
          ctx,
          { op: 'tableList', scope: 'base' },
          { baseId },
          async (target) => ({
            list: await this.tablesV3Service.getAccessibleTables(
              target.context,
              {
                baseId: target.context.base_id,
                roles: extractRolesObj(target.user?.base_roles),
                user: target.user,
                allSources: true,
              },
            ),
          }),
        ),
    );

    // Get Table Schema
    server.registerTool(
      'getTableSchema',
      {
        title: 'Get the table schema',
        description:
          'Get the table schema including fields and views information',
        inputSchema: {
          ...inBase,
          tableId: z.string().describe('Table Id'),
        },
        annotations: {
          title: 'Get the table schema',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async ({ baseId, tableId }) =>
        runBaseTool(
          ctx,
          { op: 'tableGet', scope: 'base' },
          { baseId, tableId },
          (target) =>
            this.tablesV3Service.getTableWithAccessibleViews(target.context, {
              tableId,
              user: target.user,
            }),
        ),
    );

    // Query Records
    server.registerTool(
      'queryRecords',
      {
        title: 'Query Records',
        description: 'Query Records from a Table',
        inputSchema: {
          ...inBase,
          tableId: z.string().describe('Table ID'),
          pageSize: z
            .number()
            .optional()
            .describe(
              'Number of records to fetch (default: 50). Capped at 200 here, ' +
                'and further by the deployment limit — the response reports ' +
                'the `page_size` actually applied.',
            ),
          page: z
            .number()
            .optional()
            .describe('Page number for pagination (default: 1)'),
          filter: filterInputSchema.optional().describe(filterInputDescription),
          where: z.string().optional().describe(whereDescription),
          sort: sortSchema.optional(),
          fields: fieldsSchema.optional(),
          viewId: viewIdSchema,
        },
        annotations: {
          title: 'Query Records',
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      async ({
        baseId,
        tableId,
        pageSize = 50,
        page = 1,
        filter,
        where,
        sort,
        fields,
        viewId,
      }) =>
        runBaseTool(
          ctx,
          { op: 'dataList', scope: 'base' },
          { baseId, tableId },
          async (target) => {
            const requestedPageSize = pageSize;
            const params: any = {
              pageSize: Math.max(1, Math.min(pageSize || 25, 200)),
              page,
            };
            const resolvedWhere = await resolveWhere(target.context, tableId, {
              where,
              filter,
            });
            if (resolvedWhere) params.where = resolvedWhere;
            if (sort) params.sort = serializeSort(sort);
            if (fields?.length) params.fields = fields;
            // Also in `query`, which is what the paged-response link builder
            // reads — otherwise `next`/`prev` come back without the view.
            if (viewId) params.viewId = viewId;

            const records = await this.datasV3Service.dataList(target.context, {
              baseId: target.context.base_id,
              modelId: tableId,
              viewId,
              query: params,
              req: target.req,
            });

            // The deployment clamps the limit again via NC_DB_QUERY_LIMIT_MAX
            // (1000 by default, 100 on shared/cloud), and `pageInfo` carries
            // only next/prev URLs — which echo the *requested* size. A caller
            // sizing its paging loop off the value it passed therefore skipped
            // rows silently. State the size that was actually applied.
            const effectivePageSize = Math.min(
              params.pageSize,
              defaultLimitConfig.limitMax,
            );

            return {
              ...records,
              page,
              page_size: effectivePageSize,
              ...(effectivePageSize < requestedPageSize
                ? {
                    page_size_note:
                      `pageSize ${requestedPageSize} was clamped to ` +
                      `${effectivePageSize} by this deployment. Page ` +
                      `offsets follow the clamped size.`,
                  }
                : {}),
            };
          },
        ),
    );

    // Get Record by ID tool
    server.registerTool(
      'getRecord',
      {
        title: 'Get Record',
        description:
          'Fetch a record by ID. Returns the same `{ id, fields }` shape as ' +
          'queryRecords, so a record can be passed back to updateRecords as-is.',
        inputSchema: {
          ...inBase,
          tableId: z.string().describe('Table ID'),
          recordId: z.string().describe('Record ID or primary key value'),
          fields: fieldsSchema.optional(),
          viewId: viewIdSchema,
        },
        annotations: {
          title: 'Get Record',
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      async ({ baseId, tableId, recordId, fields, viewId }) =>
        runBaseTool(
          ctx,
          { op: 'dataRead', scope: 'base' },
          { baseId, tableId },
          (target) =>
            this.datasV3Service.dataRead(target.context, {
              modelId: tableId,
              rowId: recordId,
              viewId,
              query: fields?.length ? { fields } : {},
              req: target.req,
            }),
        ),
    );

    server.registerTool(
      'countRecords',
      {
        title: 'Count Records',
        description: 'Count Records in a Table',
        inputSchema: {
          ...inBase,
          tableId: z.string().describe('Table ID'),
          filter: filterInputSchema.optional().describe(filterInputDescription),
          where: z.string().optional().describe(whereDescriptionRef),
          viewId: viewIdSchema,
        },
        annotations: {
          title: 'Count Records',
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      async ({ baseId, tableId, filter, where, viewId }) =>
        runBaseTool(
          ctx,
          { op: 'dataCount', scope: 'base' },
          { baseId, tableId },
          async (target) => {
            const resolvedWhere = await resolveWhere(target.context, tableId, {
              where,
              filter,
            });

            return this.dataTableService.dataCount(target.context, {
              baseId: target.context.base_id,
              modelId: tableId,
              viewId,
              query: resolvedWhere ? { where: resolvedWhere } : {},
              apiVersion: NcApiVersion.V3,
            });
          },
        ),
    );

    server.registerTool(
      'readAttachment',
      {
        title: 'Read Attachments',
        description:
          'Read the content of attachment objects returned by getRecord or queryRecords from an Attachment field',
        inputSchema: {
          ...inBase,
          files: z
            .array(
              z
                .object({
                  title: z.string().nullable().describe('Attachment title'),
                  mimeType: z
                    .string()
                    .nullable()
                    .describe('Attachment mime type'),
                  size: z.number().nullable().describe('Attachment size'),
                })
                .and(
                  z.union([
                    z.object({
                      url: z
                        .string()
                        .nullable()
                        .describe(
                          'Attachment URL. Required if `path` is not provided.',
                        ),
                      signedUrl: z
                        .string()
                        .nullable()
                        .describe(
                          'Attachment signed URL. Required if `path` is not provided.',
                        ),
                      path: z.null(),
                      signedPath: z.null(),
                    }),
                    z.object({
                      path: z
                        .string()
                        .nullable()
                        .describe(
                          'Attachment path. Required if `url` is not provided.',
                        ),
                      signedPath: z
                        .string()
                        .nullable()
                        .describe(
                          'Attachment signed Path. Required if `url` is not provided.',
                        ),
                      url: z.null(),
                      signedUrl: z.null(),
                    }),
                  ]),
                ),
            )
            .describe('Array of attachment objects from NocoDB'),
        },
        annotations: {
          title: 'Read Attachments',
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      async ({ baseId, files }) =>
        runBaseTool(
          ctx,
          { op: 'dataRead', scope: 'base' },
          { baseId },
          async (target) => {
            if (!files || files.length === 0) {
              NcError.badRequest('No attachments provided');
            }

            const storageAdapter = await NcPluginMgrv2.storageAdapter();

            const results = await Promise.all(
              files.map(async (file) => {
                try {
                  let relativePath;

                  // Determine the relative path from attachment
                  if (file.path || file.url) {
                    relativePath = resolveAttachmentFilePath(file);
                  } else {
                    return {
                      title: file.title || 'Unknown file',
                      error: 'No path or URL available for this attachment',
                    };
                  }

                  // Only allow paths recorded as an attachment in the
                  // caller's current base.
                  const fileUrlCandidates = [
                    file.path,
                    file.url,
                    file.path ? file.path.replace(/^download[/\\]/i, '') : null,
                  ].filter(Boolean) as string[];

                  const fileRef = await Noco.ncMeta
                    .knex(MetaTable.FILE_REFERENCES)
                    .where({
                      base_id: target.context.base_id,
                      deleted: false,
                    })
                    .whereIn('file_url', fileUrlCandidates)
                    .first();

                  if (!fileRef) {
                    return {
                      title: file.title || 'Unknown file',
                      error:
                        'Attachment is not accessible from this MCP context',
                    };
                  }

                  const stream = await storageAdapter.fileReadByStream(
                    relativePath,
                  );
                  if (!stream) {
                    return {
                      title: file.title || 'Unknown file',
                      error: 'Failed to read file stream',
                    };
                  }

                  const mimeType = file.mimeType || 'application/octet-stream';

                  const serialized = await serialize(
                    mimeType,
                    stream,
                    `Could not process file: ${file.title || 'Unknown file'}`,
                  );

                  const hasContent =
                    serialized.text &&
                    serialized.text !== '@file_not_supported';

                  return {
                    title: file.title || 'Unknown file',
                    mimeType,
                    size: file.size,
                    content: hasContent ? serialized.text : null,
                    images: serialized.images,
                    error: hasContent
                      ? null
                      : 'Could not extract text from this file type',
                  };
                } catch (error) {
                  return {
                    title: file.title || 'Unknown file',
                    error: `Error processing file: ${error.message}`,
                  };
                }
              }),
            );

            // Compile all content into one response
            const successfulResults = results.filter((r) => r.content);
            const failedResults = results.filter((r) => r.error);

            // Format content for the response
            let responseText = '';

            if (successfulResults.length > 0) {
              responseText += '## Successfully Processed Files\n\n';

              for (const result of successfulResults) {
                responseText += `### ${result.title}\n`;
                responseText += `**Type:** ${result.mimeType}\n`;
                responseText += `**Size:** ${formatFileSize(result.size)}\n\n`;
                responseText += `${result.content}\n\n`;

                if (result.images && result.images.length > 0) {
                  responseText += `*This file contains ${result.images.length} images that cannot be directly displayed in text format.*\n\n`;
                }
              }
            }

            if (failedResults.length > 0) {
              responseText += '## Files With Processing Issues\n\n';

              for (const result of failedResults) {
                responseText += `### ${result.title}\n`;
                responseText += `**Error:** ${result.error}\n\n`;
              }
            }

            return responseText.trim();
          },
        ),
    );

    if (!isEE) {
      server.registerTool(
        'aggregate_single',
        {
          title: 'Aggregate',
          description:
            'Perform aggregations on a table with a filter condition',
          annotations: {
            title: 'Aggregate',
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
          },
          inputSchema: {
            ...inBase,
            tableId: z.string().describe('Table ID'),
            aggregations: z
              .array(
                z.object({
                  field: z.string().describe('Field/column ID to aggregate'),
                  type: z
                    .enum([
                      // Numerical aggregations
                      'sum',
                      'min',
                      'max',
                      'avg',
                      'median',
                      'std_dev',
                      'range',
                      // Common aggregations
                      'count',
                      'count_empty',
                      'count_filled',
                      'count_unique',
                      'percent_empty',
                      'percent_filled',
                      'percent_unique',
                      // Boolean aggregations
                      'checked',
                      'unchecked',
                      'percent_checked',
                      'percent_unchecked',
                      // Date aggregations
                      'earliest_date',
                      'latest_date',
                      'date_range',
                      'month_range',
                      // None
                      'none',
                    ])
                    .describe(aggregationDescription),
                }),
              )
              .describe('Array of aggregations to perform'),
            filter: filterInputSchema
              .optional()
              .describe(filterInputDescription),
            where: z.string().optional().describe(whereDescriptionRef),
            viewId: viewIdSchema,
          },
        },
        async ({ baseId, aggregations, tableId, filter, where, viewId }) =>
          runBaseTool(
            ctx,
            { op: 'dataAggregate', scope: 'base' },
            { baseId, tableId },
            async (target) =>
              this.dataTableService.dataAggregate(target.context, {
                modelId: tableId,
                viewId: viewId,
                query: {
                  where: await resolveWhere(target.context, tableId, {
                    where,
                    filter,
                  }),
                  aggregation: JSON.stringify(aggregations),
                },
              }),
          ),
      );
    }

    if (!roles.isEditorPlus) return;

    // Create Records tool
    server.registerTool(
      'createRecords',
      {
        title: 'Create Records',
        description: `Create records in a table. Up to ${MCP_DATA_PAYLOAD_LIMIT} per call`,
        annotations: {
          title: 'Create Records',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
        inputSchema: {
          ...inBase,
          tableId: z.string().describe('Table ID'),
          records: z
            .array(
              z.object({
                fields: z.record(
                  z.string().describe('Field name/title'),
                  z.any().describe('Field value'),
                ),
              }),
            )
            .max(MCP_DATA_PAYLOAD_LIMIT)
            .describe(
              `Array of records with fields as key-value pairs. At most ${MCP_DATA_PAYLOAD_LIMIT} per call — a longer array is rejected outright, so split larger writes into batches.`,
            ),
        },
      },
      async ({ baseId, tableId, records }) =>
        runBaseTool(
          ctx,
          { op: 'dataInsert', scope: 'base' },
          {
            baseId,
            tableId,
            // MCP takes MCP_DATA_PAYLOAD_LIMIT per call; the public v3 route
            // takes V3_DATA_PAYLOAD_LIMIT, so this write is worth that many
            // REST requests.
            units: unitsForBulk(
              Array.isArray(records) ? records.length : 1,
              V3_DATA_PAYLOAD_LIMIT,
            ),
          },
          (target) =>
            this.datasV3Service.dataInsert(target.context, {
              modelId: tableId,
              baseId: target.context.base_id,
              body: (Array.isArray(records)
                ? records
                : [records]) as DataInsertRequest[],
              cookie: target.req,
              maxPayloadOverride: MCP_DATA_PAYLOAD_LIMIT,
            }),
        ),
    );

    // Update Records tool
    server.registerTool(
      'updateRecords',
      {
        title: 'Update Records',
        description:
          `Update records in a table. Up to ${MCP_DATA_PAYLOAD_LIMIT} per call. ` +
          'A link field is replaced, not appended to: pass the complete list of ' +
          'linked records you want, and `[]` to clear it. `null` is not a link ' +
          'value and is ignored. To add or remove individual links without ' +
          'restating the set, use linkRecords / unlinkRecords.',
        inputSchema: {
          ...inBase,
          tableId: z.string().describe('Table ID'),
          records: z
            .array(
              z.object({
                id: z.union([z.string(), z.number()]).describe('Record ID'),
                fields: z.record(
                  z.string().describe('Field name/title'),
                  z.any().describe('Field value'),
                ),
              }),
            )
            .max(MCP_DATA_PAYLOAD_LIMIT)
            .describe(
              `Array of records with ID and fields to update. At most ${MCP_DATA_PAYLOAD_LIMIT} per call — a longer array is rejected outright, so split larger writes into batches.`,
            ),
        },
        annotations: {
          title: 'Update Records',
          readOnlyHint: false,
          destructiveHint: true,
          openWorldHint: false,
        },
      },
      async ({ baseId, tableId, records }) =>
        runBaseTool(
          ctx,
          { op: 'dataUpdate', scope: 'base' },
          {
            baseId,
            tableId,
            // MCP takes MCP_DATA_PAYLOAD_LIMIT per call; the public v3 route
            // takes V3_DATA_PAYLOAD_LIMIT, so this write is worth that many
            // REST requests.
            units: unitsForBulk(
              Array.isArray(records) ? records.length : 1,
              V3_DATA_PAYLOAD_LIMIT,
            ),
          },
          (target) =>
            this.datasV3Service.dataUpdate(target.context, {
              modelId: tableId,
              baseId: target.context.base_id,
              body: (Array.isArray(records)
                ? records
                : [records]) as DataUpdateRequest[],
              cookie: target.req,
              maxPayloadOverride: MCP_DATA_PAYLOAD_LIMIT,
            }),
        ),
    );

    // Delete Records tool
    server.registerTool(
      'deleteRecords',
      {
        title: 'Delete Records',
        description: `Delete records in a table. Up to ${MCP_DATA_PAYLOAD_LIMIT} per call`,
        annotations: {
          title: 'Delete Records',
          readOnlyHint: false,
          destructiveHint: true,
          openWorldHint: false,
        },
        inputSchema: {
          ...inBase,
          tableId: z.string().describe('Table ID'),
          records: z
            .array(
              z.object({
                id: z.union([z.string(), z.number()]).describe('Record ID'),
              }),
            )
            .max(MCP_DATA_PAYLOAD_LIMIT)
            .describe(
              `Array of records with IDs to delete. At most ${MCP_DATA_PAYLOAD_LIMIT} per call — a longer array is rejected outright, so split larger writes into batches.`,
            ),
        },
      },
      async ({ baseId, tableId, records }) =>
        runBaseTool(
          ctx,
          { op: 'dataDelete', scope: 'base' },
          {
            baseId,
            tableId,
            // MCP takes MCP_DATA_PAYLOAD_LIMIT per call; the public v3 route
            // takes V3_DATA_PAYLOAD_LIMIT, so this write is worth that many
            // REST requests.
            units: unitsForBulk(
              Array.isArray(records) ? records.length : 1,
              V3_DATA_PAYLOAD_LIMIT,
            ),
          },
          (target) =>
            this.datasV3Service.dataDelete(target.context, {
              modelId: tableId,
              baseId: target.context.base_id,
              body: (Array.isArray(records)
                ? records
                : [records]) as DataDeleteRequest[],
              cookie: target.req,
              maxPayloadOverride: MCP_DATA_PAYLOAD_LIMIT,
            }),
        ),
    );

    // Link/unlink without restating the whole set (updateRecords replaces
    // it). Multi-parent so an import links N parents in one call instead of
    // one REST request per parent.
    //
    // One `nestedLink`/`nestedUnlink` per parent, with no transaction spanning
    // them — so report per entry instead of failing the batch on one bad row.
    // Matches the AI link_records tool: one bad pairing does not sink the rest.
    const runLinkOps = async (
      target: { context: NcContext; req: NcRequest },
      tableId: string,
      fieldId: string,
      records: { id: string | number; links: { id: string | number }[] }[],
      apply: (args: {
        columnId: string;
        rowId: string;
        refRowIds: { id: string | number }[];
        target: { context: NcContext; req: NcRequest };
      }) => Promise<unknown>,
    ) => {
      if (records.length > MCP_DATA_PAYLOAD_LIMIT) {
        NcError.get(target.context).maxPayloadLimitExceeded(
          MCP_DATA_PAYLOAD_LIMIT,
        );
      }
      const column = await resolveLinkField(target.context, tableId, fieldId);

      const results: Record<string, any>[] = [];
      let succeeded = 0;
      let failed = 0;

      for (let i = 0; i < records.length; i++) {
        const { id, links } = records[i];
        try {
          await apply({
            columnId: column.id,
            rowId: String(id),
            refRowIds: links,
            target,
          });
          succeeded++;
          results.push({
            index: i,
            id: String(id),
            links: links.length,
            ok: true,
          });
        } catch (e) {
          failed++;
          results.push({
            index: i,
            id: String(id),
            ok: false,
            error: (e as Error).message,
          });
        }
      }

      return {
        summary: { records: records.length, succeeded, failed },
        results,
      };
    };
    const linkRecordsInput = {
      ...inBase,
      tableId: z.string().describe('Table ID'),
      fieldId: z
        .string()
        .describe('Link field ID or title, e.g. from getTableSchema'),
      records: z
        .array(
          z.object({
            id: z
              .union([z.string(), z.number()])
              .describe('Record ID on this table'),
            links: z
              .array(
                z.object({
                  id: z
                    .union([z.string(), z.number()])
                    .describe('Record ID on the linked table'),
                }),
              )
              .max(MCP_DATA_PAYLOAD_LIMIT)
              .describe(
                `Records on the linked table. At most ${MCP_DATA_PAYLOAD_LIMIT} per entry.`,
              ),
          }),
        )
        .max(MCP_DATA_PAYLOAD_LIMIT)
        .describe(
          `One entry per record on this table. At most ${MCP_DATA_PAYLOAD_LIMIT} entries per call.`,
        ),
    };

    server.registerTool(
      'linkRecords',
      {
        title: 'Link Records',
        description:
          'Add links from records in this table to records in the linked ' +
          'table through a link field. Existing links are kept; use ' +
          'updateRecords to replace a whole set, unlinkRecords to remove. ' +
          'Reports per-record ok/error — one bad record does not fail the rest.',
        annotations: {
          title: 'Link Records',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
        inputSchema: linkRecordsInput,
      },
      async ({ baseId, tableId, fieldId, records }) =>
        runBaseTool(
          ctx,
          { op: 'nestedDataLink', scope: 'base' },
          {
            baseId,
            tableId,
            // The v3 route is POST .../links/:columnId/:rowId — rowId is in the
            // path, so one REST request per record however many links it
            // carries.
            units: unitsForBulk(records.length, 1),
          },
          async (target) =>
            runLinkOps(target, tableId, fieldId, records, (op) =>
              this.datasV3Service.nestedLink(op.target.context, {
                modelId: tableId,
                columnId: op.columnId,
                rowId: op.rowId,
                refRowIds: op.refRowIds,
                query: {},
                cookie: op.target.req,
              }),
            ),
        ),
    );

    server.registerTool(
      'unlinkRecords',
      {
        title: 'Unlink Records',
        description:
          'Remove specific links from records in this table through a link ' +
          'field. Links not named are kept. ' +
          'Reports per-record ok/error — one bad record does not fail the rest.',
        annotations: {
          title: 'Unlink Records',
          readOnlyHint: false,
          // Destructive as a client-facing hint, but deliberately left out of
          // `DELETE_SHAPED_EXTRAS`: it drops an association, not records, and
          // `updateRecords` (write tier) can already clear a whole link set by
          // sending `[]`. Delete-tiering unlink alone would not buy anything.
          // Matches the REST grant, where `nestedDataUnlink` is records:write.
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: false,
        },
        inputSchema: linkRecordsInput,
      },
      async ({ baseId, tableId, fieldId, records }) =>
        runBaseTool(
          ctx,
          { op: 'nestedDataUnlink', scope: 'base' },
          {
            baseId,
            tableId,
            // The v3 route is POST .../links/:columnId/:rowId — rowId is in the
            // path, so one REST request per record however many links it
            // carries.
            units: unitsForBulk(records.length, 1),
          },
          async (target) =>
            runLinkOps(target, tableId, fieldId, records, (op) =>
              this.datasV3Service.nestedUnlink(op.target.context, {
                modelId: tableId,
                columnId: op.columnId,
                rowId: op.rowId,
                refRowIds: op.refRowIds,
                query: {},
                cookie: op.target.req,
              }),
            ),
        ),
    );
  }
}

function formatFileSize(bytes?: number | null): string {
  if (bytes === undefined || bytes === null) return 'Unknown size';

  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

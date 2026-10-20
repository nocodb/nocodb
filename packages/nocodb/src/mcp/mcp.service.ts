import { Injectable, Logger } from '@nestjs/common';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { z } from 'zod-v4';
import { extractRolesObj, NcApiVersion, UITypes } from 'nocodb-sdk';
import type { FetchLikeMcpHandler } from '@modelcontextprotocol/node';
import type { NcContext, NcRequest, UserType } from 'nocodb-sdk';
import type { Request, Response } from 'express';
import type { McpToolRegisterCtx } from '~/mcp/tools/tool-helpers';
import type {
  DataDeleteRequest,
  DataInsertRequest,
  DataUpdateRequest,
} from '~/services/v3/data-v3.types';
import { NcError } from '~/helpers/catchError';
import PresignedUrl from '~/models/PresignedUrl';
import { resolveReadableAttachmentPath } from '~/mcp/attachment-read';
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
  recordIdSchema,
  serializeSort,
  sortSchema,
  viewIdSchema,
} from '~/mcp/data-schemas';
import {
  checkRecordFields,
  pickReturnFields,
  resolveReturnFields,
} from '~/mcp/tools/record-fields';
import { strictRegistrar } from '~/mcp/tools/strict-schema';
import {
  callScopedRegistrar,
  scopeAuditFieldsPerCall,
} from '~/mcp/tools/call-scope';
import { defaultLimitConfig } from '~/helpers/extractLimitAndOffset';
import {
  getRoleFlags,
  mcpContentResult,
  pageFromV3Url,
  resolveLinkField,
  runBaseTool,
} from '~/mcp/tools/tool-helpers';
import { baseIdInput, McpFixedBaseScope } from '~/mcp/tools/tool-scope';
import { withTypedFieldDefaults } from '~/mcp/tools/field-defaults';
import {
  includeSystemSchema,
  systemAuditFields,
} from '~/mcp/tools/system-fields';
import {
  compileFilterInput,
  filterInputDescription,
  filterInputSchema,
  resolveWhere,
} from '~/mcp/tools/filter-input';
import { Model } from '~/models';
import type { Column, LinkToAnotherRecordColumn } from '~/models';

// Image types MCP clients render inline. Anything else binary is linked, not sent.
const INLINE_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
];
const MAX_INLINE_IMAGE_BYTES = 5 * 1024 * 1024;

// Null once the stream passes `maxBytes`; the stream is destroyed then.
async function streamToBuffer(
  stream: unknown,
  maxBytes: number,
): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream as AsyncIterable<Buffer | string>) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > maxBytes) {
      (stream as { destroy?: () => void }).destroy?.();
      return null;
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

// Binary bytes decoded as UTF-8 come out as NULs and U+FFFD. The stored
// mimetype is client-supplied, so the decoded text is what decides.
function looksBinary(text: string) {
  if (text.includes('\u0000')) return true;
  const replacements = text.match(/�/g)?.length ?? 0;
  return replacements > 0 && replacements / text.length > 0.01;
}

@Injectable()
export class McpService {
  protected readonly logger = new Logger(McpService.name);

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

  // Stateless, one server per request; serves 2025-11-25 and 2026-07-28 clients.
  protected async serve(server: McpServer, req: NcRequest, res: Response) {
    const handler = createMcpHandler(() => server);

    res.on('close', () => {
      void handler.close();
      void server.close();
    });

    await toNodeHandler({ fetch: this.observeFetch(handler.fetch, req, res) })(
      req as Request,
      res,
      req.body,
    );
  }

  // EE hooks per-call access logging here.
  protected observeFetch(
    fetch: FetchLikeMcpHandler['fetch'],
    _req: NcRequest,
    _res: Response,
  ): FetchLikeMcpHandler['fetch'] {
    return fetch;
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
          includeSystem: includeSystemSchema,
        },
        annotations: {
          title: 'Get the table schema',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async ({ baseId, tableId, includeSystem }) =>
        runBaseTool(
          ctx,
          { op: 'tableGet', scope: 'base' },
          { baseId, tableId },
          async (target) => {
            const table = withTypedFieldDefaults(
              await this.tablesV3Service.getTableWithAccessibleViews(
                target.context,
                { tableId, user: target.user },
              ),
            );
            if (!includeSystem) return table;
            return {
              ...table,
              fields: [
                ...(table.fields ?? []),
                ...(await systemAuditFields(target.context, tableId)),
              ],
            };
          },
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
            .int()
            .min(1)
            .optional()
            .describe(
              'Number of records to fetch (default: 50, minimum 1). Capped at 200 here, ' +
                'and further by the deployment limit — the response reports ' +
                'the `page_size` actually applied.',
            ),
          page: z
            .number()
            .int()
            .min(1)
            .optional()
            .describe(
              'Page number for pagination (default: 1). Use `next_page` / `prev_page` from the response. A page past the end returns an empty `records` list whose `prev_page` is the last page with records (1 if there are none).',
            ),
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
              pageSize: Math.min(pageSize, 200),
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

            // The deployment clamps the limit again via NC_DB_QUERY_LIMIT_MAX
            // (1000 by default, 100 on shared/cloud), and `pageInfo` carries
            // only next/prev URLs — which echo the *requested* size. A caller
            // sizing its paging loop off the value it passed therefore skipped
            // rows silently. State the size that was actually applied.
            const effectivePageSize = Math.min(
              params.pageSize,
              defaultLimitConfig.limitMax,
            );
            const pageInfo = {
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

            const records = await this.datasV3Service.dataList(
              target.context,
              {
                baseId: target.context.base_id,
                modelId: tableId,
                viewId,
                query: params,
                req: target.req,
              },
              true,
            );

            return {
              ...records,
              ...pageInfo,
              // Page numbers to pass back as `page`; `next`/`prev` are the REST
              // URLs, which an MCP client cannot call.
              next_page: pageFromV3Url(records.next)?.page ?? null,
              prev_page: pageFromV3Url(records.prev)?.page ?? null,
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
          recordId: recordIdSchema.describe('Record ID or primary key value'),
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
          async (target) =>
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
          'Read the content of attachment objects returned by getRecord or queryRecords from an Attachment field. ' +
          'Text is returned as text, PNG/JPEG/GIF/WEBP as image content; other binary files are not returned, and the response gives a download URL.',
        inputSchema: {
          ...inBase,
          files: z
            .array(
              // Takes an attachment object exactly as records tools return it.
              z
                .object({
                  title: z.string().nullish().describe('Attachment title'),
                  mimetype: z
                    .string()
                    .nullish()
                    .describe('Attachment mime type, as stored'),
                  mimeType: z
                    .string()
                    .nullish()
                    .describe('Alias of `mimetype`'),
                  size: z.number().nullish().describe('Attachment size'),
                  url: z
                    .string()
                    .nullish()
                    .describe('Attachment URL. Required if `path` is not set.'),
                  signedUrl: z.string().nullish(),
                  path: z
                    .string()
                    .nullish()
                    .describe('Attachment path. Required if `url` is not set.'),
                  signedPath: z.string().nullish(),
                })
                .passthrough()
                .refine((f) => !!(f.url || f.path), {
                  message: 'An attachment needs a `url` or a `path`',
                }),
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

            // Signed here: client-supplied signed links expire, and only
            // signed paths are served with secure attachments on.
            const siteUrl = target.context.nc_site_url ?? target.req.ncSiteUrl;
            const downloadUrl = async (
              source: { path?: string; url?: string },
              title: string | null | undefined,
              mimetype: string,
            ) => {
              const attachment: {
                url?: string;
                path?: string;
                mimetype: string;
                signedUrl?: string;
                signedPath?: string;
              } = { ...source, mimetype };
              try {
                await PresignedUrl.signAttachment({
                  attachment,
                  filename: title ?? undefined,
                });
              } catch (e) {
                this.logger.error(e.message, e.stack);
              }
              if (attachment.signedUrl) return attachment.signedUrl;
              return siteUrl && attachment.signedPath
                ? `${siteUrl}/${attachment.signedPath}`
                : 'its attachment URL';
            };

            const results = await Promise.all(
              files.map(async (file) => {
                try {
                  if (!file.path && !file.url) {
                    return {
                      title: file.title || 'Unknown file',
                      error: 'No path or URL available for this attachment',
                    };
                  }

                  // Read and sign only the value checked below: `path` wins
                  // when present, so an unrecorded path can't ride on a
                  // recorded url.
                  const source: { path?: string; url?: string } = file.path
                    ? { path: file.path }
                    : { url: file.url ?? undefined };

                  const relativePath = await resolveReadableAttachmentPath(
                    target.context,
                    source,
                    storageAdapter,
                  );

                  if (!relativePath) {
                    return {
                      title: file.title || 'Unknown file',
                      error:
                        'Attachment is not accessible from this MCP context',
                    };
                  }

                  const mimeType =
                    file.mimeType ||
                    file.mimetype ||
                    'application/octet-stream';

                  const isInlineImage =
                    INLINE_IMAGE_MIME_TYPES.includes(mimeType);

                  const imageTooLarge = async () => ({
                    title: file.title || 'Unknown file',
                    mimeType,
                    size: file.size,
                    error:
                      `Image is larger than ${
                        MAX_INLINE_IMAGE_BYTES / (1024 * 1024)
                      } MB and is not returned inline. ` +
                      `Download it from: ${await downloadUrl(
                        source,
                        file.title,
                        mimeType,
                      )}`,
                  });

                  if (
                    isInlineImage &&
                    Number(file.size) > MAX_INLINE_IMAGE_BYTES
                  ) {
                    return imageTooLarge();
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

                  // Images go back as image content. Serialized as text they
                  // come out as garbled UTF-8.
                  if (isInlineImage) {
                    // `size` is client-supplied, so cap the read as well.
                    const bytes = await streamToBuffer(
                      stream,
                      MAX_INLINE_IMAGE_BYTES,
                    );
                    if (!bytes) return imageTooLarge();
                    return {
                      title: file.title || 'Unknown file',
                      mimeType,
                      size: file.size,
                      image: bytes.toString('base64'),
                      error: null,
                    };
                  }

                  const serialized = await serialize(
                    mimeType,
                    stream,
                    `Could not process file: ${file.title || 'Unknown file'}`,
                  );

                  const hasContent =
                    serialized.text &&
                    serialized.text !== '@file_not_supported' &&
                    !looksBinary(serialized.text);

                  return {
                    title: file.title || 'Unknown file',
                    mimeType,
                    size: file.size,
                    content: hasContent ? serialized.text : null,
                    images: serialized.images,
                    error: hasContent
                      ? null
                      : `Could not extract text from this ${mimeType} file (binary content is not returned). ` +
                        `Download it from: ${await downloadUrl(
                          source,
                          file.title,
                          mimeType,
                        )}`,
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
            const imageResults = results.filter((r) => r.image);
            const failedResults = results.filter((r) => r.error);

            // Format content for the response
            let responseText = '';

            if (imageResults.length > 0) {
              responseText += '## Images\n\n';
              for (const result of imageResults) {
                responseText += `### ${result.title}\n`;
                responseText += `**Type:** ${result.mimeType}\n\n`;
              }
            }

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

            if (imageResults.length === 0) {
              return responseText.trim();
            }

            return mcpContentResult([
              { type: 'text', text: responseText.trim() },
              ...imageResults.map((result) => ({
                type: 'image' as const,
                data: result.image as string,
                mimeType: result.mimeType as string,
              })),
            ]);
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
        description:
          `Create records in a table. Up to ${MCP_DATA_PAYLOAD_LIMIT} per call. ` +
          'A link field takes primary keys (bare or `{ id }`), never titles. ' +
          'A one-to-one or has-many target already linked elsewhere is moved, ' +
          'and its previous link is removed without a warning.',
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
          returnFields: fieldsSchema
            .optional()
            .describe(
              'Fields to return for each record — an array of field names or ids, or a comma-separated list. Omit to get every field; pass only what you need to keep large writes readable.',
            ),
        },
      },
      async ({ baseId, tableId, records, returnFields }) =>
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
          async (target) => {
            const body = Array.isArray(records) ? records : [records];
            const { warnings, ignored_fields } = await checkRecordFields(
              target.context,
              tableId,
              body,
            );
            const returnTitles = await resolveReturnFields(
              target.context,
              tableId,
              returnFields,
            );
            const inserted = await this.datasV3Service.dataInsert(
              target.context,
              {
                modelId: tableId,
                baseId: target.context.base_id,
                body: body as DataInsertRequest[],
                cookie: target.req,
                maxPayloadOverride: MCP_DATA_PAYLOAD_LIMIT,
                tolerateReadbackFailure: true,
              },
            );
            const result = pickReturnFields(inserted, returnTitles);
            const allWarnings = [...warnings, ...(result.warnings ?? [])];
            return allWarnings.length
              ? {
                  ...result,
                  warnings: allWarnings,
                  ...(ignored_fields.length ? { ignored_fields } : {}),
                }
              : result;
          },
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
          'value and is ignored. Link entries are primary keys (bare or ' +
          '`{ id }`), never titles. A one-to-one or has-many target already ' +
          'linked elsewhere is moved, and its previous link is removed without ' +
          'a warning. To add or remove individual links without ' +
          'restating the set, use linkRecords / unlinkRecords. Computed fields ' +
          'and the primary key are not written; they are listed in ' +
          '`ignored_fields`.',
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
          returnFields: fieldsSchema
            .optional()
            .describe(
              'Fields to return for each record — an array of field names or ids, or a comma-separated list. Omit to get every field; pass only what you need to keep large writes readable.',
            ),
        },
        annotations: {
          title: 'Update Records',
          readOnlyHint: false,
          destructiveHint: true,
          openWorldHint: false,
        },
      },
      async ({ baseId, tableId, records, returnFields }) =>
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
          async (target) => {
            const body = Array.isArray(records) ? records : [records];
            const { warnings, ignored_fields } = await checkRecordFields(
              target.context,
              tableId,
              body,
            );
            const returnTitles = await resolveReturnFields(
              target.context,
              tableId,
              returnFields,
            );
            const result = pickReturnFields(
              await this.datasV3Service.dataUpdate(target.context, {
                modelId: tableId,
                baseId: target.context.base_id,
                body: body as DataUpdateRequest[],
                cookie: target.req,
                maxPayloadOverride: MCP_DATA_PAYLOAD_LIMIT,
              }),
              returnTitles,
            );
            return warnings.length
              ? { ...result, warnings, ignored_fields }
              : result;
          },
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
        const { id } = records[i];
        // Duplicate ids in one entry link once; the count reports what was sent.
        const links = [
          ...new Map(records[i].links.map((l) => [String(l.id), l])).values(),
        ];
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
    // Links fields (hm/mm) read as a count in a record, so read each record's
    // links, limited to the requested targets. MCP caps records per call.
    const readLinkedViaNestedList = async (
      target: { context: NcContext; req: NcRequest },
      tableId: string,
      column: Column,
      records: { id: string | number; links: { id: string | number }[] }[],
    ) => {
      const colOptions =
        await column.getColOptions<LinkToAnotherRecordColumn>();
      const { refContext } = colOptions.getRelContext();
      const relatedModel = await colOptions.getRelatedTable();
      await relatedModel.getColumns();

      const linkedByRow = new Map<string, Set<string>>();
      for (const record of records) {
        const ids = [...new Set(record.links.map((l) => String(l.id)))];
        if (!ids.length) continue;
        try {
          const where = await compileFilterInput(refContext, relatedModel.id, {
            field: relatedModel.primaryKey.id,
            operator: 'in',
            value: ids,
          });
          const { records: rows = [] } =
            await this.datasV3Service.nestedDataList(target.context, {
              modelId: tableId,
              rowId: String(record.id),
              columnId: column.id,
              viewId: undefined,
              query: { where, limit: String(ids.length) },
              req: target.req,
            });
          linkedByRow.set(
            String(record.id),
            new Set(rows.map((row) => String(row.id))),
          );
        } catch (e) {
          this.logger.warn(
            `unlinkRecords pre-check skipped record ${record.id}: ${
              (e as Error).message
            }`,
          );
        }
      }
      return linkedByRow;
    };
    // Single links (bt/oo/mo) read as the linked record, so one dataList
    // covers every record.
    const readLinkedViaDataList = async (
      target: { context: NcContext; req: NcRequest },
      tableId: string,
      column: Column,
      records: { id: string | number; links: { id: string | number }[] }[],
    ) => {
      const model = await Model.get(target.context, tableId);
      await model.getColumns();
      const ids = [...new Set(records.map((r) => String(r.id)))];
      const where = await compileFilterInput(target.context, tableId, {
        field: model.primaryKey.id,
        operator: 'in',
        value: ids,
      });
      const { records: rows = [] } = await this.datasV3Service.dataList(
        target.context,
        {
          baseId: target.context.base_id,
          modelId: tableId,
          query: { where, fields: column.id, limit: ids.length },
          req: target.req,
        },
        true,
      );

      const linkedByRow = new Map<string, Set<string>>();
      for (const row of rows) {
        const key = [column.title, column.id].find((k) => k in row.fields);
        if (key === undefined) continue;
        const value = row.fields[key];
        // A non-object is a count, not a record.
        if (value != null && typeof value !== 'object') continue;
        const items: { id?: unknown }[] = Array.isArray(value)
          ? value
          : value
          ? [value]
          : [];
        if (items.length >= defaultLimitConfig.ltarV3Limit) continue;
        linkedByRow.set(
          String(row.id),
          new Set(items.map((item) => String(item.id))),
        );
      }
      return linkedByRow;
    };
    // Targets not linked before an unlink runs: the link engine reports no
    // per-link result, so a missing link would read as removed. A record whose
    // linked set cannot be read is skipped rather than guessed at.
    const findUnlinkedTargets = async (
      target: { context: NcContext; req: NcRequest },
      tableId: string,
      fieldId: string,
      records: { id: string | number; links: { id: string | number }[] }[],
    ): Promise<{ id: string; missing: string[] }[]> => {
      if (!records.some((r) => r.links.length)) return [];
      const column = await resolveLinkField(target.context, tableId, fieldId);
      const linkedByRow =
        column.uidt === UITypes.Links
          ? await readLinkedViaNestedList(target, tableId, column, records)
          : await readLinkedViaDataList(target, tableId, column, records);

      const unlinked: { id: string; missing: string[] }[] = [];
      for (const record of records) {
        const linked = linkedByRow.get(String(record.id));
        if (!linked) continue;
        const missing = [
          ...new Set(record.links.map((link) => String(link.id))),
        ].filter((id) => !linked.has(id));
        if (missing.length) unlinked.push({ id: String(record.id), missing });
      }
      return unlinked;
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
          'table through a link field. On a many-to-many or has-many field ' +
          'existing links are kept; use updateRecords to replace a whole ' +
          'set, unlinkRecords to remove. A many-to-one, belongs-to or ' +
          'one-to-one field takes one target per record; more is refused, ' +
          'and one target replaces any existing link on that record. A ' +
          'one-to-one or has-many target already linked elsewhere is moved, ' +
          'and its previous link is removed without a warning. ' +
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
          'field. Links not named are kept. A link the record does not have ' +
          'is named in `warnings`; other links still unlink. ' +
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
          async (target) => {
            // The check is advisory: if the read fails, the unlink still runs
            // and reports as it did before.
            const unlinked = await findUnlinkedTargets(
              target,
              tableId,
              fieldId,
              records,
            ).catch((e: Error) => {
              this.logger.warn(`unlinkRecords pre-check skipped: ${e.message}`);
              return [];
            });
            const result = await runLinkOps(
              target,
              tableId,
              fieldId,
              records,
              (op) =>
                this.datasV3Service.nestedUnlink(op.target.context, {
                  modelId: tableId,
                  columnId: op.columnId,
                  rowId: op.rowId,
                  refRowIds: op.refRowIds,
                  query: {},
                  cookie: op.target.req,
                }),
            );
            return unlinked.length
              ? {
                  ...result,
                  warnings: unlinked.map(
                    ({ id, missing }) =>
                      `Record ${id} had no link to ${missing.join(
                        ', ',
                      )}; nothing was unlinked for ${
                        missing.length === 1 ? 'it' : 'them'
                      }.`,
                  ),
                }
              : result;
          },
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

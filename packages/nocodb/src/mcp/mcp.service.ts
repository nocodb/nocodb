import path from 'node:path';
import { Injectable } from '@nestjs/common';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { extractRolesObj, NcApiVersion, ProjectRoles } from 'nocodb-sdk';
import type { NcContext, NcRequest, UserType } from 'nocodb-sdk';
import type { Request, Response } from 'express';
import type {
  DataDeleteRequest,
  DataInsertRequest,
  DataUpdateRequest,
} from '~/services/v3/data-v3.types';
import { getPathFromUrl } from '~/helpers/attachmentHelpers';
import { BasesV3Service } from '~/services/v3/bases-v3.service';
import { TablesV3Service } from '~/services/v3/tables-v3.service';
import { DataV3Service } from '~/services/v3/data-v3.service';
import { DataTableService } from '~/services/data-table.service';
import { hasMinimumRole } from '~/utils/roleHelper';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { serialize } from '~/helpers/serialize';
import { AuditsService } from '~/services/audits.service';
import { isEE } from '~/utils';
import { aggregationDescription, whereDescription } from '~/mcp/descriptions';

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
    const server = new McpServer({
      name: `NoocDB MCP Server`,
      version: '1.0.0',
    });

    await this.registerTools({ context, user: req.user, server, req });

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
    server: McpServer;
    req: NcRequest;
  }) {
    const isEditorPlus = hasMinimumRole(user, ProjectRoles.EDITOR);

    // Base Details
    server.registerTool(
      'getBaseInfo',
      {
        title: 'Get Base Info',
        description: 'Fetch information about current base',
        annotations: {
          readOnlyHint: true,
          idempotentHint: true,
        },
      }, // No parameters needed
      async () => {
        try {
          const baseInfo = await this.baseV3Service.getProject(context, {
            baseId: context.base_id,
          });

          return {
            content: [
              { type: 'text', text: JSON.stringify(baseInfo, null, 2) },
            ],
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
            isError: true,
          };
        }
      },
    );

    // List Tables
    server.registerTool(
      'getTablesList',
      {
        title: 'List Tables',
        annotations: {
          readOnlyHint: true,
          idempotentHint: true,
        },
        description: 'List tables accessible by user',
      },
      async () => {
        try {
          const tables = (
            await this.tablesV3Service.getAccessibleTables(context, {
              baseId: context.base_id,
              sourceId: undefined as string,
              roles: extractRolesObj(user?.base_roles),
            })
          ).filter((t) => !t.source_id);

          return {
            content: [{ type: 'text', text: JSON.stringify(tables, null, 2) }],
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
            isError: true,
          };
        }
      },
    );

    // Get Table Schema
    server.registerTool(
      'getTableSchema',
      {
        title: 'Get the table schema',
        description:
          'Get the table schema including fields and views information',
        inputSchema: {
          tableId: z.string().describe('Table Id'),
        },
        annotations: {
          readOnlyHint: true,
          idempotentHint: true,
        },
      },
      async ({ tableId }) => {
        try {
          const table = await this.tablesV3Service.getTableWithAccessibleViews(
            context,
            {
              tableId,
              user,
            },
          );

          if (!table) {
            return {
              content: [
                { type: 'text', text: `Error: Table "${tableId}" not found` },
              ],
              isError: true,
            };
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(table, null, 2) }],
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
            isError: true,
          };
        }
      },
    );

    // Query Records
    server.registerTool(
      'queryRecords',
      {
        title: 'Query Records',
        description: 'Query Records from a Table',
        inputSchema: {
          tableId: z.string().describe('Table ID'),
          pageSize: z
            .number()
            .optional()
            .describe('Number of records to fetch (default: 50)'),
          page: z
            .number()
            .optional()
            .describe('Page number for pagination (default: 1)'),
          where: z.string().optional().describe(whereDescription),
          sort: z.array(
            z.object({
              field: z.string().describe('Field Name'),
              description: z.enum(['asc', 'desc']).describe('Sort Direction'),
            }),
          ),
          fields: z.array(z.string()).optional().describe('Fields to fetch'),
        },
        annotations: {
          readOnlyHint: true,
        },
      },
      async ({ tableId, pageSize = 50, page = 1, where, sort, fields }) => {
        try {
          pageSize = Math.max(1, Math.min(pageSize || 25, 200));
          // Prepare parameters
          const params: any = { pageSize, page };
          if (where) params.where = where;
          if (sort) params.sort = sort;
          if (fields) params.fields = fields;

          const records = await this.datasV3Service.dataList(context, {
            baseId: context.base_id,
            modelId: tableId,
            query: params,
            req: req,
          });

          return {
            content: [{ type: 'text', text: JSON.stringify(records, null, 2) }],
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
            isError: true,
          };
        }
      },
    );

    // Get Record by ID tool
    server.registerTool(
      'getRecord',
      {
        title: 'Get Record',
        description: 'Fetch a record by ID',
        inputSchema: {
          tableId: z.string().describe('Table ID'),
          recordId: z.string().describe('Record ID or primary key value'),
          fields: z
            .string()
            .optional()
            .describe('Comma-separated list of fields to include'),
        },
        annotations: {
          readOnlyHint: true,
        },
      },
      async ({ tableId, recordId, fields }) => {
        try {
          const params: any = {};
          if (fields) params.fields = fields;

          const record = await this.dataTableService.dataRead(context, {
            modelId: tableId,
            rowId: recordId,
            baseId: context.base_id,
            apiVersion: NcApiVersion.V3,
            query: params,
          });

          return {
            content: [{ type: 'text', text: JSON.stringify(record, null, 2) }],
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
            isError: true,
          };
        }
      },
    );

    server.registerTool(
      'countRecords',
      {
        title: 'Count Records',
        description: 'Count Records in a Table',
        inputSchema: {
          tableId: z.string().describe('Table ID'),
          where: z.string().optional().describe(whereDescription),
        },
        annotations: {
          readOnlyHint: true,
        },
      },
      async ({ tableId, where }) => {
        try {
          const params: any = {};
          if (where) params.where = where;

          const count = await this.dataTableService.dataCount(context, {
            baseId: context.base_id,
            modelId: tableId,
            query: params,
            apiVersion: NcApiVersion.V3,
          });

          return {
            content: [{ type: 'text', text: JSON.stringify(count, null, 2) }],
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
            isError: true,
          };
        }
      },
    );

    server.registerTool(
      'readAttachment',
      {
        title: 'Read Attachments',
        description: 'Read attachments in a record',
        inputSchema: {
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
          readOnlyHint: true,
        },
      },
      async ({ files }) => {
        try {
          if (!files || files.length === 0) {
            return {
              content: [
                { type: 'text', text: 'Error: No attachments provided' },
              ],
              isError: true,
            };
          }

          const storageAdapter = await NcPluginMgrv2.storageAdapter();

          const results = await Promise.all(
            files.map(async (file) => {
              try {
                let relativePath;

                // Determine the relative path from attachment
                if (file.path) {
                  relativePath = path.join(
                    'nc',
                    'uploads',
                    file.path.replace(/^download[/\\]/i, ''),
                  );
                } else if (file.url) {
                  relativePath = getPathFromUrl(file.url).replace(/^\/+/, '');
                } else {
                  return {
                    title: file.title || 'Unknown file',
                    error: 'No path or URL available for this attachment',
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
                  serialized.text && serialized.text !== '@file_not_supported';

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

          return {
            content: [{ type: 'text', text: responseText.trim() }],
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `Error: ${error.message}` }],
            isError: true,
          };
        }
      },
    );

    if (!isEE) {
      server.registerTool(
        'aggregate_single',
        {
          title: 'Aggregate',
          description:
            'Perform aggregations on a table with a filter condition',
          annotations: {
            readOnlyHint: true,
            idempotentHint: true,
          },
          inputSchema: {
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
            where: z.string().optional().describe(whereDescription),
            viewId: z
              .string()
              .optional()
              .describe('Optional view ID to use view-specific configurations'),
          },
        },
        async ({ aggregations, tableId, where, viewId }) => {
          try {
            const result = await this.dataTableService.dataAggregate(context, {
              modelId: tableId,
              viewId: viewId,
              query: {
                where: where,
                aggregation: JSON.stringify(aggregations),
              },
            });

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
              isError: false,
            };
          } catch (error) {
            return {
              content: [{ type: 'text', text: `Error: ${error.message}` }],
              isError: true,
            };
          }
        },
      );
    }

    if (isEditorPlus) {
      // Create Records tool
      server.registerTool(
        'createRecords',
        {
          title: 'Create Records',
          description: 'Create records in a table',
          annotations: {
            readOnlyHint: true,
            idempotentHint: true,
          },
          inputSchema: {
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
              .describe('Array of records with fields as key-value pairs'),
          },
        },
        async ({ tableId, records }) => {
          try {
            const recordsArray = Array.isArray(records) ? records : [records];

            const result = await this.datasV3Service.dataInsert(context, {
              modelId: tableId,
              baseId: context.base_id,
              body: recordsArray as DataInsertRequest[],
              cookie: req,
            });

            return {
              content: [
                { type: 'text', text: JSON.stringify(result, null, 2) },
              ],
            };
          } catch (error) {
            return {
              content: [{ type: 'text', text: `Error: ${error.message}` }],
              isError: true,
            };
          }
        },
      );

      // Update Records tool
      server.registerTool(
        'updateRecords',
        {
          title: 'Update Records',
          description: 'Update records in a table',
          inputSchema: {
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
              .describe('Array of records with ID and fields to update'),
          },
          annotations: {
            destructiveHint: true,
          },
        },
        async ({ tableId, records }) => {
          try {
            const recordsArray = Array.isArray(records) ? records : [records];

            const result = await this.datasV3Service.dataUpdate(context, {
              modelId: tableId,
              baseId: context.base_id,
              body: recordsArray as DataUpdateRequest[],
              cookie: req,
            });

            return {
              content: [
                { type: 'text', text: JSON.stringify(result, null, 2) },
              ],
            };
          } catch (error) {
            return {
              content: [{ type: 'text', text: `Error: ${error.message}` }],
              isError: true,
            };
          }
        },
      );

      // Delete Records tool
      server.registerTool(
        'deleteRecords',
        {
          title: 'Delete Records',
          description: 'Delete records in a table',
          annotations: {
            destructiveHint: true,
          },
          inputSchema: {
            tableId: z.string().describe('Table ID'),
            records: z
              .array(
                z.object({
                  id: z.union([z.string(), z.number()]).describe('Record ID'),
                }),
              )
              .describe('Array of records with IDs to delete'),
          },
        },
        async ({ tableId, records }) => {
          try {
            const recordsArray = Array.isArray(records) ? records : [records];
            const result = await this.datasV3Service.dataDelete(context, {
              modelId: tableId,
              baseId: context.base_id,
              body: recordsArray as DataDeleteRequest[],
              cookie: req,
            });

            return {
              content: [
                { type: 'text', text: JSON.stringify(result, null, 2) },
              ],
            };
          } catch (error) {
            return {
              content: [{ type: 'text', text: `Error: ${error.message}` }],
              isError: true,
            };
          }
        },
      );

      /*
      TODO: Enable once audit is ready
      server.registerTool(
        'readAuditLogs',
        {
          tableId: z.string().describe('Table ID (fk_model_id)'),
          rowId: z.string().describe('Record/Row ID to filter logs for'),
          limit: z
            .number()
            .optional()
            .default(25)
            .describe('Number of logs to retrieve (default: 25, max: 1000)'),
          offset: z
            .number()
            .optional()
            .default(0)
            .describe('Offset for pagination (default: 0)'),
        },
        async ({ tableId, rowId, limit = 25, offset = 0 }) => {
          limit = Math.max(1, Math.min(limit || 25, 1000));
          try {
            const audits = await this.auditService.recordAuditList({
              query: {
                row_id: rowId,
                fk_model_id: tableId,
                limit,
                offset,
              },
            });

            return {
              content: [
                { type: 'text', text: JSON.stringify(audits, null, 2) },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error retrieving audit logs: ${error.message}`,
                },
              ],
              isError: true,
            };
          }
        },
      );*/
    }
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

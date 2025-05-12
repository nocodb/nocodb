import path from 'node:path';
import { Injectable } from '@nestjs/common';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { extractRolesObj, NcApiVersion, ProjectRoles } from 'nocodb-sdk';
import type { NcContext, NcRequest, UserType } from 'nocodb-sdk';
import type { Request, Response } from 'express';
import { getPathFromUrl } from '~/helpers/attachmentHelpers';
import { BasesV3Service } from '~/services/v3/bases-v3.service';
import { TablesV3Service } from '~/services/v3/tables-v3.service';
import { DataV3Service } from '~/services/v3/data-v3.service';
import { DataTableService } from '~/services/data-table.service';
import { hasMinimumRole } from '~/utils/roleHelper';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { serialize } from '~/helpers/serialize';

@Injectable()
export class McpService {
  constructor(
    private readonly baseV3Service: BasesV3Service,
    private readonly tablesV3Service: TablesV3Service,
    private readonly datasV3Service: DataV3Service,
    protected readonly dataTableService: DataTableService,
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

  private async registerTools({
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
    server.tool(
      'getBaseInfo',
      {}, // No parameters needed
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
    server.tool(
      'getTablesList',
      {}, // No parameters needed
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
    server.tool(
      'getTableSchema',
      {
        tableId: z.string().describe('Table Id'),
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

          const tableSchema =
            await this.tablesV3Service.getTableWithAccessibleViews(context, {
              tableId: table.id,
              user,
            });

          return {
            content: [
              { type: 'text', text: JSON.stringify(tableSchema, null, 2) },
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

    // Query Records
    server.tool(
      'queryRecords',
      {
        tableId: z.string().describe('Table ID'),
        limit: z
          .number()
          .optional()
          .describe('Number of records to fetch (default: 50)'),
        page: z
          .number()
          .optional()
          .describe('Page number for pagination (default: 1)'),
        where: z
          .string()
          .optional()
          .describe('Filter condition in NocoDB format'),
        sort: z
          .string()
          .optional()
          .describe('Sort criteria, e.g. "field,-field2"'),
        fields: z
          .string()
          .optional()
          .describe('Comma-separated list of fields to include'),
      },
      async ({ tableId, limit = 50, page = 1, where, sort, fields }) => {
        try {
          // Prepare parameters
          const params: any = { limit, page };
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
    server.tool(
      'getRecord',
      {
        tableId: z.string().describe('Table ID'),
        recordId: z.string().describe('Record ID or primary key value'),
        fields: z
          .string()
          .optional()
          .describe('Comma-separated list of fields to include'),
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

    server.tool(
      'countRecords',
      {
        tableId: z.string().describe('Table ID'),
        where: z
          .string()
          .optional()
          .describe('Filter condition in NocoDB format'),
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

    server.tool(
      'readAttachment',
      {
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

    if (isEditorPlus) {
      // Create Records tool
      server.tool(
        'createRecords',
        {
          tableId: z.string().describe('Table ID'),
          records: z
            .array(
              z.record(
                z.string().describe('Field name/title'),
                z.any().describe('Field value'),
              ),
            )
            .describe(
              'Array of records as key-value pairs of field titles and values',
            ),
        },
        async ({ tableId, records }) => {
          try {
            const recordsArray = Array.isArray(records) ? records : [records];

            const result = await this.datasV3Service.dataInsert(context, {
              modelId: tableId,
              baseId: context.base_id,
              body: recordsArray,
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
      server.tool(
        'updateRecords',
        {
          tableId: z.string().describe('Table ID'),
          records: z
            .array(
              z.record(
                z.string().describe('Field name/title'),
                z.any().describe('Field value'),
              ),
            )
            .describe(
              'Array of records as key-value pairs of field titles and values',
            ),
        },
        async ({ tableId, records }) => {
          try {
            const recordsArray = Array.isArray(records) ? records : [records];

            const result = await this.datasV3Service.dataUpdate(context, {
              modelId: tableId,
              baseId: context.base_id,
              body: recordsArray,
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
      server.tool(
        'deleteRecords',
        {
          tableId: z.string().describe('Table ID'),
          records: z
            .array(
              z.record(
                z.string().describe('Field name/title'),
                z.any().describe('Field value'),
              ),
            )
            .describe(
              'Array of records as key-value pairs of primary key titles and values',
            ),
        },
        async ({ tableId, records }) => {
          try {
            const recordsArray = Array.isArray(records) ? records : [records];
            const result = await this.datasV3Service.dataDelete(context, {
              modelId: tableId,
              baseId: context.base_id,
              body: recordsArray,
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

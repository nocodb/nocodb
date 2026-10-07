import { ModelTypes } from 'nocodb-sdk';
import {
  attachmentFieldIdParam,
  fieldsParam,
  hasAttachmentColumns,
  linkFieldNameParam,
  nestedPageParam,
  pageParam,
  pageSizeParam,
  recordIdParam,
  sortParam,
  viewIdParam,
  whereParam,
} from './params';
import type { SwaggerColumn } from '../getSwaggerColumnMetasV3';
import type { SwaggerView } from '~/services/api-docs/shared/swaggerUtils';
import { isRelationExist } from '~/services/api-docs/swagger/templates/paths';

const badRequest = { $ref: '#/components/responses/BadRequest' };
const unauthorized = { $ref: '#/components/responses/Unauthorized' };
const notFound = { $ref: '#/components/responses/NotFound' };

const linkRecordIdSchema = {
  type: 'object',
  properties: {
    id: {
      oneOf: [{ type: 'string' }, { type: 'number' }],
      description: 'Unique identifier for the record',
    },
  },
  required: ['id'],
};

export const getModelPaths = async (
  _context: any,
  ctx: {
    baseId: string;
    tableName: string;
    schemaName: string;
    type: ModelTypes;
    columns: SwaggerColumn[];
    tableId: string;
    views: SwaggerView[];
  },
): Promise<{ [path: string]: any }> => ({
  [`/api/v3/data/${ctx.baseId}/${ctx.tableId}/records`]: {
    get: {
      summary: `${ctx.tableName} list`,
      operationId: `${ctx.schemaName.toLowerCase()}-db-table-row-list`,
      description: `List all rows from **${ctx.tableName}** ${ctx.type}. Fields to be included in the response can be refined through query parameters. Additionally, filtering, sorting, and pagination can be applied to the results.`,
      tags: [ctx.tableName],
      parameters: [
        fieldsParam,
        sortParam,
        whereParam,
        pageParam,
        nestedPageParam,
        pageSizeParam,
        viewIdParam(ctx.views),
      ],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: getPaginatedResponseTypeV3(
                `#/components/schemas/${ctx.schemaName}Response`,
              ),
            },
          },
        },
        '400': badRequest,
        '401': unauthorized,
      },
    },
    ...(ctx.type === ModelTypes.TABLE
      ? {
          post: {
            summary: `${ctx.tableName} create`,
            description:
              'Insert a new row in table by providing a key value pair object where key refers to the column alias. All the required fields should be included with payload excluding `autoincrement` and column with default value.',
            operationId: `${ctx.schemaName.toLowerCase()}-create`,
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        records: {
                          type: 'array',
                          items: {
                            $ref: `#/components/schemas/${ctx.schemaName}Response`,
                          },
                        },
                      },
                      required: ['records'],
                    },
                  },
                },
              },
              '400': badRequest,
              '401': unauthorized,
            },
            tags: [ctx.tableName],
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    oneOf: [
                      {
                        $ref: `#/components/schemas/${ctx.schemaName}Request`,
                      },
                      {
                        type: 'array',
                        items: {
                          $ref: `#/components/schemas/${ctx.schemaName}Request`,
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
          patch: {
            summary: `${ctx.tableName} update`,
            operationId: `${ctx.schemaName.toLowerCase()}-update`,
            description:
              'Partial update row in table by providing a key value pair object where key refers to the column alias. You need to only include columns which you want to update.',
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        records: {
                          type: 'array',
                          items: {
                            $ref: `#/components/schemas/${ctx.schemaName}Response`,
                          },
                        },
                      },
                      required: ['records'],
                    },
                  },
                },
              },
              '400': badRequest,
              '401': unauthorized,
            },
            tags: [ctx.tableName],
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    oneOf: [
                      {
                        $ref: `#/components/schemas/${ctx.schemaName}UpdateRequest`,
                      },
                      {
                        type: 'array',
                        items: {
                          $ref: `#/components/schemas/${ctx.schemaName}UpdateRequest`,
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
          delete: {
            summary: `${ctx.tableName} delete`,
            operationId: `${ctx.schemaName.toLowerCase()}-delete`,
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        records: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: {
                                oneOf: [{ type: 'string' }, { type: 'number' }],
                              },
                              deleted: { type: 'boolean' },
                            },
                            required: ['id', 'deleted'],
                          },
                        },
                      },
                      required: ['records'],
                    },
                  },
                },
              },
              '400': badRequest,
              '401': unauthorized,
            },
            tags: [ctx.tableName],
            description:
              'Delete a row by using the **primary key** column value.',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    oneOf: [
                      {
                        $ref: `#/components/schemas/${ctx.schemaName}IdRequest`,
                      },
                      {
                        type: 'array',
                        items: {
                          $ref: `#/components/schemas/${ctx.schemaName}IdRequest`,
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        }
      : {}),
  },
  [`/api/v3/data/${ctx.baseId}/${ctx.tableId}/records/{recordId}`]: {
    parameters: [recordIdParam, fieldsParam],
    get: {
      summary: `${ctx.tableName} read`,
      description: 'Read a row data by using the **primary key** column value.',
      operationId: `${ctx.schemaName.toLowerCase()}-read`,
      tags: [ctx.tableName],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: `#/components/schemas/${ctx.schemaName}Response`,
              },
            },
          },
        },
        '400': badRequest,
        '401': unauthorized,
        '404': notFound,
      },
    },
  },
  [`/api/v3/data/${ctx.baseId}/${ctx.tableId}/count`]: {
    parameters: [viewIdParam(ctx.views)],
    get: {
      summary: `${ctx.tableName} count`,
      operationId: `${ctx.schemaName.toLowerCase()}-count`,
      description: 'Get rows count of a table by applying optional filters.',
      tags: [ctx.tableName],
      parameters: [whereParam],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  count: {
                    type: 'integer',
                  },
                },
              },
              examples: {
                'Example 1': {
                  value: {
                    count: 3,
                  },
                },
              },
            },
          },
        },
        '400': badRequest,
        '401': unauthorized,
      },
    },
  },

  ...(isRelationExist(ctx.columns)
    ? {
        [`/api/v3/data/${ctx.baseId}/${ctx.tableId}/links/{linkFieldId}/{recordId}`]:
          {
            parameters: [linkFieldNameParam(ctx.columns), recordIdParam],
            get: {
              summary: 'Link Records list',
              operationId: `${ctx.schemaName.toLowerCase()}-nested-list`,
              description:
                'This API endpoint allows you to retrieve list of linked records for a specific `Link field` and `Record ID`. The response is an array of objects containing Primary Key and its corresponding display value.',
              tags: [ctx.tableName],
              parameters: [
                fieldsParam,
                sortParam,
                whereParam,
                pageParam,
                pageSizeParam,
              ],
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: getPaginatedResponseTypeV3(
                        '#/components/schemas/LinkedRecord',
                      ),
                    },
                  },
                },
                '400': badRequest,
                '401': unauthorized,
                '404': notFound,
              },
            },
            post: {
              summary: 'Link Records',
              operationId: `${ctx.schemaName.toLowerCase()}-nested-link`,
              responses: {
                '200': {
                  description: 'Records successfully linked',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          success: {
                            type: 'boolean',
                            description:
                              'Indicates whether the linking operation was successful',
                          },
                        },
                        required: ['success'],
                      },
                      examples: {
                        'Success Response': {
                          value: {
                            success: true,
                          },
                        },
                      },
                    },
                  },
                },
                '400': badRequest,
                '401': unauthorized,
                '404': notFound,
              },
              tags: [ctx.tableName],
              requestBody: {
                required: true,
                description:
                  'Record objects to be linked, each containing an id field',
                content: {
                  'application/json': {
                    schema: {
                      oneOf: [
                        linkRecordIdSchema,
                        {
                          type: 'array',
                          items: linkRecordIdSchema,
                        },
                      ],
                    },
                    examples: {
                      'Single Record': {
                        summary: 'Link a single record',
                        value: {
                          id: '22',
                        },
                      },
                      'Multiple Records': {
                        summary: 'Link multiple records',
                        value: [
                          {
                            id: '43',
                          },
                          {
                            id: '44',
                          },
                        ],
                      },
                    },
                  },
                },
              },
              description:
                'This API endpoint allows you to link records to a specific `Link field` and `Record ID`. The request payload is an array of record-ids from the adjacent table for linking purposes. Note that any existing links, if present, will be unaffected during this operation.',
            },
            delete: {
              summary: 'Unlink Records',
              operationId: `${ctx.schemaName.toLowerCase()}-nested-unlink`,
              responses: {
                '200': {
                  description: 'Records successfully unlinked',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          success: {
                            type: 'boolean',
                            description:
                              'Indicates whether the unlink operation was successful',
                          },
                        },
                        required: ['success'],
                      },
                      examples: {
                        'Success Response': {
                          value: {
                            success: true,
                          },
                        },
                      },
                    },
                  },
                },
                '400': badRequest,
                '401': unauthorized,
                '404': notFound,
              },
              tags: [ctx.tableName],
              requestBody: {
                required: true,
                description:
                  'Record objects to be unlinked, each containing an id field',
                content: {
                  'application/json': {
                    schema: {
                      oneOf: [
                        linkRecordIdSchema,
                        {
                          type: 'array',
                          items: linkRecordIdSchema,
                        },
                      ],
                    },
                    examples: {
                      'Single Record': {
                        summary: 'Unlink a single record',
                        value: {
                          id: '22',
                        },
                      },
                      'Multiple Records': {
                        summary: 'Unlink multiple records',
                        value: [
                          {
                            id: '43',
                          },
                          {
                            id: '44',
                          },
                        ],
                      },
                    },
                  },
                },
              },
              description:
                'This API endpoint allows you to unlink records from a specific `Link field` and `Record ID`. The request payload is an array of record-ids from the adjacent table for unlinking purposes. Note that, \n- duplicated record-ids will be ignored.\n- non-existent record-ids will be ignored.',
            },
          },
      }
    : {}),

  ...(hasAttachmentColumns(ctx.columns)
    ? {
        [`/api/v3/data/${ctx.baseId}/${ctx.tableId}/records/{recordId}/fields/{fieldId}/upload`]:
          {
            parameters: [recordIdParam, attachmentFieldIdParam(ctx.columns)],
            post: {
              summary: 'Upload Attachment to Cell',
              operationId: `${ctx.schemaName.toLowerCase()}-attachment-upload`,
              description:
                'This API endpoint allows you to upload an attachment (base64 encoded) to a specific cell in a table. The attachment data includes content type, base64 encoded file, and filename.',
              tags: [ctx.tableName],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        contentType: {
                          type: 'string',
                          description:
                            'Content type of the file (e.g., image/png, application/pdf).',
                        },
                        file: {
                          type: 'string',
                          description: 'Base64 encoded file content.',
                        },
                        filename: {
                          type: 'string',
                          description: 'Original filename of the attachment.',
                        },
                      },
                      required: ['contentType', 'file', 'filename'],
                    },
                    examples: {
                      'Example 1': {
                        value: {
                          contentType: 'image/png',
                          file: 'iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==',
                          filename: 'image.png',
                        },
                      },
                    },
                  },
                },
              },
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          id: {
                            oneOf: [{ type: 'string' }, { type: 'number' }],
                            description:
                              'Record identifier (primary key value)',
                          },
                          fields: {
                            type: 'object',
                            description: 'Updated record fields data',
                          },
                        },
                        required: ['id'],
                      },
                      examples: {
                        'Example 1': {
                          value: {
                            id: 1,
                            fields: {
                              attachment_field: [
                                {
                                  title: 'image.png',
                                  url: 'https://example.com/files/image.png',
                                  mimetype: 'image/png',
                                  size: 12345,
                                  icon: 'mdi-file-image',
                                },
                              ],
                            },
                          },
                        },
                      },
                    },
                  },
                },
                '400': badRequest,
                '401': unauthorized,
                '404': notFound,
              },
            },
          },
      }
    : {}),
});

function getPaginatedResponseTypeV3(ref: string) {
  return {
    type: 'object',
    properties: {
      records: {
        type: 'array',
        items: { $ref: ref },
      },
      next: {
        type: ['string', 'null'],
        format: 'uri',
        description: 'URL of the next page',
      },
      prev: {
        type: ['string', 'null'],
        format: 'uri',
        description: 'URL of the previous page',
      },
      nestedNext: {
        type: ['string', 'null'],
        format: 'uri',
        description: 'URL of the next page of nested (linked) records',
      },
      nestedPrev: {
        type: ['string', 'null'],
        format: 'uri',
        description: 'URL of the previous page of nested (linked) records',
      },
    },
    required: ['records'],
  };
}

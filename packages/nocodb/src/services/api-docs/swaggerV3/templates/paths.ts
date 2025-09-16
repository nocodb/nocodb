import { ModelTypes } from 'nocodb-sdk';
import {
  fieldsParam,
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
import type { SwaggerView } from '~/services/api-docs/swaggerV3/getSwaggerJSONV3';
import { isRelationExist } from '~/services/api-docs/swagger/templates/paths';

export const getModelPaths = async (
  _context: any,
  ctx: {
    baseId: string;
    tableName: string;
    type: ModelTypes;
    columns: SwaggerColumn[];
    tableId: string;
    views: SwaggerView[];
  },
): Promise<{ [path: string]: any }> => ({
  [`/api/v3/data/${ctx.baseId}/${ctx.tableId}/records`]: {
    get: {
      summary: `${ctx.tableName} list`,
      operationId: `${ctx.tableName.toLowerCase()}-db-table-row-list`,
      description: `List of all rows from ${ctx.tableName} ${ctx.type} and response data fields can be filtered based on query params.`,
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
              schema: getPaginatedResponseTypeV3(`${ctx.tableName}Response`),
            },
          },
        },
      },
    },
    ...(ctx.type === ModelTypes.TABLE
      ? {
          post: {
            summary: `${ctx.tableName} create`,
            description:
              'Insert a new row in table by providing a key value pair object where key refers to the column alias. All the required fields should be included with payload excluding `autoincrement` and column with default value.',
            operationId: `${ctx.tableName.toLowerCase()}-create`,
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': {
                    schema: {
                      $ref: `#/components/schemas/${ctx.tableName}Response`,
                    },
                  },
                },
              },
              '400': {
                $ref: '#/components/responses/BadRequest',
              },
            },
            tags: [ctx.tableName],
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    oneOf: [
                      {
                        $ref: `#/components/schemas/${ctx.tableName}Request`,
                      },
                      {
                        type: 'array',
                        items: {
                          $ref: `#/components/schemas/${ctx.tableName}Request`,
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
            operationId: `${ctx.tableName.toLowerCase()}-update`,
            description:
              'Partial update row in table by providing a key value pair object where key refers to the column alias. You need to only include columns which you want to update.',
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': {
                    schema: {},
                  },
                },
              },
              '400': {
                $ref: '#/components/responses/BadRequest',
              },
            },
            tags: [ctx.tableName],
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    oneOf: [
                      {
                        $ref: `#/components/schemas/${ctx.tableName}Request`,
                      },
                      {
                        type: 'array',
                        items: {
                          $ref: `#/components/schemas/${ctx.tableName}Request`,
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
            operationId: `${ctx.tableName.toLowerCase()}-delete`,
            responses: {
              '200': {
                description: 'OK',
              },
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
                        $ref: `#/components/schemas/${ctx.tableName}IdRequest`,
                      },
                      {
                        type: 'array',
                        items: {
                          $ref: `#/components/schemas/${ctx.tableName}IdRequest`,
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
      operationId: `${ctx.tableName.toLowerCase()}-read`,
      tags: [ctx.tableName],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                $ref: `#/components/schemas/${ctx.tableName}Response`,
              },
            },
          },
        },
      },
    },
  },
  [`/api/v3/data/${ctx.baseId}/${ctx.tableId}/records/count`]: {
    parameters: [viewIdParam(ctx.views)],
    get: {
      summary: `${ctx.tableName} count`,
      operationId: `${ctx.tableName.toLowerCase()}-count`,
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
                    type: 'number',
                  },
                },
                required: ['count'],
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
        '400': {
          $ref: '#/components/responses/BadRequest',
        },
      },
    },
  },

  ...(isRelationExist(ctx.columns)
    ? {
        [`/api/v3/data/${ctx.baseId}/${ctx.tableId}/links/{linkFieldId}/records/{recordId}`]:
          {
            parameters: [linkFieldNameParam(ctx.columns), recordIdParam],
            get: {
              summary: 'Link Records list',
              operationId: `${ctx.tableName.toLowerCase()}-nested-list`,
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
                        `${ctx.tableName}Response`,
                      ),
                    },
                  },
                },
                '400': {
                  $ref: '#/components/responses/BadRequest',
                },
              },
            },
            post: {
              summary: 'Link Records',
              operationId: `${ctx.tableName.toLowerCase()}-nested-link`,
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: {},
                      examples: {
                        'Example 1': {
                          value: true,
                        },
                      },
                    },
                  },
                },
                '400': {
                  $ref: '#/components/responses/BadRequest',
                },
              },
              tags: [ctx.tableName],
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      oneOf: [
                        {
                          type: 'object',
                        },
                        {
                          type: 'array',
                          items: {
                            type: 'object',
                          },
                        },
                      ],
                    },
                    examples: {
                      'Example 1': {
                        value: [
                          {
                            Id: 4,
                          },
                          {
                            Id: 5,
                          },
                        ],
                      },
                      'Example 2': {
                        value: {
                          Id: 4,
                        },
                      },
                    },
                  },
                },
              },
              description:
                'This API endpoint allows you to link records to a specific `Link field` and `Record ID`. The request payload is an array of record-ids from the adjacent table for linking purposes. Note that any existing links, if present, will be unaffected during this operation.',
              parameters: [recordIdParam],
            },
            delete: {
              summary: 'Unlink Records',
              operationId: `${ctx.tableName.toLowerCase()}-nested-unlink`,
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: {},
                      examples: {
                        'Example 1': {
                          value: true,
                        },
                      },
                    },
                  },
                },
                '400': {
                  $ref: '#/components/responses/BadRequest',
                },
              },
              tags: [ctx.tableName],
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      oneOf: [
                        {
                          type: 'array',
                          items: {
                            type: 'object',
                          },
                        },
                      ],
                    },
                    examples: {
                      'Example 1': {
                        value: [
                          {
                            Id: 1,
                          },
                          {
                            Id: 2,
                          },
                        ],
                      },
                    },
                  },
                },
              },
              description:
                'This API endpoint allows you to unlink records from a specific `Link field` and `Record ID`. The request payload is an array of record-ids from the adjacent table for unlinking purposes. Note that, \n- duplicated record-ids will be ignored.\n- non-existent record-ids will be ignored.',
              parameters: [recordIdParam],
            },
          },
      }
    : {}),
});

function getPaginatedResponseTypeV3(type: string) {
  return {
    type: 'object',
    properties: {
      records: {
        type: 'array',
        items: {
          $ref: `#/components/schemas/${type}`,
        },
      },
      next: {
        type: ['string', 'null'],
        description: 'Pagination token for next page',
      },
      prev: {
        type: ['string', 'null'],
        description: 'Pagination token for previous page',
      },
      page: {
        type: 'integer',
        description: 'Current page number',
      },
      pageSize: {
        type: 'integer',
        description: 'Number of records per page',
      },
      totalRows: {
        type: 'integer',
        description: 'Total number of records',
      },
    },
    required: ['records'],
  };
}

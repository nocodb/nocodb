import { isLinksOrLTAR, ModelTypes } from 'nocodb-sdk';
import {
  columnNameParam,
  columnNameQueryParam,
  csvExportOffsetParam,
  exportTypeParam,
  fieldsParam,
  getNestedParams,
  limitParam,
  offsetParam,
  referencedRowIdParam,
  relationTypeParam,
  rowIdParam,
  shuffleParam,
  sortParam,
  whereParam,
} from './params';
import { csvExportResponseHeader } from './headers';
import type { SwaggerColumn } from '../getSwaggerColumnMetas';

export const getModelPaths = async (ctx: {
  tableName: string;
  orgs: string;
  type: ModelTypes;
  columns: SwaggerColumn[];
  baseName: string;
}): Promise<{ [path: string]: any }> => ({
  [`/api/v1/db/data/${ctx.orgs}/${ctx.baseName}/${ctx.tableName}`]: {
    get: {
      summary: `${ctx.tableName} list`,
      operationId: `${ctx.tableName.toLowerCase()}-db-table-row-list`,
      description: `List of all rows from ${ctx.tableName} ${ctx.type} and response data fields can be filtered based on query params.`,
      tags: [ctx.tableName],
      parameters: [
        fieldsParam,
        sortParam,
        whereParam,
        limitParam,
        shuffleParam,
        offsetParam,
        ...(await getNestedParams(ctx.columns)),
      ],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: getPaginatedResponseType(`${ctx.tableName}Response`),
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
            },
            tags: [ctx.tableName],
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    $ref: `#/components/schemas/${ctx.tableName}Request`,
                  },
                },
              },
            },
          },
        }
      : {}),
  },
  [`/api/v1/db/data/${ctx.orgs}/${ctx.baseName}/${ctx.tableName}/{rowId}`]: {
    parameters: [rowIdParam],
    ...(ctx.type === ModelTypes.TABLE
      ? {
          get: {
            parameters: [fieldsParam],
            summary: `${ctx.tableName} read`,
            description:
              'Read a row data by using the **primary key** column value.',
            operationId: `${ctx.tableName.toLowerCase()}-read`,
            responses: {
              '201': {
                description: 'Created',
                content: {
                  'application/json': {
                    schema: {
                      $ref: `#/components/schemas/${ctx.tableName}Response`,
                    },
                  },
                },
              },
            },
            tags: [ctx.tableName],
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
                    schema: {
                      $ref: `#/components/schemas/${ctx.tableName}Request`,
                    },
                  },
                },
              },
            },
            tags: [ctx.tableName],
            requestBody: {
              content: {
                'application/json': {
                  schema: {},
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
          },
        }
      : {}),
  },
  [`/api/v1/db/data/${ctx.orgs}/${ctx.baseName}/${ctx.tableName}/count`]: {
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
              schema: {},
            },
          },
        },
      },
    },
  },
  [`/api/v1/db/data/${ctx.orgs}/${ctx.baseName}/${ctx.tableName}/find-one`]: {
    get: {
      summary: `${ctx.tableName} find-one`,
      operationId: `${ctx.tableName.toLowerCase()}-db-table-row-find-one`,
      description: `Find first record matching the conditions.`,
      tags: [ctx.tableName],
      parameters: [fieldsParam, whereParam, sortParam],
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
  [`/api/v1/db/data/${ctx.orgs}/${ctx.baseName}/${ctx.tableName}/groupby`]: {
    get: {
      summary: `${ctx.tableName} groupby`,
      operationId: `${ctx.tableName.toLowerCase()}-groupby`,
      description: 'Group by a column.',
      tags: [ctx.tableName],
      parameters: [
        columnNameQueryParam,
        sortParam,
        whereParam,
        limitParam,
        offsetParam,
        shuffleParam,
      ],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  list: {
                    type: 'array',
                    items: {
                      $ref: `#/components/schemas/Groupby`,
                    },
                  },
                  PageInfo: {
                    $ref: `#/components/schemas/Paginated`,
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  ...(ctx.type === ModelTypes.TABLE
    ? {
        [`/api/v1/db/data/bulk/${ctx.orgs}/${ctx.baseName}/${ctx.tableName}`]: {
          post: {
            summary: `${ctx.tableName} bulk insert`,
            description:
              "To insert large amount of data in a single api call you can use this api. It's similar to insert method but here you can pass array of objects to insert into table. Array object will be key value paired column name and value.",
            operationId: `${ctx.tableName.toLowerCase()}-bulk-create`,
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': {
                    schema: {},
                  },
                },
              },
            },
            tags: [ctx.tableName],
            requestBody: {
              content: {
                'application/json': {
                  schema: {},
                },
              },
            },
          },
          patch: {
            summary: `${ctx.tableName} bulk  update`,
            description:
              "To update multiple records using it's primary key you can use this api. Bulk updated api accepts array object in which each object should contain it's primary columns value mapped to corresponding alias. In addition to primary key you can include the fields which you want to update",
            operationId: `${ctx.tableName.toLowerCase()}-bulk-update`,
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': {
                    schema: {},
                  },
                },
              },
            },
            tags: [ctx.tableName],
            requestBody: {
              content: {
                'application/json': {
                  schema: {},
                },
              },
            },
          },
          delete: {
            summary: `${ctx.tableName} bulk delete by IDs`,
            description:
              "To delete multiple records using it's primary key you can use this api. Bulk delete api accepts array object in which each object should contain it's primary columns value mapped to corresponding alias.",
            operationId: `${ctx.tableName.toLowerCase()}-bulk-delete`,
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': {
                    schema: {},
                  },
                },
              },
            },
            tags: [ctx.tableName],
            requestBody: {
              content: {
                'application/json': {
                  schema: {},
                },
              },
            },
          },
        },
        [`/api/v1/db/data/bulk/${ctx.orgs}/${ctx.baseName}/${ctx.tableName}/all`]:
          {
            parameters: [whereParam],
            patch: {
              summary: `${ctx.tableName} Bulk update with conditions`,
              description:
                "This api helps you update multiple table rows in a single api call. You don't have to pass the record id instead you can filter records and apply the changes to filtered records. Payload is similar as normal update in which you can pass any partial row data to be updated.",
              operationId: `${ctx.tableName.toLowerCase()}-bulk-update-all`,
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: {},
                    },
                  },
                },
              },
              tags: [ctx.tableName],
              requestBody: {
                content: {
                  'application/json': {
                    schema: {},
                  },
                },
              },
            },
            delete: {
              summary: 'Bulk delete with conditions',
              description:
                "This api helps you delete multiple table rows in a single api call. You don't have to pass the record id instead you can filter records and delete filtered records.",
              operationId: `${ctx.tableName.toLowerCase()}-bulk-delete-all`,
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: {},
                    },
                  },
                },
              },
              tags: [ctx.tableName],
            },
          },

        ...(isRelationExist(ctx.columns)
          ? {
              [`/api/v1/db/data/${ctx.orgs}/${ctx.baseName}/${ctx.tableName}/{rowId}/{relationType}/{columnName}`]:
                {
                  parameters: [
                    rowIdParam,
                    relationTypeParam,
                    columnNameParam(ctx.columns),
                  ],
                  get: {
                    summary: 'Relation row list',
                    operationId: `${ctx.tableName.toLowerCase()}-nested-list`,
                    responses: {
                      '200': {
                        description: 'OK',
                        content: {
                          'application/json': {
                            schema: {},
                          },
                        },
                      },
                    },
                    tags: [ctx.tableName],
                    parameters: [limitParam, offsetParam],
                  },
                },
              [`/api/v1/db/data/${ctx.orgs}/${ctx.baseName}/${ctx.tableName}/{rowId}/{relationType}/{columnName}/{refRowId}`]:
                {
                  parameters: [
                    rowIdParam,
                    relationTypeParam,
                    columnNameParam(ctx.columns),
                    referencedRowIdParam,
                  ],
                  post: {
                    summary: 'Relation row add',
                    operationId: `${ctx.tableName.toLowerCase()}-nested-add`,
                    responses: {
                      '200': {
                        description: 'OK',
                        content: {
                          'application/json': {
                            schema: {},
                          },
                        },
                      },
                    },
                    tags: [ctx.tableName],
                    parameters: [limitParam, shuffleParam, offsetParam],
                    description: '',
                  },
                  delete: {
                    summary: 'Relation row remove',
                    operationId: `${ctx.tableName.toLowerCase()}-nested-remove`,
                    responses: {
                      '200': {
                        description: 'OK',
                        content: {
                          'application/json': {
                            schema: {},
                          },
                        },
                      },
                    },
                    tags: [ctx.tableName],
                  },
                },
              [`/api/v1/db/data/${ctx.orgs}/${ctx.baseName}/${ctx.tableName}/{rowId}/{relationType}/{columnName}/exclude`]:
                {
                  parameters: [
                    rowIdParam,
                    relationTypeParam,
                    columnNameParam(ctx.columns),
                  ],
                  get: {
                    summary:
                      'Referenced tables rows excluding current records children/parent',
                    operationId: `${ctx.tableName.toLowerCase()}-nested-children-excluded-list`,
                    responses: {
                      '200': {
                        description: 'OK',
                        content: {
                          'application/json': {
                            schema: {},
                          },
                        },
                      },
                    },
                    tags: [ctx.tableName],
                    parameters: [limitParam, shuffleParam, offsetParam],
                  },
                },
            }
          : {}),
      }
    : {}),
  [`/api/v1/db/data/${ctx.orgs}/${ctx.baseName}/${ctx.tableName}/export/{type}`]:
    {
      parameters: [exportTypeParam],
      get: {
        summary: 'Rows export',
        operationId: `${ctx.tableName.toLowerCase()}-csv-export`,
        description:
          'Export all the records from a table.Currently we are only supports `csv` export.',
        tags: [ctx.tableName],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/octet-stream': {
                schema: {},
              },
            },
            headers: csvExportResponseHeader,
          },
        },
        parameters: [csvExportOffsetParam],
      },
    },
});

export const getViewPaths = async (ctx: {
  tableName: string;
  viewName: string;
  type: ModelTypes;
  orgs: string;
  baseName: string;
  columns: SwaggerColumn[];
}): Promise<any> => ({
  [`/api/v1/db/data/${ctx.orgs}/${ctx.baseName}/${ctx.tableName}/views/${ctx.viewName}`]:
    {
      get: {
        summary: `${ctx.viewName} list`,
        operationId: `${ctx.tableName}-${ctx.viewName}-row-list`,
        description: `List of all rows from ${ctx.viewName} grid view and data of fields can be filtered based on query params. Data and fields in a grid view will be filtered and sorted by default based on the applied options in Dashboard.`,
        tags: [`${ctx.viewName} ( ${ctx.tableName} grid )`],
        parameters: [
          fieldsParam,
          sortParam,
          whereParam,
          ...(await getNestedParams(ctx.columns)),
        ],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: getPaginatedResponseType(
                  `${ctx.tableName}${ctx.viewName}GridResponse`,
                ),
              },
            },
          },
        },
      },
      ...(ctx.type === ModelTypes.TABLE
        ? {
            post: {
              summary: `${ctx.viewName} create`,
              description:
                'Insert a new row in table by providing a key value pair object where key refers to the column alias. All the required fields should be included with payload excluding `autoincrement` and column with default value.',
              operationId: `${ctx.tableName}-${ctx.viewName}-row-create`,
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: {},
                    },
                  },
                },
              },
              tags: [`${ctx.viewName} ( ${ctx.tableName} grid )`],
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      $ref: `#/components/schemas/${ctx.tableName}${ctx.viewName}GridRequest`,
                    },
                  },
                },
              },
            },
          }
        : {}),
    },
  [`/api/v1/db/data/${ctx.orgs}/${ctx.baseName}/${ctx.tableName}/views/${ctx.viewName}/count`]:
    {
      get: {
        summary: `${ctx.viewName} count`,
        operationId: `${ctx.tableName}-${ctx.viewName}-row-count`,
        description: '',
        tags: [`${ctx.viewName} ( ${ctx.tableName} grid )`],
        parameters: [whereParam],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    count: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
  ...(ctx.type === ModelTypes.TABLE
    ? {
        [`/api/v1/db/data/${ctx.orgs}/${ctx.baseName}/${ctx.tableName}/views/${ctx.viewName}/{rowId}`]:
          {
            parameters: [rowIdParam],
            get: {
              summary: `${ctx.viewName} read`,
              description:
                'Read a row data by using the **primary key** column value.',
              operationId: `${ctx.tableName}-${ctx.viewName}-row-read`,
              responses: {
                '200': {
                  description: 'Created',
                  content: {
                    'application/json': {
                      schema: {
                        $ref: `#/components/schemas/${ctx.tableName}${ctx.viewName}GridResponse`,
                      },
                    },
                  },
                },
              },
              tags: [`${ctx.viewName} ( ${ctx.tableName} grid )`],
            },
            patch: {
              summary: `${ctx.viewName} update`,
              description:
                'Partial update row in table by providing a key value pair object where key refers to the column alias. You need to only include columns which you want to update.',
              operationId: `${ctx.tableName}-${ctx.viewName}-row-update`,
              responses: {
                '200': {
                  description: 'OK',
                  content: {
                    'application/json': {
                      schema: {},
                    },
                  },
                },
              },
              tags: [`${ctx.viewName} ( ${ctx.tableName} grid )`],
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      $ref: `#/components/schemas/${ctx.tableName}${ctx.viewName}GridRequest`,
                    },
                  },
                },
              },
            },
            delete: {
              summary: `${ctx.viewName} delete`,
              operationId: `${ctx.tableName}-${ctx.viewName}-row-delete`,
              responses: {
                '200': {
                  description: 'OK',
                },
              },
              tags: [`${ctx.viewName} ( ${ctx.tableName} grid )`],
              description:
                'Delete a row by using the **primary key** column value.',
            },
          },
      }
    : {}),
  [`/api/v1/db/data/${ctx.orgs}/${ctx.baseName}/${ctx.tableName}/views/${ctx.viewName}/export/{type}`]:
    {
      parameters: [exportTypeParam],
      get: {
        summary: `${ctx.viewName} export`,
        operationId: `${ctx.tableName}-${ctx.viewName}-row-export`,
        description:
          'Export all the records from a table view. Currently we are only supports `csv` export.',
        tags: [`${ctx.viewName} ( ${ctx.tableName} grid )`],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/octet-stream': {
                schema: {},
              },
            },
            headers: csvExportResponseHeader,
          },
        },
        parameters: [],
      },
    },
});

function getPaginatedResponseType(type: string) {
  return {
    type: 'object',
    properties: {
      list: {
        type: 'array',
        items: {
          $ref: `#/components/schemas/${type}`,
        },
      },
      PageInfo: {
        $ref: `#/components/schemas/Paginated`,
      },
    },
  };
}
function isRelationExist(columns: SwaggerColumn[]) {
  return columns.some((c) => isLinksOrLTAR(c.column) && !c.column.system);
}

import { ModelTypes, UITypes } from 'nocodb-sdk';
import {
  columnNameParam,
  csvExportOffsetParam,
  exportTypeParam,
  fieldsParam,
  getNestedParams,
  limitParam,
  offsetParam,
  referencedRowIdParam,
  relationTypeParam,
  rowIdParam,
  sortParam,
  whereParam
} from './params';
import { csvExportResponseHeader } from './headers';
import { SwaggerColumn } from '../getSwaggerColumnMetas';

export default async (ctx: {
  tableName: string;
  orgs: string;
  type: ModelTypes;
  columns: SwaggerColumn[];
  projectName: string;
}): Promise<{ [path: string]: any }> => ({
  [`/api/v1/db/data/${ctx.orgs}/${ctx.projectName}/${ctx.tableName}`]: {
    get: {
      summary: `Row list`,
      operationId: 'db-table-row-list',
      description: `List of all rows from ${ctx.tableName} ${ctx.type} and data of fields can be filtered based on query params.`,
      tags: [ctx.tableName],
      parameters: [
        fieldsParam,
        sortParam,
        whereParam,
        limitParam,
        offsetParam,
        ...(await getNestedParams(ctx.columns))
      ],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: getPaginatedResponseType(`${ctx.tableName}Response`)
              }
            }
          }
        }
      }
    },
    ...(ctx.type === ModelTypes.TABLE
      ? {
          post: {
            summary: `Row create`,
            description:
              'Insert a new row in table by providing a key value pair object where key refers to the column alias. All the required fields should be included with payload excluding `autoincrement` and column with default value.',
            operationId: `${ctx.tableName.toLowerCase()}-create`,
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': {
                    schema: {
                      $ref: `#/components/schemas/${ctx.tableName}Response`
                    }
                  }
                }
              }
            },
            tags: [ctx.tableName],
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    $ref: `#/components/schemas/${ctx.tableName}Request`
                  }
                }
              }
            }
          }
        }
      : {})
  },
  [`/api/v1/db/data/${ctx.orgs}/${ctx.projectName}/${ctx.tableName}/{rowId}`]: {
    parameters: [rowIdParam],
    ...(ctx.type === ModelTypes.TABLE
      ? {
          get: {
            parameters: [fieldsParam],
            summary: `Row read`,
            description:
              'Read a row data by using the **primary key** column value.',
            operationId: `${ctx.tableName.toLowerCase()}-read`,
            responses: {
              '201': {
                description: 'Created',
                content: {
                  'application/json': {
                    schema: {
                      $ref: `#/components/schemas/${ctx.tableName}Response`
                    }
                  }
                }
              }
            },
            tags: [ctx.tableName]
          },
          patch: {
            summary: `Row update`,
            operationId: `${ctx.tableName.toLowerCase()}-update`,
            description:
              'Partial update row in table by providing a key value pair object where key refers to the column alias. You need to only include columns which you want to update.',
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': {
                    schema: {
                      $ref: `#/components/schemas/${ctx.tableName}Request`
                    }
                  }
                }
              }
            },
            tags: [ctx.tableName],
            requestBody: {
              content: {
                'application/json': {
                  schema: {}
                }
              }
            }
          },
          delete: {
            summary: `Row delete`,
            operationId: `${ctx.tableName.toLowerCase()}-delete`,
            responses: {
              '200': {
                description: 'OK'
              }
            },
            tags: [ctx.tableName],
            description: ''
          }
        }
      : {})
  },
  [`/api/v1/db/data/${ctx.orgs}/${ctx.projectName}/${ctx.tableName}/count`]: {
    get: {
      summary: 'Rows count',
      operationId: `${ctx.tableName.toLowerCase()}-count`,
      description: 'Get rows count of a table by applying optional filters.',
      tags: [ctx.tableName],
      parameters: [whereParam],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {}
            }
          }
        }
      }
    }
  },
  ...(ctx.type === ModelTypes.TABLE
    ? {
        [`/api/v1/db/data/bulk/${ctx.orgs}/${ctx.projectName}/${ctx.tableName}`]: {
          post: {
            summary: 'Bulk insert',
            description:
              "To insert large amount of data in a single api call you can use this api. It's similar to insert method but here you can pass array of objects to insert into table. Array object will be key value paired column name and value.",
            operationId: `${ctx.tableName.toLowerCase()}-bulk-create`,
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': {
                    schema: {}
                  }
                }
              }
            },
            tags: [ctx.tableName],
            requestBody: {
              content: {
                'application/json': {
                  schema: {}
                }
              }
            }
          },
          patch: {
            summary: 'Bulk update',
            description:
              "To update multiple records using it's primary key you can use this api. Bulk updated api accepts array object in which each object should contain it's primary columns value mapped to corresponding alias. In addition to primary key you can include the fields which you want to update",
            operationId: `${ctx.tableName.toLowerCase()}-bulk-update`,
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': {
                    schema: {}
                  }
                }
              }
            },
            tags: [ctx.tableName],
            requestBody: {
              content: {
                'application/json': {
                  schema: {}
                }
              }
            }
          },
          delete: {
            summary: 'Bulk delete by IDs',
            description:
              "To delete multiple records using it's primary key you can use this api. Bulk delete api accepts array object in which each object should contain it's primary columns value mapped to corresponding alias.",
            operationId: `${ctx.tableName.toLowerCase()}-bulk-delete`,
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': {
                    schema: {}
                  }
                }
              }
            },
            tags: [ctx.tableName],
            requestBody: {
              content: {
                'application/json': {
                  schema: {}
                }
              }
            }
          }
        },
        [`/api/v1/db/data/bulk/${ctx.orgs}/${ctx.projectName}/${ctx.tableName}/all`]: {
          parameters: [whereParam],
          patch: {
            summary: 'Bulk update with conditions',
            description:
              "This api helps you update multiple table rows in a single api call. You don't have to pass the record id instead you can filter records and apply the changes to filtered records. Payload is similar as normal update in which you can pass any partial row data to be updated.",
            operationId: `${ctx.tableName.toLowerCase()}-bulk-update-all`,
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': {
                    schema: {}
                  }
                }
              }
            },
            tags: [ctx.tableName],
            requestBody: {
              content: {
                'application/json': {
                  schema: {}
                }
              }
            }
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
                    schema: {}
                  }
                }
              }
            },
            tags: [ctx.tableName],
            requestBody: {
              content: {
                'application/json': {
                  schema: {}
                }
              }
            }
          }
        },

        ...(isRelationExist(ctx.columns)
          ? {
              [`/api/v1/db/data/${ctx.orgs}/${ctx.projectName}/${ctx.tableName}/{rowId}/{relationType}/{columnName}`]: {
                parameters: [
                  rowIdParam,
                  relationTypeParam,
                  columnNameParam(ctx.columns)
                ],
                get: {
                  summary: 'Relation row list',
                  operationId: `${ctx.tableName.toLowerCase()}-nested-list`,
                  responses: {
                    '200': {
                      description: 'OK',
                      content: {
                        'application/json': {
                          schema: {}
                        }
                      }
                    }
                  },
                  tags: [ctx.tableName],
                  parameters: [limitParam, offsetParam]
                }
              },
              [`/api/v1/db/data/${ctx.orgs}/${ctx.projectName}/${ctx.tableName}/{rowId}/{relationType}/{columnName}/{refRowId}`]: {
                parameters: [
                  rowIdParam,
                  relationTypeParam,
                  columnNameParam(ctx.columns),
                  referencedRowIdParam
                ],
                post: {
                  summary: 'Relation row add',
                  operationId: `${ctx.tableName.toLowerCase()}-nested-add`,
                  responses: {
                    '200': {
                      description: 'OK',
                      content: {
                        'application/json': {
                          schema: {}
                        }
                      }
                    }
                  },
                  tags: [ctx.tableName],
                  parameters: [limitParam, offsetParam],
                  description: ''
                },
                delete: {
                  summary: 'Relation row remove',
                  operationId: `${ctx.tableName.toLowerCase()}-nested-remove`,
                  responses: {
                    '200': {
                      description: 'OK',
                      content: {
                        'application/json': {
                          schema: {}
                        }
                      }
                    }
                  },
                  tags: [ctx.tableName]
                }
              },
              [`/api/v1/db/data/${ctx.orgs}/${ctx.projectName}/${ctx.tableName}/{rowId}/{relationType}/{columnName}/exclude`]: {
                parameters: [
                  rowIdParam,
                  relationTypeParam,
                  columnNameParam(ctx.columns)
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
                          schema: {}
                        }
                      }
                    }
                  },
                  tags: [ctx.tableName],
                  parameters: [limitParam, offsetParam]
                }
              }
            }
          : {})
      }
    : {}),
  [`/api/v1/db/data/${ctx.orgs}/${ctx.projectName}/${ctx.tableName}/export/{type}`]: {
    parameters: [exportTypeParam],
    get: {
      summary: 'Rows export',
      operationId: `${ctx.tableName.toLowerCase()}-csv-export`,
      description: 'Export all the records from a',
      tags: [ctx.tableName],
      wrapped: true,
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/octet-stream': {
              schema: {}
            }
          },
          headers: csvExportResponseHeader
        }
      },
      parameters: [csvExportOffsetParam]
    }
  }
});

export const viewPaths = (ctx: {
  tableName: string;
  viewName: string;
  orgs: string;
  projectName: string;
  columns: Array<{ type: string; title: string }>;
}): any => ({
  [`/api/v1/db/data/${ctx.orgs}/${ctx.projectName}/${ctx.tableName}/views/${ctx.viewName}`]: {
    parameters: [
      {
        schema: {
          type: 'string'
        },
        name: 'viewName',
        in: 'path',
        required: true
      }
    ],
    get: {
      summary: 'Table view row list',
      operationId: 'db-view-row-list',
      description: '',
      tags: ['DB view row'],
      parameters: [
        {
          schema: {
            type: 'array'
          },
          in: 'query',
          name: 'fields'
        },
        {
          schema: {
            type: 'array'
          },
          in: 'query',
          name: 'sort'
        },
        {
          schema: {
            type: 'string'
          },
          in: 'query',
          name: 'where'
        },
        {
          schema: {},
          in: 'query',
          name: 'nested',
          description: 'Query params for nested data'
        }
      ],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {}
            }
          }
        }
      }
    },
    post: {
      summary: 'Table view row create',
      operationId: 'db-view-row-create',
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {}
            }
          }
        }
      },
      tags: ['DB view row'],
      requestBody: {
        content: {
          'application/json': {
            schema: {}
          }
        }
      }
    }
  },
  [`/api/v1/db/data/${ctx.orgs}/${ctx.projectName}/${ctx.tableName}/views/${ctx.viewName}/count`]: {
    parameters: [
      {
        schema: {
          type: 'string'
        },
        name: 'viewName',
        in: 'path',
        required: true
      }
    ],
    get: {
      summary: 'Table view rows count',
      operationId: 'db-view-row-count',
      description: '',
      tags: ['DB view row'],
      parameters: [
        {
          schema: {
            type: 'string'
          },
          in: 'query',
          name: 'where',
          description:
            'This can be used for filtering rows, which accepts complicated where conditions. For more info visit [here](https://docs.nocodb.com/developer-resources/rest-apis#comparison-operators)',
          example: '(field1,eq,value)'
        }
      ],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {}
            }
          }
        }
      }
    }
  },
  [`/api/v1/db/data/${ctx.orgs}/${ctx.projectName}/${ctx.tableName}/views/${ctx.viewName}/{rowId}`]: {
    parameters: [
      {
        schema: {
          type: 'string'
        },
        name: 'viewName',
        in: 'path',
        required: true
      },
      {
        schema: {
          type: 'string'
        },
        name: 'rowId',
        in: 'path',
        required: true
      }
    ],
    get: {
      summary: 'Table view row read',
      operationId: 'db-view-row-read',
      responses: {
        '201': {
          description: 'Created',
          content: {
            'application/json': {
              schema: {}
            }
          }
        }
      },
      description: '',
      tags: ['DB view row']
    },
    patch: {
      summary: 'Table view row update',
      operationId: 'db-view-row-update',
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {}
            }
          }
        }
      },
      tags: ['DB view row'],
      requestBody: {
        content: {
          'application/json': {
            schema: {}
          }
        }
      }
    },
    delete: {
      summary: 'Table view row delete',
      operationId: 'db-view-row-delete',
      responses: {
        '200': {
          description: 'OK'
        }
      },
      tags: ['DB view row'],
      description: ''
    }
  },
  [`/api/v1/db/data/${ctx.orgs}/${ctx.projectName}/${ctx.tableName}/views/${ctx.viewName}/export/{type}`]: {
    parameters: [
      {
        schema: {
          type: 'string'
        },
        name: 'viewName',
        in: 'path',
        required: true
      },
      {
        schema: {
          type: 'string',
          enum: ['csv', 'excel']
        },
        name: 'type',
        in: 'path',
        required: true
      }
    ],
    get: {
      summary: 'Table view rows export',
      operationId: 'db-view-row-export',
      description: 'CSV or Excel export',
      tags: ['DB view row'],
      wrapped: true,
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/octet-stream': {
              schema: {}
            }
          },
          headers: {
            'nc-export-offset': {
              schema: {
                type: 'integer'
              }
            }
          }
        }
      },
      parameters: []
    }
  }
});

function getPaginatedResponseType(type: string) {
  return {
    list: {
      type: 'array',
      items: {
        $ref: `#/components/schemas/${type}`
      }
    },
    PageInfo: {
      $ref: `#/components/schemas/Paginated`
    }
  };
}
function isRelationExist(columns: SwaggerColumn[]) {
  return columns.some(
    c => c.column.uidt === UITypes.LinkToAnotherRecord && !c.column.system
  );
}

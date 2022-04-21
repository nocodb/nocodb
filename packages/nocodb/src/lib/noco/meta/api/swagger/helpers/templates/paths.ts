import { ModelTypes } from 'nocodb-sdk';

export default (ctx: {
  tableName: string;
  orgs: string;
  type: ModelTypes;
  projectName: string;
}): any => ({
  [`/api/v1/db/data/${ctx.orgs}/${ctx.projectName}/${ctx.tableName}`]: {
    get: {
      summary: `Row list`,
      operationId: 'db-table-row-list',
      description: `List of all rows from ${ctx.tableName} ${ctx.type} and data of fields can be filtered based on query params.`,
      tags: [ctx.tableName],
      parameters: [
        {
          schema: {
            type: 'array'
          },
          in: 'query',
          name: 'fields',
          description:
            'Array of field names or comma separated filed names to include in the response objects.',
          example: 'field1,field2'
        },
        {
          schema: {
            type: 'array'
          },
          in: 'query',
          name: 'sort',
          description:
            'Comma separated field names to sort rows, rows will sort in ascending order based on provided columns. To sort in descending order provide `-` prefix along with column name, like `-field`',
          example: 'field1,-field2'
        },
        {
          schema: {
            type: 'string'
          },
          in: 'query',
          name: 'where',
          description: '',
          example: '(field1,eq,value)'
        }
      ],
      responses: {
        '200': {
          description: 'OK',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  $ref: `#/components/schemas/${ctx.tableName}Response`
                }
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
    parameters: [
      {
        schema: {
          type: 'string'
        },
        name: 'rowId',
        in: 'path',
        required: true
      }
    ],
    ...(ctx.type === ModelTypes.TABLE
      ? {
          get: {
            summary: `Row read`,
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
            description: '',
            tags: [ctx.tableName]
          },
          patch: {
            summary: `Row update`,
            operationId: `${ctx.tableName.toLowerCase()}-update`,
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
      description: '',
      tags: [ctx.tableName],
      parameters: [
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
    }
  },
  ...(ctx.type === ModelTypes.TABLE
    ? {
        [`/api/v1/db/data/bulk/${ctx.orgs}/${ctx.projectName}/${ctx.tableName}`]: {
          post: {
            summary: 'Bulk insert',
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
            summary: 'Bulk update by IDs',
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
          parameters: [],
          patch: {
            summary: 'Bulk update with conditions',
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
        [`/api/v1/db/data/${ctx.orgs}/${ctx.projectName}/${ctx.tableName}/{rowId}/{relationType}/{columnName}`]: {
          parameters: [
            {
              schema: {
                type: 'string'
              },
              name: 'rowId',
              in: 'path',
              required: true
            },
            {
              schema: {
                type: 'string',
                enum: ['mm', 'hm']
              },
              name: 'relationType',
              in: 'path',
              required: true
            },
            {
              schema: {
                type: 'string'
              },
              name: 'columnName',
              in: 'path',
              required: true
            }
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
            parameters: [
              {
                schema: {
                  type: 'string'
                },
                in: 'query',
                name: 'limit'
              },
              {
                schema: {
                  type: 'string'
                },
                in: 'query',
                name: 'offset'
              }
            ]
          }
        },
        [`/api/v1/db/data/${ctx.orgs}/${ctx.projectName}/${ctx.tableName}/{rowId}/{relationType}/{columnName}/{refRowId}`]: {
          parameters: [
            {
              schema: {
                type: 'string'
              },
              name: 'rowId',
              in: 'path',
              required: true
            },
            {
              schema: {
                type: 'string',
                enum: ['mm', 'hm']
              },
              name: 'relationType',
              in: 'path',
              required: true
            },
            {
              schema: {
                type: 'string'
              },
              name: 'columnName',
              in: 'path',
              required: true
            },
            {
              schema: {
                type: 'string'
              },
              name: 'refRowId',
              in: 'path',
              required: true
            }
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
            parameters: [
              {
                schema: {
                  type: 'string'
                },
                in: 'query',
                name: 'limit'
              },
              {
                schema: {
                  type: 'string'
                },
                in: 'query',
                name: 'offset'
              }
            ],
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
            {
              schema: {
                type: 'string'
              },
              name: 'rowId',
              in: 'path',
              required: true
            },
            {
              schema: {
                type: 'string',
                enum: ['mm', 'hm']
              },
              name: 'relationType',
              in: 'path',
              required: true
            },
            {
              schema: {
                type: 'string'
              },
              name: 'columnName',
              in: 'path',
              required: true
            }
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
            parameters: [
              {
                schema: {
                  type: 'string'
                },
                in: 'query',
                name: 'limit'
              },
              {
                schema: {
                  type: 'string'
                },
                in: 'query',
                name: 'offset'
              }
            ]
          }
        }
      }
    : {}),
  [`/api/v1/db/data/${ctx.orgs}/${ctx.projectName}/${ctx.tableName}/export/{type}`]: {
    parameters: [
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
      summary: 'Rows export',
      operationId: `${ctx.tableName.toLowerCase()}-csv-export`,
      description: 'CSV or Excel export',
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

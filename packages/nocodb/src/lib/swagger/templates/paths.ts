export default (ctx: {
  tableName: string;
  orgs: string;
  projectName: string;
  columns: Array<{ type: string; title: string }>;
}): any => ({
  [`/api/v1/db/data/${ctx.orgs}/${ctx.projectName}/${ctx.tableName}`]: {
    parameters: [],
    get: {
      summary: `${ctx.tableName} list`,
      operationId: 'db-table-row-list',
      description: '',
      tags: [ctx.tableName],
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
      summary: '${ctx.tableName} create',
      operationId: 'db-table-row-create',
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
  [`/api/v1/db/data/${ctx.orgs}/${ctx.projectName}/${ctx.tableName}/count`]: {
    parameters: [],
    get: {
      summary: 'table rows count',
      operationId: 'db-table-row-count',
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
  [`/api/v1/db/data/${ctx.orgs}/${ctx.projectName}/${ctx.tableName}/views/{viewName}`]: {
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
  [`/api/v1/db/data/${ctx.orgs}/${ctx.projectName}/${ctx.tableName}/views/{viewName}/count`]: {
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
  [`/api/v1/db/data/${ctx.orgs}/${ctx.projectName}/${ctx.tableName}/views/{viewName}/{rowId}`]: {
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
    get: {
      summary: '${ctx.tableName} read',
      operationId: 'db-table-row-read',
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
      tags: [ctx.tableName]
    },
    patch: {
      summary: '${ctx.tableName} update',
      operationId: 'db-table-row-update',
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
      summary: '${ctx.tableName} delete',
      operationId: 'db-table-row-delete',
      responses: {
        '200': {
          description: 'OK'
        }
      },
      tags: [ctx.tableName],
      description: ''
    }
  },
  [`/api/v1/db/data/bulk/${ctx.orgs}/${ctx.projectName}/${ctx.tableName}`]: {
    parameters: [],
    post: {
      summary: 'Bulk insert table rows',
      operationId: 'db-table-row-bulk-create',
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
      summary: 'Bulk update all table rows by IDs',
      operationId: 'db-table-row-bulk-update',
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
      summary: 'Bulk delete all table rows by IDs',
      operationId: 'db-table-row-bulk-delete',
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
      summary: 'Bulk update all table rows with conditions',
      operationId: 'db-table-row-bulk-update-all',
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
      summary: 'Bulk delete all table rows with conditions',
      operationId: 'db-table-row-bulk-delete-all',
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
  [`/api/v1/db/data/${ctx.orgs}/${ctx.projectName}/${ctx.tableName}/views/{viewName}/export/{type}`]: {
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
  },
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
      summary: 'Tablerows export',
      operationId: 'db-table-row-csv-export',
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
      summary: 'Nested relations row list',
      operationId: 'db-table-row-nested-list',
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
      summary: 'Nested relations row add',
      operationId: 'db-table-row-nested-add',
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
      summary: 'Nested relations row remove',
      operationId: 'db-table-row-nested-remove',
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
      operationId: 'db-table-row-nested-children-excluded-list',
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
});

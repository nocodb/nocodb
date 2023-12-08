import BaseRender from '../../BaseRender';
import SwaggerTypes from './SwaggerTypes';

class SwaggerXc extends BaseRender {
  /**
   *
   * @param dir
   * @param filename
   * @param ct
   * @param ctx.tn
   * @param ctx.columns
   * @param ctx.relations
   */
  constructor({ dir = '', filename = '', ctx }: any) {
    super({ dir, filename, ctx });
  }

  /**
   *  Prepare variables used in code template
   */
  prepare() {
    let data: any = {};

    /* run of simple variable */
    data = this.ctx;
    data.paths = {};

    data.definitions = {
      func: this._renderDefinitions.bind(this),
      args: {
        tn: this.ctx.tn,
        columns: this.ctx.columns,
        relations: this.ctx.relations,
        dbType: this.ctx.dbType,
      },
    };

    return data;
  }

  /**
   *
   * @param args
   * @param args.columns
   * @param args.relations
   * @returns {string}
   * @private
   */
  _renderDefinitions(args) {
    const obj = this.getDefenitions(args);

    return JSON.stringify(obj);
  }

  getDefenitions(args) {
    const obj = {
      [args._tn]: {
        type: 'object',
        properties: {},
      },
      [`${args._tn}Nested`]: {
        type: 'object',
        properties: {},
      },
    };

    let properties = obj[args._tn].properties;

    for (const column of args.columns) {
      const field: any = {};

      SwaggerTypes.setSwaggerType(column, field, args.dbType);

      if (column.rqd) {
        field.nullable = false;
      }

      if (column.ai) {
        field.readOnly = true;
      }

      properties[column._cn] = field;
    }

    properties = Object.assign(obj[`${args._tn}Nested`].properties, properties);
    for (const column of args.v || []) {
      const field: any = {};
      field.readOnly = true;
      let _cn = column._cn;

      if (column.mm) {
        field.type = 'array';
        field.items = {
          $ref: `#/definitions/${column.mm?._rtn}`,
        };
        _cn = `${column.mm?._rtn}MMList`;
      } else if (column.hm) {
        field.type = 'array';
        field.items = {
          $ref: `#/definitions/${column.hm?._tn}`,
        };
        field.$ref = `#/definitions/${column.hm?._tn}`;
        _cn = `${column.hm?._tn}List`;
      } else if (column.bt) {
        field.$ref = `#/definitions/${column.bt?._rtn}`;
        _cn = `${column.bt?._rtn}Read`;
      }

      properties[_cn] = field;
    }

    return obj;
  }

  getObject() {
    return {
      tags: [
        {
          name: `${this.ctx._tn}`,
          description: `Everything about your ${this.ctx._tn}`,
        },
      ],
      paths: {
        [`/nc/${this.ctx.base_id}/api/${this.ctx.routeVersionLetter}/${this.ctx._tn}`]:
          {
            post: {
              tags: [`${this.ctx._tn}`],
              summary: `Add a new ${this.ctx._tn}`,
              description: '',
              operationId: `add${this.ctx._tn}`,
              consumes: ['application/json'],
              produces: ['application/json'],
              parameters: [
                {
                  in: 'body',
                  name: 'body',
                  description: `${this.ctx._tn} object that needs to add`,
                  required: true,
                  schema: {
                    $ref: `#/definitions/${this.ctx._tn}`,
                  },
                },
              ],
              responses: {
                '405': {
                  description: 'Invalid input',
                },
              },
            },
            get: {
              tags: [`${this.ctx._tn}`],
              summary: 'Get list',
              description: '',
              operationId: `get${this.ctx._tn}`,
              consumes: ['application/json'],
              produces: ['application/json'],
              parameters: [
                {
                  in: 'query',
                  name: 'fields',
                  type: 'string',
                  description: 'Comma separated fields from the model',
                },
                {
                  in: 'query',
                  name: 'bt',
                  type: 'string',
                  description: 'Comma separated parent table names(Belongs To)',
                },
                {
                  in: 'query',
                  name: 'hm',
                  type: 'string',
                  description: 'Comma separated child table names(Has Many)',
                },
                {
                  in: 'query',
                  name: 'mm',
                  type: 'string',
                  description:
                    'Comma separated child table names(Many to Many)',
                },
                {
                  in: 'query',
                  name: 'where',
                  type: 'string',
                  description: 'Where expression',
                },
                {
                  in: 'query',
                  name: 'limit',
                  description: 'Page size limit',
                  type: 'integer',
                  format: 'int64',
                },
                {
                  in: 'query',
                  name: 'offset',
                  description: 'Pagination offset',
                  type: 'integer',
                  format: 'int64',
                },
                {
                  in: 'query',
                  name: 'sort',
                  description: 'Comma separated sort fields',
                  type: 'string',
                },
              ],
              responses: {
                '405': {
                  description: 'Invalid input',
                },
                '200': {
                  description: 'successful operation',
                  schema: {
                    type: 'array',
                    items: {
                      $ref: `#/definitions/${this.ctx._tn}Nested`,
                    },
                  },
                },
              },
            },
          },
        [`/nc/${this.ctx.base_id}/api/${this.ctx.routeVersionLetter}/${this.ctx._tn}/{${this.ctx._tn}Id}`]:
          {
            get: {
              tags: [`${this.ctx._tn}`],
              summary: `Find ${this.ctx._tn} by ID`,
              description: `Returns a single ${this.ctx._tn}`,
              operationId: `get${this.ctx._tn}ById`,
              produces: ['application/json'],
              parameters: [
                {
                  name: `${this.ctx._tn}Id`,
                  in: 'path',
                  description: `ID of ${this.ctx._tn} to return. In case of composite key provide keys separated by ___`,
                  required: true,
                  type: 'string',
                },
                {
                  in: 'query',
                  name: 'bt',
                  type: 'string',
                  description: 'Comma separated parent table names(Belongs To)',
                },
                {
                  in: 'query',
                  name: 'hm',
                  type: 'string',
                  description: 'Comma separated child table names(Has Many)',
                },
                {
                  in: 'query',
                  name: 'mm',
                  type: 'string',
                  description:
                    'Comma separated child table names(Many to Many)',
                },
              ],
              responses: {
                '200': {
                  description: 'successful operation',
                  schema: {
                    $ref: `#/definitions/${this.ctx._tn}Nested`,
                  },
                },
                '400': {
                  description: 'Invalid ID supplied',
                },
                '404': {
                  description: `${this.ctx._tn} not found`,
                },
              },
            },
            put: {
              tags: [`${this.ctx._tn}`],
              summary: `Updates a ${this.ctx._tn}`,
              description: '',
              operationId: `update${this.ctx._tn}`,
              consumes: ['application/json'],
              produces: ['application/json'],
              parameters: [
                {
                  name: `${this.ctx._tn}Id`,
                  in: 'path',
                  description: `ID of ${this.ctx._tn} to return. In case of composite key provide keys separated by ___`,
                  required: true,
                  type: 'string',
                },
                {
                  in: 'body',
                  name: 'body',
                  description: `${this.ctx._tn} object that needs to be added to the store`,
                  required: true,
                  schema: {
                    $ref: `#/definitions/${this.ctx._tn}`,
                  },
                },
              ],
              responses: {
                '405': {
                  description: 'Invalid input',
                },
              },
            },
            delete: {
              tags: [`${this.ctx._tn}`],
              summary: `Deletes a ${this.ctx._tn}`,
              description: '',
              operationId: `delete${this.ctx._tn}`,
              produces: ['application/json'],
              parameters: [
                {
                  name: `${this.ctx._tn}Id`,
                  in: 'path',
                  description: `ID of ${this.ctx._tn} to return. In case of composite key provide keys separated by ___`,
                  required: true,
                  type: 'string',
                },
              ],
              responses: {
                '400': {
                  description: 'Invalid ID supplied',
                },
                '404': {
                  description: `${this.ctx._tn} not found`,
                },
              },
            },
          },

        [`/nc/${this.ctx.base_id}/api/${this.ctx.routeVersionLetter}/${this.ctx._tn}/bulk`]:
          {
            post: {
              tags: [`${this.ctx._tn}`],
              summary: `Bulk ${this.ctx._tn} insert`,
              description: '',
              operationId: `bulk${this.ctx._tn}Insert`,
              consumes: ['application/json'],
              produces: ['application/json'],
              parameters: [
                {
                  in: 'body',
                  name: 'body',
                  description: `${this.ctx._tn} objects`,
                  required: true,
                  schema: {
                    type: 'array',
                    items: {
                      $ref: `#/definitions/${this.ctx._tn}`,
                    },
                  },
                },
              ],
              responses: {
                '405': {
                  description: 'Invalid input',
                },
              },
            },
            put: {
              tags: [`${this.ctx._tn}`],
              summary: `Bulk ${this.ctx._tn} update`,
              description: '',
              operationId: `bulk${this.ctx._tn}Update`,
              consumes: ['application/json'],
              produces: ['application/json'],
              parameters: [
                {
                  in: 'body',
                  name: 'body',
                  description: `${this.ctx._tn} objects with id`,
                  required: true,
                  schema: {
                    type: 'array',
                    items: {
                      $ref: `#/definitions/${this.ctx._tn}`,
                    },
                  },
                },
              ],
              responses: {
                '405': {
                  description: 'Invalid input',
                },
              },
            },
            delete: {
              tags: [`${this.ctx._tn}`],
              summary: `Bulk ${this.ctx._tn} delete`,
              description: '',
              operationId: `bulk${this.ctx._tn}Delete`,
              produces: ['application/json'],
              parameters: [
                {
                  in: 'body',
                  name: 'body',
                  description: `${this.ctx._tn} objects contains id`,
                  required: true,
                  schema: {
                    type: 'array',
                    items: {
                      $ref: `#/definitions/${this.ctx._tn}`,
                    },
                  },
                },
              ],
              responses: {
                '400': {
                  description: 'Invalid ID supplied',
                },
                '404': {
                  description: `${this.ctx._tn} not found`,
                },
              },
            },
          },
        [`/nc/${this.ctx.base_id}/api/${this.ctx.routeVersionLetter}/${this.ctx._tn}/findOne`]:
          {
            get: {
              tags: [`${this.ctx._tn}`],
              summary: 'Get first one from filtered data',
              description: '',
              operationId: `findOne${this.ctx._tn}`,
              consumes: ['application/json'],
              produces: ['application/json'],
              parameters: [
                {
                  in: 'query',
                  name: 'fields',
                  type: 'string',
                  description: 'Comma separated fields from the model',
                },
                {
                  in: 'query',
                  name: 'where',
                  type: 'string',
                  description: 'Where expression',
                },
                {
                  in: 'query',
                  name: 'limit',
                  description: 'Page size limit',
                  type: 'integer',
                  format: 'int64',
                },
                {
                  in: 'query',
                  name: 'offset',
                  description: 'Pagination offset',
                  type: 'integer',
                  format: 'int64',
                },
                {
                  in: 'query',
                  name: 'sort',
                  description: 'Comma separated sort fields',
                  type: 'string',
                },
              ],
              responses: {
                '405': {
                  description: 'Invalid input',
                },
                '200': {
                  description: 'successful operation',
                  schema: {
                    $ref: `#/definitions/${this.ctx._tn}`,
                  },
                },
              },
            },
          },
        [`/nc/${this.ctx.base_id}/api/${this.ctx.routeVersionLetter}/${this.ctx._tn}/{${this.ctx._tn}Id}/exists`]:
          {
            get: {
              tags: [`${this.ctx._tn}`],
              summary: `Check ${this.ctx._tn} with provided ID exists`,
              description: `Returns a single ${this.ctx._tn}`,
              operationId: `check${this.ctx._tn}Exists`,
              produces: ['application/json'],
              parameters: [
                {
                  name: `${this.ctx._tn}Id`,
                  in: 'path',
                  description: `ID of ${this.ctx._tn} to return. In case of composite key provide keys separated by ___`,
                  required: true,
                  type: 'string',
                },
              ],
              responses: {
                '200': {
                  description: 'successful operation',
                  schema: {
                    type: 'boolean',
                  },
                },
              },
            },
          },
        [`/nc/${this.ctx.base_id}/api/${this.ctx.routeVersionLetter}/${this.ctx._tn}/count`]:
          {
            get: {
              tags: [`${this.ctx._tn}`],
              summary: `Get ${this.ctx._tn} count`,
              operationId: `get${this.ctx._tn}Count`,
              consumes: ['application/json'],
              produces: ['application/json'],
              parameters: [
                {
                  in: 'query',
                  name: 'where',
                  type: 'string',
                  description: 'Where expression',
                },
              ],
              responses: {
                '405': {
                  description: 'Invalid input',
                },
                '200': {
                  description: 'successful operation',
                  schema: {
                    type: 'object',
                  },
                },
              },
            },
          },
        [`/nc/${this.ctx.base_id}/api/${this.ctx.routeVersionLetter}/${this.ctx._tn}/groupby`]:
          {
            get: {
              tags: [`${this.ctx._tn}`],
              summary: 'Group by column',
              description: '',
              operationId: `${this.ctx._tn}GroupByColumn`,
              consumes: ['application/json'],
              produces: ['application/json'],
              parameters: [
                {
                  in: 'query',
                  name: 'column_name',
                  type: 'string',
                  description: 'Column name',
                },
                {
                  in: 'query',
                  name: 'where',
                  type: 'string',
                  description: 'Where expression',
                },
                {
                  in: 'query',
                  name: 'limit',
                  description: 'Page size limit',
                  type: 'integer',
                  format: 'int64',
                },
                {
                  in: 'query',
                  name: 'offset',
                  description: 'Pagination offset',
                  type: 'integer',
                  format: 'int64',
                },
                {
                  in: 'query',
                  name: 'sort',
                  description: 'Comma separated sort fieldst',
                  type: 'string',
                },
              ],
              responses: {
                '405': {
                  description: 'Invalid input',
                },
                '200': {
                  description: 'successful operation',
                  schema: {
                    $ref: `#/definitions/${this.ctx._tn}`,
                  },
                },
              },
            },
          },
        [`/nc/${this.ctx.base_id}/api/${this.ctx.routeVersionLetter}/${this.ctx._tn}/distribution`]:
          {
            get: {
              tags: [`${this.ctx._tn}`],
              summary: '',
              description: '',
              operationId: `${this.ctx._tn}Distribution`,
              consumes: ['application/json'],
              produces: ['application/json'],
              parameters: [
                {
                  in: 'query',
                  name: 'column_name',
                  type: 'string',
                  description: 'Column name',
                },
                {
                  in: 'query',
                  name: 'min',
                  description: 'min value',
                  type: 'integer',
                  format: 'int64',
                },
                {
                  in: 'query',
                  name: 'max',
                  description: 'max value',
                  type: 'integer',
                  format: 'int64',
                },
                {
                  in: 'query',
                  name: 'step',
                  description: 'step value',
                  type: 'integer',
                  format: 'int64',
                },
                {
                  in: 'query',
                  name: 'steps',
                  description: 'steps value',
                  type: 'integer',
                  format: 'int64',
                },
                {
                  in: 'query',
                  name: 'func',
                  description: 'comma separated aggregation functions',
                  type: 'string',
                },
              ],
              responses: {
                '405': {
                  description: 'Invalid input',
                },
                '200': {
                  description: 'successful operation',
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
        [`/nc/${this.ctx.base_id}/api/${this.ctx.routeVersionLetter}/${this.ctx._tn}/distinct`]:
          {
            get: {
              tags: [`${this.ctx._tn}`],
              summary: 'Get first one from filtered data',
              description: '',
              operationId: `${this.ctx._tn}Distinct`,
              consumes: ['application/json'],
              produces: ['application/json'],
              parameters: [
                {
                  in: 'query',
                  name: 'column_name',
                  type: 'string',
                  description: 'Column name',
                },
                {
                  in: 'query',
                  name: 'where',
                  type: 'string',
                  description: 'Where expression',
                },
                {
                  in: 'query',
                  name: 'limit',
                  description: 'Page size limit',
                  type: 'integer',
                  format: 'int64',
                },
                {
                  in: 'query',
                  name: 'offset',
                  description: 'Pagination offset',
                  type: 'integer',
                  format: 'int64',
                },
                {
                  in: 'query',
                  name: 'sort',
                  description: 'Comma separated sort fields',
                  type: 'string',
                },
              ],
              responses: {
                '405': {
                  description: 'Invalid input',
                },
                '200': {
                  description: 'successful operation',
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                    },
                  },
                },
              },
            },
          },
        [`/nc/${this.ctx.base_id}/api/${this.ctx.routeVersionLetter}/${this.ctx._tn}/aggregate`]:
          {
            get: {
              tags: [`${this.ctx._tn}`],
              summary: 'Get first one from filtered data',
              description: '',
              operationId: `${this.ctx._tn}Aggregate`,
              consumes: ['application/json'],
              produces: ['application/json'],
              parameters: [
                {
                  in: 'query',
                  name: 'column_name',
                  type: 'string',
                  description: 'Column name',
                },
                {
                  in: 'query',
                  name: 'func',
                  type: 'string',
                  description: 'Comma separated aggregate functions',
                },
                {
                  in: 'query',
                  name: 'having',
                  type: 'string',
                  description: 'Having expression',
                },
                {
                  in: 'query',
                  name: 'fields',
                  type: 'string',
                  description: 'Comma separated fields from the model',
                },
                {
                  in: 'query',
                  name: 'limit',
                  description: 'Page size limit',
                  type: 'integer',
                  format: 'int64',
                },
                {
                  in: 'query',
                  name: 'offset',
                  description: 'Pagination offset',
                  type: 'integer',
                  format: 'int64',
                },
                {
                  in: 'query',
                  name: 'sort',
                  description: 'Comma separated sort fields',
                  type: 'string',
                },
              ],
              responses: {
                '405': {
                  description: 'Invalid input',
                },
                '200': {
                  description: 'successful operation',
                  schema: {
                    $ref: `#/definitions/${this.ctx._tn}`,
                  },
                },
              },
            },
          },
      },
      definitions: this.getDefenitions(this.ctx),
    };
  }
}

export default SwaggerXc;

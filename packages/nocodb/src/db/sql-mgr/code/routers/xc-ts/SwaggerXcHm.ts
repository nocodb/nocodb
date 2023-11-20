import BaseRender from '../../BaseRender';

class SwaggerXcHm extends BaseRender {
  /**
   *
   * @param dir
   * @param filename
   * @param ct
   * @param ctx.tn
   * @param ctx.columns
   * @param ctx.relations
   */
  constructor({ dir, filename, ctx }: any) {
    super({ dir, filename, ctx });
  }

  /**
   *  Prepare variables used in code template
   */
  prepare() {
    let data: any = {};

    /* run of simple variable */
    data = this.ctx;

    data.definitions = {
      func: this._renderDefinitions.bind(this),
      args: {
        tn: this.ctx.tn,
        columns: this.ctx.columns,
        relations: this.ctx.relations,
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
  _renderDefinitions(_args) {
    const obj = {};

    return JSON.stringify(obj);
  }

  getObject() {
    return {
      tags: [
        {
          name: `${this.ctx._tn}HasMany${this.ctx._ctn}`,
          description: 'Everything about has many relation',
        },
      ],
      paths: {
        [`/nc/${this.ctx.base_id}/api/${this.ctx.routeVersionLetter}/${this.ctx._tn}/has/${this.ctx._ctn}`]:
          {
            get: {
              tags: [`${this.ctx._tn}HasMany${this.ctx._ctn}`],
              summary: `Get ${this.ctx._tn} list with ${this.ctx._ctn} children`,
              description: '',
              operationId: `${this.ctx._tn}HasMany${this.ctx._ctn}List`,
              produces: ['application/json'],
              parameters: [
                {
                  in: 'query',
                  name: 'fields',
                  type: 'String',
                  description: 'Comma separated fields of model',
                },
                {
                  in: 'query',
                  name: 'where',
                  type: 'String',
                  description: 'Where expression',
                },
                {
                  in: 'query',
                  name: 'limit',
                  description: 'page size limit',
                  type: 'integer',
                  format: 'int64',
                },
                {
                  in: 'query',
                  name: 'offset',
                  description: 'pagination offset',
                  type: 'integer',
                  format: 'int64',
                },
                {
                  in: 'query',
                  name: 'sort',
                  description: 'sort parameter',
                  type: 'string',
                },
              ],
              responses: {
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
        [`/nc/${this.ctx.base_id}/api/${this.ctx.routeVersionLetter}/${this.ctx._tn}/{${this.ctx._tn}Id}/${this.ctx._ctn}`]:
          {
            get: {
              tags: [`${this.ctx._tn}HasMany${this.ctx._ctn}`],
              summary: `Find ${this.ctx._ctn} list by parent ${this.ctx._tn} id`,
              description: `Returns a single ${this.ctx._tn}`,
              operationId: `get${this.ctx._ctn}By${this.ctx._tn}Id`,
              produces: ['application/json'],
              parameters: [
                {
                  name: `${this.ctx._tn}Id`,
                  in: 'path',
                  description: `ID of ${this.ctx._tn} to return`,
                  required: true,
                  type: 'integer',
                  format: 'int64',
                },
                {
                  in: 'query',
                  name: 'fields',
                  type: 'String',
                  description: 'Comma separated fields of model',
                },
                {
                  in: 'query',
                  name: 'where',
                  type: 'String',
                  description: 'Where expression',
                },
                {
                  in: 'query',
                  name: 'limit',
                  description: 'page size limit',
                  type: 'integer',
                  format: 'int64',
                },
                {
                  in: 'query',
                  name: 'offset',
                  description: 'pagination offset',
                  type: 'integer',
                  format: 'int64',
                },
                {
                  in: 'query',
                  name: 'sort',
                  description: 'sort parameter',
                  type: 'string',
                },
              ],
              responses: {
                '200': {
                  description: 'successful operation',
                  schema: {
                    type: 'array',
                    items: 'object',
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
            post: {
              tags: [`${this.ctx._tn}HasMany${this.ctx._ctn}`],
              summary: `Insert ${this.ctx._ctn} under a parent ${this.ctx._tn}`,
              description: `Returns a single ${this.ctx._tn}`,
              operationId: `insert${this.ctx._ctn}By${this.ctx._tn}Id`,
              consumes: ['application/json'],
              produces: ['application/json'],
              parameters: [
                {
                  in: 'body',
                  name: 'body',
                  description: `${this.ctx._ctn} object to insert`,
                  required: true,
                  schema: {
                    type: 'object',
                  },
                },
                {
                  name: `${this.ctx._tn}Id`,
                  in: 'path',
                  description: `ID of ${this.ctx._tn} to return`,
                  required: true,
                  type: 'integer',
                  format: 'int64',
                },
              ],
              responses: {
                '200': {
                  description: 'successful operation',
                  schema: {
                    type: 'object',
                  },
                },
              },
            },
          },
        [`/nc/${this.ctx.base_id}/api/${this.ctx.routeVersionLetter}/${this.ctx._tn}/{${this.ctx._tn}Id}/${this.ctx._ctn}/{${this.ctx._ctn}Id}`]:
          {
            get: {
              tags: [`${this.ctx._tn}HasMany${this.ctx._ctn}`],
              summary: `Get by ${this.ctx._ctn} id parent ${this.ctx._tn} id`,
              description: `Returns a single ${this.ctx._tn}`,
              operationId: `get${this.ctx._ctn}ByIdAnd${this.ctx._tn}Id`,
              produces: ['application/json'],
              parameters: [
                {
                  name: `${this.ctx._tn}Id`,
                  in: 'path',
                  description: `ID of parent ${this.ctx._tn}`,
                  required: true,
                  type: 'integer',
                  format: 'int64',
                },
                {
                  name: `${this.ctx._ctn}Id`,
                  in: 'path',
                  description: `ID of ${this.ctx._ctn}`,
                  required: true,
                  type: 'integer',
                  format: 'int64',
                },
              ],
              responses: {
                '200': {
                  description: 'successful operation',
                  schema: {
                    type: 'array',
                    items: 'object',
                  },
                },
              },
            },
            delete: {
              tags: [`${this.ctx._tn}HasMany${this.ctx._ctn}`],
              summary: `Delete by ${this.ctx._ctn} id parent ${this.ctx._tn} id`,
              description: `Returns a single ${this.ctx._tn}`,
              operationId: `delete${this.ctx._ctn}ByIdAnd${this.ctx._tn}Id`,
              produces: ['application/json'],
              parameters: [
                {
                  name: `${this.ctx._tn}Id`,
                  in: 'path',
                  description: `ID of parent ${this.ctx._tn}`,
                  required: true,
                  type: 'integer',
                  format: 'int64',
                },
                {
                  name: `${this.ctx._ctn}Id`,
                  in: 'path',
                  description: `ID of c${this.ctx._ctn}`,
                  required: true,
                  type: 'integer',
                  format: 'int64',
                },
              ],
              responses: {
                '200': {
                  description: 'successful operation',
                },
              },
            },
            put: {
              tags: [`${this.ctx._tn}HasMany${this.ctx._ctn}`],
              summary: `Update ${this.ctx._ctn} under a parent ${this.ctx._tn}`,
              description: `Returns a single ${this.ctx._tn}`,
              operationId: `update${this.ctx._ctn}ByIdAnd${this.ctx._tn}Id`,
              consumes: ['application/json'],
              produces: ['application/json'],
              parameters: [
                {
                  in: 'body',
                  name: 'body',
                  description: `${this.ctx._ctn} object to insert`,
                  required: true,
                  schema: {
                    type: 'object',
                  },
                },
                {
                  name: `${this.ctx._tn}Id`,
                  in: 'path',
                  description: `ID of ${this.ctx._tn} to return`,
                  required: true,
                  type: 'integer',
                  format: 'int64',
                },
                {
                  name: `${this.ctx._ctn}Id`,
                  in: 'path',
                  description: `ID of ${this.ctx._ctn}`,
                  required: true,
                  type: 'integer',
                  format: 'int64',
                },
              ],
              responses: {
                '200': {
                  description: 'successful operation',
                  schema: {
                    type: 'object',
                  },
                },
              },
            },
          },
        [`/nc/${this.ctx.base_id}/api/${this.ctx.routeVersionLetter}/${this.ctx._tn}/{${this.ctx._tn}Id}/${this.ctx._ctn}/{${this.ctx._ctn}Id}/exists`]:
          {
            get: {
              tags: [`${this.ctx._tn}HasMany${this.ctx._ctn}`],
              summary: `Check row exists by ${this.ctx._ctn} id and parent ${this.ctx._tn} id`,
              description: '',
              operationId: `exists${this.ctx._ctn}ByIdAnd${this.ctx._tn}Id`,
              produces: ['application/json'],
              parameters: [
                {
                  name: `${this.ctx._tn}Id`,
                  in: 'path',
                  description: `ID of parent ${this.ctx._tn}`,
                  required: true,
                  type: 'integer',
                  format: 'int64',
                },
                {
                  name: `${this.ctx._ctn}Id`,
                  in: 'path',
                  description: `ID of ${this.ctx._ctn}`,
                  required: true,
                  type: 'integer',
                  format: 'int64',
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
        [`/nc/${this.ctx.base_id}/api/${this.ctx.routeVersionLetter}/${this.ctx._tn}/{${this.ctx._tn}Id}/${this.ctx._ctn}/findOne`]:
          {
            get: {
              tags: [`${this.ctx._tn}HasMany${this.ctx._ctn}`],
              summary: `Find one ${this.ctx._ctn} by parent ${this.ctx._tn} id and filters`,
              description: '',
              operationId: `findOne${this.ctx._ctn}By${this.ctx._tn}Id`,
              produces: ['application/json'],
              parameters: [
                {
                  name: `${this.ctx._tn}Id`,
                  in: 'path',
                  description: `ID of parent ${this.ctx._tn}`,
                  required: true,
                  type: 'integer',
                  format: 'int64',
                },
                {
                  in: 'query',
                  name: 'fields',
                  type: 'String',
                  description: 'Comma separated fields of model',
                },
                {
                  in: 'query',
                  name: 'where',
                  type: 'String',
                  description: 'Where expression',
                },
                {
                  in: 'query',
                  name: 'limit',
                  description: 'page size limit',
                  type: 'integer',
                  format: 'int64',
                },
                {
                  in: 'query',
                  name: 'offset',
                  description: 'pagination offset',
                  type: 'integer',
                  format: 'int64',
                },
                {
                  in: 'query',
                  name: 'sort',
                  description: 'sort parameter',
                  type: 'string',
                },
              ],
              responses: {
                '200': {
                  description: 'successful operation',
                  schema: {
                    type: 'object',
                  },
                },
              },
            },
          },
        [`/nc/${this.ctx.base_id}/api/${this.ctx.routeVersionLetter}/${this.ctx._tn}/{${this.ctx._tn}Id}/${this.ctx._ctn}/count`]:
          {
            get: {
              tags: [`${this.ctx._tn}HasMany${this.ctx._ctn}`],
              summary: `Get ${this.ctx._ctn} count by parent id and filter`,
              description: '',
              operationId: `getCountWithin${this.ctx._tn}Id`,
              produces: ['application/json'],
              parameters: [
                {
                  name: `${this.ctx._tn}Id`,
                  in: 'path',
                  description: `ID of parent ${this.ctx._tn}`,
                  required: true,
                  type: 'integer',
                  format: 'int64',
                },
                {
                  in: 'query',
                  name: 'where',
                  type: 'String',
                  description: 'Where expression',
                },
                {
                  in: 'query',
                  name: 'limit',
                  description: 'page size limit',
                  type: 'integer',
                  format: 'int64',
                },
                {
                  in: 'query',
                  name: 'offset',
                  description: 'pagination offset',
                  type: 'integer',
                  format: 'int64',
                },
                {
                  in: 'query',
                  name: 'sort',
                  description: 'sort parameter',
                  type: 'string',
                },
              ],
              responses: {
                '200': {
                  description: 'successful operation',
                  schema: {
                    type: 'object',
                  },
                },
              },
            },
          },
      },
      definitions: {},
    };
  }
}

export default SwaggerXcHm;

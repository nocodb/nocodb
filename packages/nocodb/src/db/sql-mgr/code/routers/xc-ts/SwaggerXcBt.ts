import BaseRender from '../../BaseRender';

class SwaggerXcBt extends BaseRender {
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
          name: `${this.ctx._tn}BelongsTo${this.ctx._rtn || this.ctx.rtn}`,
          description: 'Everything about belongs to relation',
        },
      ],
      paths: {
        [`/nc/${this.ctx.base_id}/api/${this.ctx.routeVersionLetter}/${
          this.ctx._tn
        }/belongs/${this.ctx._rtn || this.ctx.rtn}`]: {
          get: {
            tags: [`${this.ctx._tn}BelongsTo${this.ctx._rtn || this.ctx.rtn}`],
            summary: `Get ${this.ctx._tn} list with ${
              this.ctx._rtn || this.ctx.rtn
            } parent`,
            description: '',
            operationId: `${this.ctx._tn}WithParent`,
            produces: ['application/json'],
            parameters: [
              {
                in: 'query',
                name: 'where',
                type: 'String',
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
                description: 'Sort parameter',
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
      },
      definitions: {},
    };
  }
}

export default SwaggerXcBt;

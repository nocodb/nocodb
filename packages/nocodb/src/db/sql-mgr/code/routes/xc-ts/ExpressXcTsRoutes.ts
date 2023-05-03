import BaseRender from '../../BaseRender';

class ExpressXcTsRoutes extends BaseRender {
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

    return data;
  }

  getObject() {
    const ejsData: any = this.prepare();
    const routes = [
      {
        path: `/api/${this.ctx.routeVersionLetter}/${ejsData._tn}`,
        type: 'get',
        handler: ['list'],
        acl: {
          admin: true,
          user: true,
          guest: true,
        },
        functions: [
          `
async function(req, res){
    const data = await req.model.list(req.query);
    res.json(data);
}
        `,
        ],
      },
      {
        path: `/api/${this.ctx.routeVersionLetter}/${ejsData._tn}/findOne`,
        type: 'get',
        handler: ['findOne'],
        acl: {
          admin: true,
          user: true,
          guest: true,
        },
        functions: [
          `
async function(req, res){
    const data = await req.model.findOne(req.query);
    res.json(data);
}
        `,
        ],
      },
      {
        path: `/api/${this.ctx.routeVersionLetter}/${ejsData._tn}/m2mNotChildren/:assoc/:pid`,
        type: 'get',
        handler: ['m2mNotChildren'],
        acl: {
          admin: true,
          user: true,
          guest: true,
        },
        functions: [
          `
                `,
        ],
      },
      {
        path: `/api/${this.ctx.routeVersionLetter}/${ejsData._tn}/groupby/:column_name`,
        type: 'get',
        handler: ['groupby'],
        acl: {
          admin: true,
          user: true,
          guest: true,
        },
        functions: [
          `
async function(req, res){
    const data = await req.model.groupBy({
      ...req.params,
      ...req.query
    });
    res.json(data);
}
        `,
        ],
      },
      {
        path: `/api/${this.ctx.routeVersionLetter}/${ejsData._tn}/count`,
        type: 'get',
        handler: ['count'],
        acl: {
          admin: true,
          user: true,
          guest: true,
        },
        functions: [
          `
async function(req, res){
    const data = await req.model.countByPk({
      ...req.query
    });
    res.json(data);
}
        `,
        ],
      },
      {
        path: `/api/${this.ctx.routeVersionLetter}/${ejsData._tn}/bulk`,
        type: 'post',
        handler: ['bulkInsert'],
        acl: {
          admin: true,
          user: true,
          guest: false,
        },
        functions: [
          `
async function(req, res){
    const data = await req.model.insertb(req.body);
    res.json(data);
}
        `,
        ],
      },
      {
        path: `/api/${this.ctx.routeVersionLetter}/${ejsData._tn}/bulk`,
        type: 'put',
        handler: ['bulkUpdate'],
        acl: {
          admin: true,
          user: true,
          guest: false,
        },
        functions: [
          `
async function(req, res){
    const data = await req.model.updateb(req.body);
    res.json(data);
}
        `,
        ],
      },
      {
        path: `/api/${this.ctx.routeVersionLetter}/${ejsData._tn}/bulk`,
        type: 'delete',
        handler: ['bulkDelete'],
        acl: {
          admin: true,
          user: true,
          guest: false,
        },
        functions: [
          `
async function(req, res){
    const data = await req.model.delb(req.body)
    res.json(data);
}
        `,
        ],
      },
      {
        path: `/api/${this.ctx.routeVersionLetter}/${ejsData._tn}/:id/exists`,
        type: 'get',
        handler: ['exists'],
        acl: {
          admin: true,
          user: true,
          guest: false,
        },
        functions: [
          `
async function(req, res){
    const data = await req.model.exists(req.params.id);
    res.json(data);
}
        `,
        ],
      },
      {
        path: `/api/${this.ctx.routeVersionLetter}/${ejsData._tn}/distinct`,
        type: 'get',
        handler: ['distinct'],
        acl: {
          admin: true,
          user: true,
          guest: true,
        },
        functions: [
          `
async function(req, res){
    const data = await req.model.distinct({
      ...req.query
    });
    res.json(data);
}
        `,
        ],
      },
      {
        path: `/api/${this.ctx.routeVersionLetter}/${ejsData._tn}/distribute`,
        type: 'get',
        handler: ['distribute'],
        acl: {
          admin: true,
          user: true,
          guest: true,
        },
        functions: [
          `
async function(req, res){
    const data = await req.model.distribution({
      ...req.query
    });
    res.json(data);
}
        `,
        ],
      },
      {
        path: `/api/${this.ctx.routeVersionLetter}/${ejsData._tn}/aggregate`,
        type: 'get',
        handler: ['aggregate'],
        acl: {
          admin: true,
          user: true,
          guest: true,
        },
        functions: [
          `
async function(req, res){
    const data = await req.model.aggregate({
      ...req.params,
      ...req.query
    });
    res.json(data);
}
        `,
        ],
      },
      {
        path: `/api/${this.ctx.routeVersionLetter}/${ejsData._tn}/groupby`,
        type: 'get',
        handler: ['groupby'],
        acl: {
          admin: true,
          user: true,
          guest: true,
        },
        functions: [
          `
async function(req, res){
    const data = await req.model.groupBy({
      ...req.params,
      ...req.query
    });
    res.json(data);
}
        `,
        ],
      },
      {
        path: `/api/${this.ctx.routeVersionLetter}/${ejsData._tn}/:id`,
        type: 'get',
        handler: ['get'],
        acl: {
          admin: true,
          user: true,
          guest: true,
        },
        functions: [
          `
async function(req, res){
    const data = await req.model.readByPk(req.params.id);
    res.json(data);
}
        `,
        ],
      },
      {
        path: `/api/${this.ctx.routeVersionLetter}/${ejsData._tn}`,
        type: 'post',
        handler: ['create'],
        acl: {
          admin: true,
          user: true,
          guest: false,
        },
        functions: [
          `
async function(req, res){
    const data = await req.model.insert(req.body, null, req);
    res.json(data);
}
        `,
        ],
      },
      {
        path: `/api/${this.ctx.routeVersionLetter}/${ejsData._tn}/:id`,
        type: 'put',
        handler: ['update'],
        acl: {
          admin: true,
          user: true,
          guest: false,
        },
        functions: [
          `
async function(req, res){
    const data = await req.model.updateByPk(req.params.id, req.body, null, req);
    res.json(data);
}
        `,
        ],
      },
      {
        path: `/api/${this.ctx.routeVersionLetter}/${ejsData._tn}/:id`,
        type: 'delete',
        handler: ['delete'],
        acl: {
          admin: true,
          user: true,
          guest: false,
        },
        functions: [
          `
async function(req, res){
    const data = await req.model.delByPk(req.params.id, null, req);
    res.json(data);
}
        `,
        ],
      },
    ];

    if (this.ctx.type === 'view') {
      return routes.filter(
        ({ type, handler }) =>
          type === 'get' &&
          !handler.includes('exists') &&
          !handler.includes('get'),
      );
    }
    return routes;
  }

  getObjectWithoutFunctions() {
    return this.getObject().map(({ functions, ...rest }) => rest);
  }
}

export default ExpressXcTsRoutes;

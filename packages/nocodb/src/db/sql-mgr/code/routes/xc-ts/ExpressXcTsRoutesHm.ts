import BaseRender from '../../BaseRender';

class ExpressXcTsRoutesHm extends BaseRender {
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
  public prepare(): any {
    let data = {};

    /* run of simple variable */
    data = this.ctx;

    return data;
  }

  public getObject() {
    const ejsData: any = this.prepare();
    return [
      {
        path: `/api/${this.ctx.routeVersionLetter}/${ejsData._tn}/has/:childs`, //  ${ejsData._ctn}
        type: 'get',
        handler: ['hasManyList'],
        acl: {
          admin: true,
          user: true,
          guest: true,
        },
        functions: [
          `
async function(req, res){
    const data = await req.parentModel.hasManyList({
      ...req.query,
      childs: req.childModel.tn
    });
    res.json(data);
}
                `,
        ],
      },
      {
        path: `/api/v1/${ejsData._tn}/:parentId/${ejsData._ctn}`,
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
    const data = await req.parentModel.hasManyChildren({
      child: req.childModel.tn,
      ...req.params,
      ...req.query
    })
    res.json(data);
}
                `,
        ],
      },
      {
        path: `/api/v1/${ejsData._tn}/:parentId/${ejsData._ctn}`,
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
    const data = await req.childModel.insertByFk({
      parentId: req.params.parentId,
      parentTableName: req.parentModel.tn,
      data: req.body
    });
    res.json(data);
}
                `,
        ],
      },
      {
        path: `/api/v1/${ejsData._tn}/:parentId/${ejsData._ctn}/findOne`,
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
    const data = await req.childModel.findOneByFk({
      parentId: req.params.parentId,
      parentTableName: req.parentModel.tn,
      ...req.query
    });
    res.json(data);
}
                `,
        ],
      },
      {
        path: `/api/v1/${ejsData._tn}/:parentId/${ejsData._ctn}/count`,
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
    const data = await req.childModel.countByFk({
      parentId: req.params.parentId,
      parentTableName: req.parentModel.tn,
      ...req.query
    });
    res.json(data);
}
                `,
        ],
      },
      {
        path: `/api/v1/${ejsData._tn}/:parentId/${ejsData._ctn}/:id`,
        type: 'get',
        handler: ['read'],
        acl: {
          admin: true,
          user: true,
          guest: true,
        },
        functions: [
          `
async function(req, res){
    const data = await req.childModel.readByFk({
      parentId: req.params.parentId,
      parentTableName: req.parentModel.tn,
      id: req.params.id
    });
    res.json(data);
}
                `,
        ],
      },
      {
        path: `/api/v1/${ejsData._tn}/:parentId/${ejsData._ctn}/:id`,
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
    const data = await req.childModel.updateByFk({
      parentId: req.params.parentId,
      parentTableName: req.parentModel.tn,
      id: req.params.id,
      data: req.body
    });
    res.json(data);
}
                `,
        ],
      },
      {
        path: `/api/v1/${ejsData._tn}/:parentId/${ejsData._ctn}/:id`,
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
    const data = await req.childModel.delByFk({
      parentId: req.params.parentId,
      parentTableName: req.parentModel.tn,
      id: req.params.id
    });
    res.json(data);
}
                `,
        ],
      },
      {
        path: `/api/v1/${ejsData._tn}/:parentId/${ejsData._ctn}/:id/exists`,
        type: 'get',
        handler: ['exists'],
        acl: {
          admin: true,
          user: true,
          guest: true,
        },
        functions: [
          `
async function(req, res){
    const data = await req.childModel.existsByFk({
      parentId: req.params.parentId,
      parentTableName: req.parentModel.tn,
      id: req.params.id,
      ...req.query
    });
    res.json(data);
}
                `,
        ],
      },
    ];
  }

  public getObjectWithoutFunctions() {
    return this.getObject().map(({ functions, ...rest }) => rest);
  }
}

export default ExpressXcTsRoutesHm;

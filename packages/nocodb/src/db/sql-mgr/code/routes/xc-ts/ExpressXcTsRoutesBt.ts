import BaseRender from '../../BaseRender';

class ExpressXcTsRoutesBt extends BaseRender {
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
    const ejsData = this.prepare();
    return [
      {
        path: `/api/${this.ctx.routeVersionLetter}/${ejsData._tn}/belongs/${ejsData._rtn}`,
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
    const data = await req.childModel.belongsTo({
      parents: req.parentModel.tn,
      ...req.query
    });
    res.json(data);
}
                `,
        ],
      },
    ];
  }

  getObjectWithoutFunctions() {
    return this.getObject().map(({ functions, ...rest }) => rest);
  }
}

export default ExpressXcTsRoutesBt;

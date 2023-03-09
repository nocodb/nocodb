import uniqBy from 'lodash/uniqBy';
import BaseRender from '../../BaseRender';
import type { Acl } from '../../../../../../interface/config';

class ExpressXcMiddleware extends BaseRender {
  /**
   *
   * @param dir
   * @param filename
   * @param ctx
   * @param ctx.tn
   * @param ctx.columns
   * @param ctx.relations
   */
  constructor({ dir, filename, ctx }) {
    super({ dir, filename, ctx });
  }

  /**
   *  Prepare variables used in code template
   */
  prepare() {
    let data: any = {};

    /* run of simple variable */
    data = this.ctx;

    /* for complex code provide a func and args - do derivation within the func cbk */
    data.hasMany = {
      func: this._renderXcHasManyRoutePermissions.bind(this),
      args: {
        tn: this.ctx.tn,
        columns: this.ctx.columns,
        hasMany: this.ctx.hasMany,
        relations: this.ctx.relations,
        routeVersionLetter: this.ctx.routeVersionLetter,
      },
    };

    /* for complex code provide a func and args - do derivation within the func cbk */
    data.belongsTo = {
      func: this._renderXcBelongsToRoutePermissions.bind(this),
      args: {
        dbType: this.ctx.dbType,
        tn: this.ctx.tn,
        columns: this.ctx.columns,
        belongsTo: this.ctx.belongsTo,
        relations: this.ctx.relations,
        routeVersionLetter: this.ctx.routeVersionLetter,
      },
    };

    return data;
  }

  private _renderXcHasManyRoutePermissions(args) {
    let str = '';
    let hmRelations = args.relations
      ? args.relations.filter((r) => r.rtn === args.tn)
      : [];
    if (hmRelations.length > 1)
      hmRelations = uniqBy(hmRelations, function (e) {
        return [e.tn, e.rtn].join();
      });
    for (let i = 0; i < hmRelations.length; ++i) {
      str += `
        '/api/${args.routeVersionLetter}1/${args.tn}/has/${hmRelations[i].tn}' : {get:{admin:true,user:true,guest:true}},
        '/api/${args.routeVersionLetter}1/${args.tn}/:parentId/${hmRelations[i].tn}' : {get:{admin:true,user:true,guest:true},post:{admin:true,user:true,guest:true}},
        '/api/${args.routeVersionLetter}1/${args.tn}/:parentId/${hmRelations[i].tn}/findOne' : {get:{admin:true,user:true,guest:true}},
        '/api/${args.routeVersionLetter}1/${args.tn}/:parentId/${hmRelations[i].tn}/count' : {get:{admin:true,user:true,guest:true}},
        '/api/${args.routeVersionLetter}1/${args.tn}/:parentId/${hmRelations[i].tn}/:id' : {get:{admin:true,user:true,guest:true},put:{admin:true,user:true,guest:true},delete:{admin:true,user:true,guest:true}},
        '/api/${args.routeVersionLetter}1/${args.tn}/:parentId/${hmRelations[i].tn}/:id/exists' : {get:{admin:true,user:true,guest:true}},
      `;
    }

    return str;

    /* iterate over has many relations */
  }

  _renderXcBelongsToRoutePermissions(args) {
    let str = '';
    //
    let btRelations = args.relations
      ? args.relations.filter((r) => r.tn === args.tn)
      : [];
    if (btRelations.length > 1)
      btRelations = uniqBy(btRelations, function (e) {
        return [e.tn, e.rtn].join();
      });
    for (let i = 0; i < btRelations.length; ++i) {
      str += `'/api/${args.routeVersionLetter}1/${args.tn}/belongs/:parents' : {get:{admin:true,user:true,guest:true}},`;
    }
    return str;
  }

  getObject(): Acl {
    return {
      creator: {
        read: true,
        ...(this.ctx.type !== 'view'
          ? {
              create: true,
              update: true,
              delete: true,
            }
          : {}),
      },
      editor: {
        read: true,
        ...(this.ctx.type !== 'view'
          ? {
              create: true,
              update: true,
              delete: true,
            }
          : {}),
      },
      commenter: {
        read: true,
        ...(this.ctx.type !== 'view'
          ? {
              create: false,
              update: false,
              delete: false,
            }
          : {}),
      },
      viewer: {
        read: true,
        ...(this.ctx.type !== 'view'
          ? {
              create: false,
              update: false,
              delete: false,
            }
          : {}),
      },
      guest: {
        read: false,
        ...(this.ctx.type !== 'view'
          ? {
              create: false,
              update: false,
              delete: false,
            }
          : {}),
      },
    };
  }
}

export default ExpressXcMiddleware;

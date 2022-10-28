import autoBind from 'auto-bind';
import Handlebars from 'handlebars';

import { Acls } from '../../../interface/config';

export default class GqlMiddleware {
  private tn: any;
  private acls: Acls;
  private models: any;

  constructor(acls: Acls, tn: string, middleWareBody?: string, models?: any) {
    autoBind(this);
    this.acls = acls;
    this.tn = tn;
    this.models = models;

    if (middleWareBody) {
      Object.defineProperty(this, 'middleware', {
        value: this.generateResolverFromStringBody(middleWareBody),
      });
    }
  }

  private get acl(): any {
    return this.acls?.[this.tn];
  }

  private generateResolverFromStringBody(fnBody: string): any {
    if (!(fnBody && fnBody.length)) {
      return;
    }
    // @ts-ignore
    let handler = (args) => {
      return null;
    };

    try {
      const js = `((${fnBody}).bind(this))`;
      // tslint:disable-next-line:no-eval
      handler = eval(js);
    } catch (e) {
      console.log('Error in GQL Middleware transpilation', e);
    }
    return handler;
  }

  // @ts-ignore
  public async middleware(_args, { req, res, next }, info: any): Promise<any> {
    const replaceEnvVarRec = (obj) => {
      return JSON.parse(JSON.stringify(obj), (_key, value) => {
        return typeof value === 'string'
          ? Handlebars.compile(value, { noEscape: true })({
              req,
              // : {
              //   user: {id: 1} // (req as any).user
              // }
            })
          : value;
      });
    };

    const getOperation = (operation, fieldName) => {
      if (operation === 'mutation') {
        if (fieldName.endsWith('Create')) {
          return 'create';
        } else if (fieldName.endsWith('Update')) {
          return 'update';
        } else if (fieldName.endsWith('Delete')) {
          return 'delete';
        }
      }
      return 'read';
    };

    const roleOperationPossible = (roles, operation, object) => {
      res.locals.xcAcl = null;
      const errors = [];

      for (const [roleName, isAllowed] of Object.entries(roles)) {
        if (!isAllowed) {
          continue;
        }

        try {
          if (typeof this.acl?.[roleName]?.[operation] === 'boolean') {
            if (this.acl[roleName][operation]) {
              return true;
            }
          } else if (
            this.acl?.[roleName]?.[operation] &&
            roleOperationObjectGet(roleName, operation, object)
          ) {
            return true;
          }
        } catch (e) {
          errors.push(e);
        }
      }
      if (errors?.length) {
        throw errors[0];
      }
      return false;
    };

    // @ts-ignore
    const roleOperationObjectGet = (role, operation, object) => {
      const columns = this.acl[role][operation].columns;
      if (columns) {
        // todo: merge allowed columns if multiple roles
        const allowedCols = Object.keys(columns).filter((col) => columns[col]);
        res.locals.xcAcl = { allowedCols, operation, columns };

        if (
          info.fieldName.endsWith('Update') ||
          info.fieldName.endsWith('Create')
        ) {
          if (Array.isArray(object)) {
            for (const row of object) {
              for (const colInReq of Object.keys(row)) {
                if (!allowedCols.includes(colInReq)) {
                  throw new Error(
                    `User doesn't have permission to add/edit '${colInReq}' column`
                  );
                }
              }
            }
          } else {
            for (const colInReq of Object.keys(object)) {
              if (!allowedCols.includes(colInReq)) {
                throw new Error(
                  `User doesn't have permission to edit '${colInReq}' column`
                );
              }
            }
          }
          return true;
        } else {
          if (this.acl?.[role]?.[operation]?.custom) {
            if (this.acl?.[role]?.[operation]?.custom) {
              const condition = replaceEnvVarRec(
                this.acl?.[role]?.[operation]?.custom
              );
              _args.conditionGraph = { condition, models: this.models };
            }
          }
          return Object.values(columns).some(Boolean);
        }
      }
    };

    const roles = (req as any)?.locals?.user?.roles ??
      (req as any)?.session?.passport?.user?.roles ?? {
        guest: true,
      };

    try {
      const allowed = roleOperationPossible(
        roles,
        getOperation(info.operation.operation, info.fieldName),
        _args?.data
      );
      if (allowed) {
        return;
      } else {
        const msg = roles.guest
          ? `Access Denied : Please Login or Signup for a new account`
          : `Access Denied for this account`;
        throw new Error(msg);
      }
    } catch (e) {
      throw e;
    }
  }

  // @ts-ignore
  public async postMiddleware(data, args, { req, res }, info): Promise<any> {
    if (!res.locals.xcAcl) {
      return data;
    }

    // @ts-ignore
    const { allowedCols, operation, columns } = res.locals.xcAcl;

    if (!columns) {
      return data;
    }

    if (Array.isArray(data)) {
      for (const row of data) {
        if (Array.isArray(row)) {
          for (const row1 of row) {
            if (typeof row1 !== 'object') {
              break;
            }
            for (const colInReq of Object.keys(row1)) {
              if (colInReq in columns && !columns[colInReq]) {
                delete row1[colInReq];
              }
            }
          }
        } else {
          if (typeof row !== 'object') {
            break;
          }

          for (const colInReq of Object.keys(row)) {
            if (colInReq in columns && !columns[colInReq]) {
              delete row[colInReq];
            }
          }
        }
      }
    } else if (typeof data === 'object') {
      for (const colInReq of Object.keys(data)) {
        if (colInReq in columns && !columns[colInReq]) {
          delete data[colInReq];
        }
      }
    }

    return data;
  }

  public async postLoaderMiddleware(...args): Promise<any> {
    return this.postMiddleware(args[0], args[2], args[3], args[4]);
  }
}

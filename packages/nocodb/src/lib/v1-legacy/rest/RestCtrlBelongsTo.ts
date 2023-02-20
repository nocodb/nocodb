import autoBind from 'auto-bind';
import { NextFunction, Request, Response } from 'express';

import { Acl, Acls, Route } from '../../../interface/config';
import { BaseModelSql } from '../../db/sql-data-mapper';

import { RestBaseCtrl } from './RestBaseCtrl';

export class RestCtrlBelongsTo extends RestBaseCtrl {
  public parentTable: string;
  public childTable: string;

  public app: any;
  // public routes: Route[];

  private models: { [key: string]: BaseModelSql };
  private acls: Acls;

  constructor(
    app: any,
    models: { [key: string]: BaseModelSql },
    parentTable: string,
    childTable: string,
    routes: Route[],
    rootPath: string,
    acls: Acls,
    middlewareBody?: string
  ) {
    super();
    autoBind(this);
    this.app = app;
    this.parentTable = parentTable;
    this.childTable = childTable;
    this.models = models;
    this.routes = routes;
    this.rootPath = rootPath;
    this.router = app.router;
    this.models = models;
    this.acls = acls;
    this.middlewareBody = middlewareBody;
  }

  private get parentModel(): BaseModelSql {
    return this.models?.[this.parentTable];
  }

  private get childModel(): BaseModelSql {
    return this.models?.[this.childTable];
  }

  private get parentAcl(): Acl {
    return this.acls?.[this.parentTable];
  }

  private get childAcl(): Acl {
    return this.acls?.[this.childTable];
  }

  public async list(req: Request | any, res): Promise<void> {
    const data = await req.childModel.belongsTo({
      parents: req.parentModel.tn,
      ...req.query,
    } as any);
    res.xcJson(data);
  }

  protected async middleware(
    req: Request | any,
    res: Response,
    next: NextFunction
  ): Promise<any> {
    req.childModel = this.childModel;
    req.parentModel = this.parentModel;
    req.parentTable = this.parentTable;
    req.childTable = this.childTable;

    const methodOperationMap = {
      get: 'read',
      post: 'create',
      put: 'update',
      delete: 'delete',
    };

    const roleOperationPossible = (roles, operation, object) => {
      const errors = [];
      res.locals.xcAcl = { operation };

      for (const [roleName, isAllowed] of Object.entries(roles)) {
        // todo: handling conditions from multiple roles
        if (this.childAcl?.[roleName]?.[operation]?.custom) {
          // req.query.condition = replaceEnvVarRec(this.acl?.[roleName]?.[operation]?.custom)
          const condition = this.replaceEnvVarRec(
            this.childAcl?.[roleName]?.[operation]?.custom,
            req
          );
          (req as any).query.childNestedCondition = {
            condition,
            models: this.models,
          };
        }
        if (this.parentAcl?.[roleName]?.[operation]?.custom) {
          // req.query.condition = replaceEnvVarRec(this.acl?.[roleName]?.[operation]?.custom)
          const condition = this.replaceEnvVarRec(
            this.parentAcl?.[roleName]?.[operation]?.custom,
            req
          );
          (req as any).query.conditionGraph = {
            condition,
            models: this.models,
          };
        }

        const childColumns = this.childAcl[roleName]?.[operation]?.columns;
        if (childColumns) {
          const allowedChildCols = Object.keys(childColumns).filter(
            (col) => childColumns[col]
          );
          res.locals.xcAcl.allowedChildCols =
            res.locals.xcAcl.allowedChildCols || [];
          res.locals.xcAcl.allowedChildCols.push(...allowedChildCols);
          res.locals.xcAcl.childColumns = childColumns;
        }

        if (!isAllowed) {
          continue;
        }

        try {
          if (typeof this.parentAcl?.[roleName]?.[operation] === 'boolean') {
            if (this.parentAcl[roleName][operation]) {
              return true;
            }
          } else if (
            this.parentAcl?.[roleName]?.[operation] &&
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
      const columns = this.parentAcl?.[role]?.[operation]?.columns;

      if (columns) {
        // todo: merge allowed columns if multiple roles
        const allowedParentCols = Object.keys(columns).filter(
          (col) => columns[col]
        );
        Object.assign(res.locals.xcAcl, {
          allowedParentCols,
          parentColumns: columns,
        });
        return Object.values(columns).some(Boolean);
      }
    };

    console.log(`${this.parentModel.tn}Hm${this.childModel.tn} middleware`);

    const roles = (req as any)?.locals?.user?.roles ??
      (req as any)?.session?.passport?.user?.roles ?? {
        guest: true,
      };

    try {
      const allowed = roleOperationPossible(
        roles,
        methodOperationMap[req.method.toLowerCase()],
        req.body
      );

      if (allowed) {
        // any additional rules can be made here
        return next();
      } else {
        const msg = roles.guest
          ? `Access Denied : Please Login or Signup for a new account`
          : `Access Denied for this account`;
        return res.status(403).json({
          msg,
        });
      }
    } catch (e) {
      return res.status(403).json({
        msg: e.message,
      });
    }
  }

  protected async postMiddleware(
    req: Request,
    res: Response,
    _next: NextFunction
  ): Promise<any> {
    const data = res.locals.responseData;
    if (!res.locals.xcAcl) {
      return res.json(data);
    }

    const { allowedChildCols, allowedParentCols, parentColumns, childColumns } =
      res.locals.xcAcl;

    const isBt = req.url
      .toLowerCase()
      .startsWith('/belongs/' + this.parentTable.toLowerCase());

    if ((!allowedChildCols || !isBt) && !allowedParentCols) {
      return res.json(data);
    }

    if (Array.isArray(data)) {
      for (const row of data) {
        for (const colInRes of Object.keys(row)) {
          if (isBt) {
            if (colInRes.toLowerCase() === this.parentTable.toLowerCase()) {
              if (!parentColumns) {
                continue;
              }
              for (const colInChild of Object.keys(row[colInRes])) {
                if (colInChild in parentColumns && !parentColumns[colInChild]) {
                  delete row[colInRes][colInChild];
                }
              }
            } else if (
              childColumns &&
              colInRes in childColumns &&
              !childColumns[colInRes]
            ) {
              delete row[colInRes];
            }
          } else if (
            childColumns &&
            colInRes in childColumns &&
            !childColumns[colInRes]
          ) {
            delete row[colInRes];
          }
        }
      }
    } else if (typeof data === 'object') {
      for (const colInReq of Object.keys(data)) {
        if (colInReq in parentColumns && !parentColumns[colInReq]) {
          delete data[colInReq];
        }
      }
    }
    return res.json(data);
  }

  get controllerName(): string {
    return `${this.childTable}.bt.${this.parentTable}`;
  }
}

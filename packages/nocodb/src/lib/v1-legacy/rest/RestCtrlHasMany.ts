import autoBind from 'auto-bind';
import { RestBaseCtrl } from './RestBaseCtrl';
import type { NextFunction, Request, Response } from 'express';

import type { Acl, Acls, Route } from '../../../interface/config';
import type { BaseModelSql } from '../../db/sql-data-mapper';

export class RestCtrlHasMany extends RestBaseCtrl {
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

  public async read(req: Request | any, res): Promise<void> {
    const data = await req.childModel.readByFk({
      parentId: req.params.parentId,
      tnp: req.parentModel.tn,
      id: req.params.id,
      ...req.query,
    } as any);
    res.xcJson(data);
  }

  public async update(req: Request | any, res: Response): Promise<void> {
    const data = await req.childModel.updateByFk({
      parentId: req.params.parentId,
      tnp: req.parentModel.tn,
      id: req.params.id,
      data: req.body,
    });
    res.json(data);
  }

  public async delete(req: Request | any, res: Response): Promise<void> {
    const data = await req.childModel.delByFk({
      parentId: req.params.parentId,
      tnp: req.parentModel.tn,
      id: req.params.id,
    });
    res.json(data);
  }

  public async create(req: Request | any, res): Promise<void> {
    const data = await req.childModel.insertByFk({
      parentId: req.params.parentId,
      tnp: req.parentModel.tn,
      data: req.body,
    });
    res.xcJson(data);
  }

  public async findOne(req: Request | any, res): Promise<void> {
    const data = await req.childModel.findOneByFk({
      parentId: req.params.parentId,
      tnp: req.parentModel.tn,
      ...req.query,
    });
    res.xcJson(data);
  }

  public async count(req: Request | any, res: Response): Promise<void> {
    const data = await req.childModel.countByFk({
      parentId: req.params.parentId,
      tnp: req.parentModel.tn,
      ...req.query,
    } as any);
    res.json(data);
  }

  public async exists(req: Request | any, res: Response): Promise<void> {
    const data = await req.childModel.existsByFk({
      parentId: req.params.parentId,
      tnp: req.parentModel.tn,
      id: req.params.id,
      ...req.query,
    } as any);
    res.json(data);
  }

  public async list(req: Request | any, res): Promise<void> {
    const data = await req.parentModel.hasManyChildren({
      child: req.childModel.tn,
      ...req.params,
      ...req.query,
    } as any);
    res.xcJson(data);
  }

  public async hasManyList(req: Request | any, res): Promise<void> {
    const data = await req.parentModel.hasManyList({
      ...req.query,
      childs: this.childTable, // req.childModel.tn
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
        if (this.childAcl?.[roleName]?.[operation]?.custom) {
          const condition = this.replaceEnvVarRec(
            this.childAcl?.[roleName]?.[operation]?.custom,
            req
          );
          (req as any).query.conditionGraph = {
            condition,
            models: this.models,
          };
        }
        if (this.parentAcl?.[roleName]?.[operation]?.custom) {
          const condition = this.replaceEnvVarRec(
            this.parentAcl?.[roleName]?.[operation]?.custom,
            req
          );
          (req as any).query.parentNestedCondition = {
            condition,
            models: this.models,
          };
        }

        const parentColumns = this.parentAcl?.[roleName]?.[operation]?.columns;

        if (parentColumns) {
          const allowedParentCols = Object.keys(parentColumns).filter(
            (col) => parentColumns[col]
          );
          res.locals.xcAcl.allowedParentCols =
            res.locals.xcAcl.allowedParentCols || [];
          res.locals.xcAcl.allowedParentCols.push(...allowedParentCols);

          // todo: merge columns
          res.locals.xcAcl.parentColumns = parentColumns;
        }

        if (!isAllowed) {
          continue;
        }

        try {
          if (typeof this.childAcl?.[roleName]?.[operation] === 'boolean') {
            if (this.childAcl?.[roleName]?.[operation]) {
              return true;
            }
          } else if (
            this.childAcl?.[roleName]?.[operation] &&
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
      const columns = this.childAcl[role][operation].columns;

      if (columns) {
        // todo: merge allowed columns if multiple roles
        const allowedChildCols = Object.keys(columns).filter(
          (col) => columns[col]
        );
        Object.assign(res.locals.xcAcl, {
          allowedChildCols,
          childColumns: columns,
        });

        if (operation === 'update' || operation === 'create') {
          if (Array.isArray(object)) {
            for (const row of object) {
              for (const colInReq of Object.keys(row)) {
                if (!allowedChildCols.includes(colInReq)) {
                  throw new Error(
                    `User doesn't have permission to edit '${colInReq}' column`
                  );
                }
              }
            }
          } else {
            for (const colInReq of Object.keys(object)) {
              if (!allowedChildCols.includes(colInReq)) {
                throw new Error(
                  `User doesn't have permission to edit '${colInReq}' column`
                );
              }
            }
          }
          return true;
        } else {
          return Object.values(columns).some(Boolean);
        }
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

    // @ts-ignore
    const { operation, parentColumns, childColumns } = res.locals.xcAcl;

    const isHm = req.url
      .toLowerCase()
      .startsWith('/has/' + this.childTable.toLowerCase());

    if ((!parentColumns || !isHm) && !childColumns) {
      return res.json(data);
    }

    if (Array.isArray(data)) {
      for (const row of data) {
        for (const colInRes of Object.keys(row)) {
          if (isHm) {
            if (colInRes.toLowerCase() === this.childTable.toLowerCase()) {
              if (!childColumns) {
                continue;
              }
              for (const childRow of row[colInRes]) {
                for (const colInChild of Object.keys(childRow)) {
                  if (colInChild in childColumns && !childColumns[colInChild]) {
                    delete childRow[colInChild];
                  }
                }
              }
            } else if (
              parentColumns &&
              colInRes in parentColumns &&
              !parentColumns[colInRes]
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
        if (colInReq && childColumns[colInReq]) {
          delete data[colInReq];
        }
      }
    }

    return res.json(data);
  }

  get controllerName(): string {
    return `${this.parentTable}.hm.${this.childTable}`;
  }
}

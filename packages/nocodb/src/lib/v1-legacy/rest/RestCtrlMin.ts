import autoBind from 'auto-bind';
import { Request, Response, Router } from 'express';

import { Acls } from '../../../interface/config';
import { BaseModelSql } from '../../db/sql-data-mapper';

function parseHrtimeToSeconds(hrtime) {
  const seconds = (hrtime[0] + hrtime[1] / 1e6).toFixed(3);
  return seconds;
}

export class RestCtrlMin {
  public app: any;
  private models: { [key: string]: BaseModelSql };
  // @ts-ignore
  private acls: Acls;

  constructor(app: any, models: { [key: string]: BaseModelSql }, acls: Acls) {
    autoBind(this);
    this.app = app;
    this.models = models;
    this.acls = acls;
  }

  public async list(req: Request | any, res): Promise<void> {
    const startTime = process.hrtime();

    const data = await req.model.list(req.query);
    const elapsedSeconds = parseHrtimeToSeconds(process.hrtime(startTime));
    res.setHeader('xc-db-response', elapsedSeconds);
    res.xcJson(data);
  }

  public async create(req: Request | any, res: Response): Promise<void> {
    const data = await req.model.insert(req.body, null, req);
    res.json(data);
  }

  public async get(req: Request | any, res): Promise<void> {
    const data = await req.model.readByPk(req.params.id, req.query);
    res.xcJson(data);
  }

  public async update(req: Request | any, res): Promise<void> {
    const data = await req.model.updateByPk(req.params.id, req.body, null, req);
    res.xcJson(data);
  }

  public async delete(req: Request | any, res): Promise<void> {
    const data = await req.model.delByPk(req.params.id, null, req);
    this.app.xcMeta.meta;
    res.xcJson(data);
  }

  public async exists(req: Request | any, res: Response): Promise<void> {
    const data = await req.model.exists(req.params.id, req.query);
    res.json(data);
  }

  public async findOne(req: Request | any, res): Promise<void> {
    const data = await req.model.findOne(req.query);
    res.xcJson(data);
  }

  public async groupby(req: Request | any, res: Response): Promise<void> {
    const data = await req.model.groupBy({
      ...req.params,
      ...req.query,
    } as any);
    res.json(data);
  }

  public async aggregate(req: Request | any, res: Response): Promise<void> {
    const data = await req.model.aggregate({
      ...req.params,
      ...req.query,
    } as any);
    res.json(data);
  }

  public async count(req: Request | any, res: Response): Promise<void> {
    const data = await req.model.countByPk({
      ...req.query,
    } as any);
    res.json(data);
  }

  public async distinct(req: Request | any, res): Promise<void> {
    const data = await req.model.distinct({
      ...req.query,
    } as any);
    res.xcJson(data);
  }

  public async distribute(req: Request | any, res: Response): Promise<void> {
    const data = await req.model.distribution({
      ...req.query,
    } as any);
    res.json(data);
  }

  public async bulkInsert(req: Request | any, res: Response): Promise<void> {
    const data = await req.model.insertb(req.body);
    res.json(data);
  }

  public async bulkUpdate(req: Request | any, res: Response): Promise<void> {
    const data = await req.model.updateb(req.body);
    res.json(data);
  }

  public async bulkDelete(req: Request | any, res: Response): Promise<void> {
    const data = await req.model.delb(req.body);
    res.json(data);
  }

  /*

    protected async middleware(req: Request | any, res: Response, next: NextFunction): Promise<any> {

      req.models = this.models;


      const methodOperationMap = {
        get: 'read',
        post: 'create',
        put: 'update',
        delete: 'delete',
      }

      const roleOperationPossible = (roles, operation, object) => {
        const errors = [];

        for (const [roleName, isAllowed] of Object.entries(roles)) {

          // todo: handle conditions from multiple roles
          if (this.acl?.[roleName]?.[operation]?.custom) {
            const condition = this.replaceEnvVarRec(this.acl?.[roleName]?.[operation]?.custom, req);
            (req as any).query.conditionGraph = {condition, models: this.models};
          }

          if (!isAllowed) {
            continue;
          }

          try {
            if (typeof this.acl?.[roleName]?.[operation] === 'boolean') {
              if (this.acl[roleName][operation]) {
                return true;
              }
            } else if (this.acl?.[roleName]?.[operation] && roleOperationObjectGet(roleName, operation, object)) {
              return true;
            }
          } catch (e) {
            errors.push(e);
          }

        }
        if (errors?.length) {
          throw errors[0]
        }

        return false;
      }

      // @ts-ignore
      const roleOperationObjectGet = (role, operation, object) => {

        const columns = this.acl[role][operation].columns;
        if (columns) {
          // todo: merge allowed columns if multiple roles
          const allowedCols = Object.keys(columns).filter(col => columns[col])
          res.locals.xcAcl = {allowedCols, operation, columns};

          if (operation === 'update' || operation === 'create') {
            if (Array.isArray(object)) {
              for (const row of object) {
                for (const colInReq of Object.keys(row)) {
                  if (!allowedCols.includes(colInReq)) {
                    throw new Error(`User doesn't have permission to edit '${colInReq}' column`);
                  }
                }
              }
            } else {
              for (const colInReq of Object.keys(object)) {
                if (!allowedCols.includes(colInReq)) {
                  throw new Error(`User doesn't have permission to edit '${colInReq}' column`);
                }
              }
            }
            return true;
          } else {
            return Object.values(columns).some(Boolean);
          }
        }
      }

      const roles = (req as any)?.locals?.user?.roles ?? (req as any)?.session?.passport?.user?.roles ?? {
        guest: true
      };


      try {
        const allowed = roleOperationPossible(roles, methodOperationMap[req.method.toLowerCase()], req.body);

        if (allowed) {
          // any additional rules can be made here
          return next();
        } else {
          const msg = roles.guest ? `Access Denied : Please Login or Signup for a new account` : `Access Denied for this account`;
          return res.status(403).json({
            msg
          });
        }
      } catch (e) {
        return res.status(403).json({
          msg: e.message
        });
      }
    }


    protected async postMiddleware(_req: Request, res: Response, _next: NextFunction): Promise<any> {

      const data = res.locals.responseData;

      if (!res.locals.xcAcl) {
        return res.json(data);
      }

      // @ts-ignore
      const {allowedCols, operation, columns} = res.locals.xcAcl;

      if (Array.isArray(data)) {
        for (const row of data) {
          for (const colInReq of Object.keys(row)) {
            if (colInReq in columns && !columns[colInReq]) {
              delete row[colInReq];
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
      return res.json(data);
    }
  */

  public mapRoutes(router: Router): any {
    router.get(
      '/api/v2/:_tn',
      (req: any, res: any, next) => {
        req.model = Object.values(this.models).find(
          (m) => m._tn === req.params._tn
        );
        res.xcJson = res.json;
        next();
      },
      this.list
    );
  }
}

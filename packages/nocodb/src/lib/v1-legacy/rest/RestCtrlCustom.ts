import autoBind from 'auto-bind';
import { Router } from 'express';
import { RestBaseCtrl } from './RestBaseCtrl';
import type { NextFunction, Request, Response } from 'express';

import type { Route } from '../../../interface/config';
import type { BaseModelSql } from '../../db/sql-data-mapper';

export class RestCtrlCustom extends RestBaseCtrl {
  public app: any;

  protected models: { [key: string]: BaseModelSql };

  constructor(
    app: any,
    models: { [key: string]: BaseModelSql },
    routes: Route[],
    middlewareBody?: string
  ) {
    super();
    autoBind(this);
    this.app = app;
    this.models = models;
    this.routes = routes;
    this.router = Router();
    this.middlewareBody = middlewareBody;
    this.rootPath = '';
  }

  protected async middleware(
    _req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<any> {
    next();
    // return Promise.resolve(undefined);
  }

  protected postMiddleware(
    _req: Request,
    _res: Response,
    _next: NextFunction
  ): Promise<any> {
    return Promise.resolve(undefined);
  }

  get controllerName(): string {
    return '__xc_custom';
  }
}

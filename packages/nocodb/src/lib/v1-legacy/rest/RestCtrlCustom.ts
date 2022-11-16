import autoBind from 'auto-bind';
import { NextFunction, Request, Response, Router } from 'express';

import { Route } from '../../../interface/config';
import { BaseModelSql } from '../../db/sql-data-mapper';

import { RestBaseCtrl } from './RestBaseCtrl';

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

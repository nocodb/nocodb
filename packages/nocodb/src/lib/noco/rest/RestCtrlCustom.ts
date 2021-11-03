import autoBind from 'auto-bind';
import { NextFunction, Request, Response, Router } from 'express';

import { Route } from '../../../interface/config';
import { BaseModelSql } from '../../dataMapper';

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
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */

import type { Handler, NextFunction, Request, Response, Router } from 'express';
import Handlebars from 'handlebars';

import type { Route } from '../../../interface/config';

export abstract class RestBaseCtrl {
  public router: Router;
  public routes: Route[];

  protected rootPath: string;
  protected middlewareBody: string;

  public updateMiddleware(middlewareBody: string): this {
    this.middlewareBody = middlewareBody;
    return this;
  }

  public remapRouters(router: Router): this {
    this.mapRoutes(router);
    return this;
  }

  public mapRoutes(router: Router, customRoutes?: any): any {
    const middleware = this.middlewareBody
      ? this.generateHandlerFromStringBody(this.middlewareBody)
      : this.middleware;

    customRoutes?.additional?.[this.controllerName]?.forEach((addRoute) => {
      const handlers = [middleware];

      handlers.push(...addRoute.handler?.map((hn) => this.catchErr(hn)));

      handlers.push(this.postMiddleware);

      router[addRoute.method](
        encodeURI(addRoute.path.slice(this.rootPath.length)),
        ...handlers
      );
    });

    this.routes.forEach((route: Route) => {
      const handlers = [middleware];

      if (customRoutes?.override?.[route.path]?.[route.type]?.length) {
        handlers.push(
          ...customRoutes.override[route.path][route.type].map((hn) =>
            this.catchErr(hn)
          )
        );
      } else if (
        route.functions &&
        Array.isArray(route.functions) &&
        route.functions.length
      ) {
        handlers.push(
          ...route.functions.map((fnBody) => {
            return this.catchErr(this.generateHandlerFromStringBody(fnBody));
          })
        );
      } else {
        handlers.push(
          ...route.handler.map((h) => {
            return this.catchErr(
              typeof h === 'string'
                ? (h in this ? this[h] : (_req, res) => res.json({})).bind(this)
                : h
            );
          })
        );
      }

      handlers.push(this.postMiddleware);

      router[route.type](
        encodeURI(route.path.slice(this.rootPath.length)),
        ...handlers
      );
    });
  }

  protected generateHandlerFromStringBody(fnBody: string): Handler {
    // @ts-ignore
    let handler = (_req: Request, res: Response, _next: NextFunction) => {
      res.send('Not implemented');
    };

    try {
      const js = `((${fnBody}).bind(this))`;

      // tslint:disable-next-line:no-eval
      handler = eval(js);
    } catch (e) {
      console.log('Error in transpilation', e);
    }
    return handler;
  }

  protected generateMiddlewareFromStringBody(fnBody: string): Handler {
    // @ts-ignore
    let middleware = (_req: Request, res: Response, _next: NextFunction) => {
      res.send('Not implemented');
    };

    try {
      const js = `((${fnBody}).bind(this))`;
      // tslint:disable-next-line:no-eval
      middleware = eval(js);
    } catch (e) {
      console.log('Error in transpilation', e);
    }
    return middleware;
  }

  protected catchErr(handler): Handler {
    return (req, res, next) => {
      (res as any).xcJson = (data) => {
        res.locals.responseData = data;
        next();
      };
      Promise.resolve(handler.call(this, req, res, next)).catch((err) => {
        next(err);
      });
    };
  }

  protected abstract postMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any>;

  protected abstract middleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<any>;

  abstract get controllerName(): string;

  protected replaceEnvVarRec(obj, req): any {
    return JSON.parse(JSON.stringify(obj), (_key, value) => {
      return typeof value === 'string'
        ? Handlebars.compile(value, { noEscape: true })({
            req,
          })
        : value;
    });
  }
}

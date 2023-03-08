import autoBind from 'auto-bind';

import BaseProcedure from '../../utils/common/BaseProcedure';
import XcProcedure from '../../utils/common/XcProcedure';
import type { Handler, NextFunction, Request, Response, Router } from 'express';

import type { RestApiBuilder } from './RestApiBuilder';

export class RestCtrlProcedure extends BaseProcedure {
  private acls: { [aclName: string]: { [role: string]: boolean } };

  constructor(
    builder: RestApiBuilder,
    functions: any[],
    procedures: any[],
    acls: { [p: string]: { [p: string]: boolean } }
  ) {
    super();
    autoBind(this);
    this.builder = builder;
    this.functions = functions;
    this.procedures = procedures;
    this.acls = acls;
    this.xcProcedure = new XcProcedure(builder);
  }

  public fnHandler(name) {
    return (async (req, res, next) => {
      try {
        res.json(await this.xcProcedure.callFunction(name, req.body));
      } catch (e) {
        next(e);
      }
    }).bind(this);
  }

  private procHandler(name) {
    return (async (req, res, next) => {
      try {
        res.json(await this.xcProcedure.callProcedure(name, req.body));
      } catch (e) {
        next(e);
      }
    }).bind(this);
  }

  public mapRoutes(router: Router, customRoutes: any): any {
    //  todo: load routers based on procedure/function list
    if (this.functions) {
      for (const { function_name } of this.functions) {
        const routePath = '/_function/' + function_name;
        if (
          customRoutes?.[`/api/${this.builder.routeVersionLetter}${routePath}`]
            ?.post?.length
        ) {
          router.post(
            routePath,
            this.middleware(function_name),
            ...customRoutes[
              `/api/${this.builder.routeVersionLetter}${routePath}`
            ].post
          );
        } else {
          router.post(
            routePath,
            this.middleware(function_name),
            this.fnHandler(function_name)
          );
        }
      }
    }
    if (this.procedures) {
      for (const { procedure_name } of this.procedures) {
        const routePath = '/_procedure/' + procedure_name;
        if (
          customRoutes?.[`/api/${this.builder.routeVersionLetter}${routePath}`]
            ?.post?.length
        ) {
          router.post(
            routePath,
            this.middleware(procedure_name),
            ...customRoutes[
              `/api/${this.builder.routeVersionLetter}${routePath}`
            ].post
          );
        } else {
          router.post(
            routePath,
            this.middleware(procedure_name),
            this.procHandler(procedure_name)
          );
        }
      }
    }
  }

  private middleware(name: string): Handler {
    return (async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<any> => {
      const roles = (req as any)?.locals?.user?.roles ??
        (req as any)?.session?.passport?.user?.roles ?? {
          guest: true,
        };

      try {
        const allowed = Object.keys(roles).some(
          (role) => roles[role] && this.acls?.[name]?.[role]
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
    }).bind(this);
  }

  updateMiddleware(_body: string) {}

  public getSwaggerObj() {
    const swggerObj = {
      tags: [
        {
          name: `Procedures`,
          description: ``,
        },
        {
          name: `Functions`,
          description: ``,
        },
      ],
      paths: {},
    };

    if (this.functions) {
      for (const { function_name } of this.functions) {
        swggerObj.paths[
          `/api/${this.builder.routeVersionLetter}/_function/${function_name}`
        ] = {
          post: {
            tags: [`Functions`],
            summary: ``,
            description: '',
            operationId: `_function_${function_name}`,
            consumes: ['application/json'],
            produces: ['application/json'],
            parameters: [
              {
                in: 'body',
                name: 'body',
                description: `Array of function arguments`,
                required: true,
              },
            ],
            responses: {
              '200': {
                description: '',
                type: 'object',
              },
            },
          },
        };
      }
    }
    if (this.procedures) {
      for (const { procedure_name } of this.procedures) {
        swggerObj.paths[
          `/api/${this.builder.routeVersionLetter}/_procedure/${procedure_name}`
        ] = {
          post: {
            tags: [`Procedures`],
            summary: ``,
            description: '',
            operationId: `_procedure_${procedure_name}`,
            consumes: ['application/json'],
            produces: ['application/json'],
            parameters: [
              {
                in: 'body',
                name: 'body',
                description: `Array of procedure arguments`,
                required: true,
              },
            ],
            responses: {
              '200': {
                description: '',
                type: 'object',
              },
            },
          },
        };
      }
    }

    return swggerObj;
  }
}

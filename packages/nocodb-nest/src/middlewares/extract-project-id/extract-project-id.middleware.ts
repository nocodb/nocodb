import { promisify } from 'util';
import { Injectable, SetMetadata, UseInterceptors } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NextFunction, Request, Response } from 'express';
import { OrgUserRoles } from 'nocodb-sdk';
import passport from 'passport';
import { map, throwError } from 'rxjs';
import {
  Column,
  Filter,
  FormViewColumn,
  GalleryViewColumn,
  GridViewColumn,
  Hook,
  Model,
  Project,
  Sort,
  View,
} from '../../models';
import extractRolesObj from '../../utils/extractRolesObj';
import projectAcl from '../../utils/projectAcl';
import catchError, { NcError } from '../catchError';
import extractProjectIdAndAuthenticate from '../extractProjectIdAndAuthenticate';
import type { Observable } from 'rxjs';
import type {
  CallHandler,
  CanActivate,
  ExecutionContext,
  NestInterceptor,
  NestMiddleware,
} from '@nestjs/common';

@Injectable()
export class ExtractProjectIdMiddleware implements NestMiddleware, CanActivate {
  constructor(private reflector: Reflector) {}

  async use(req, res, next): Promise<any> {
    try {
      const { params } = req;

      // extract project id based on request path params
      if (params.projectName) {
        const project = await Project.getByTitleOrId(params.projectName);
        req.ncProjectId = project.id;
        res.locals.project = project;
      }
      if (params.projectId) {
        req.ncProjectId = params.projectId;
      } else if (req.query.project_id) {
        req.ncProjectId = req.query.project_id;
      } else if (
        params.tableId ||
        req.query.fk_model_id ||
        req.body?.fk_model_id
      ) {
        const model = await Model.getByIdOrName({
          id: params.tableId || req.query?.fk_model_id || req.body?.fk_model_id,
        });
        req.ncProjectId = model?.project_id;
      } else if (params.viewId) {
        const view =
          (await View.get(params.viewId)) || (await Model.get(params.viewId));
        req.ncProjectId = view?.project_id;
      } else if (
        params.formViewId ||
        params.gridViewId ||
        params.kanbanViewId ||
        params.galleryViewId
      ) {
        const view = await View.get(
          params.formViewId ||
            params.gridViewId ||
            params.kanbanViewId ||
            params.galleryViewId,
        );
        req.ncProjectId = view?.project_id;
      } else if (params.publicDataUuid) {
        const view = await View.getByUUID(req.params.publicDataUuid);
        req.ncProjectId = view?.project_id;
      } else if (params.hookId) {
        const hook = await Hook.get(params.hookId);
        req.ncProjectId = hook?.project_id;
      } else if (params.gridViewColumnId) {
        const gridViewColumn = await GridViewColumn.get(
          params.gridViewColumnId,
        );
        req.ncProjectId = gridViewColumn?.project_id;
      } else if (params.formViewColumnId) {
        const formViewColumn = await FormViewColumn.get(
          params.formViewColumnId,
        );
        req.ncProjectId = formViewColumn?.project_id;
      } else if (params.galleryViewColumnId) {
        const galleryViewColumn = await GalleryViewColumn.get(
          params.galleryViewColumnId,
        );
        req.ncProjectId = galleryViewColumn?.project_id;
      } else if (params.columnId) {
        const column = await Column.get({ colId: params.columnId });
        req.ncProjectId = column?.project_id;
      } else if (params.filterId) {
        const filter = await Filter.get(params.filterId);
        req.ncProjectId = filter?.project_id;
      } else if (params.filterParentId) {
        const filter = await Filter.get(params.filterParentId);
        req.ncProjectId = filter?.project_id;
      } else if (params.sortId) {
        const sort = await Sort.get(params.sortId);
        req.ncProjectId = sort?.project_id;
      }

      // const user = await new Promise((resolve, _reject) => {
      //   passport.authenticate(
      //     'jwt',
      //     { session: false },
      //     (_err, user, _info) => {
      //       if (user && !req.headers['xc-shared-base-id']) {
      //         if (
      //           req.path.indexOf('/user/me') === -1 &&
      //           req.header('xc-preview') &&
      //           /(?:^|,)(?:owner|creator)(?:$|,)/.test(user.roles)
      //         ) {
      //           return resolve({
      //             ...user,
      //             isAuthorized: true,
      //             roles: req.header('xc-preview'),
      //           });
      //         }
      //
      //         return resolve({ ...user, isAuthorized: true });
      //       }
      //
      //       if (req.headers['xc-token']) {
      //         passport.authenticate(
      //           'authtoken',
      //           {
      //             session: false,
      //             optional: false,
      //           } as any,
      //           (_err, user, _info) => {
      //             // if (_err) return reject(_err);
      //             if (user) {
      //               return resolve({
      //                 ...user,
      //                 isAuthorized: true,
      //                 roles:
      //                   user.roles === 'owner' ? 'owner,creator' : user.roles,
      //               });
      //             } else {
      //               resolve({ roles: 'guest' });
      //             }
      //           },
      //         )(req, res, next);
      //       } else if (req.headers['xc-shared-base-id']) {
      //         passport.authenticate('baseView', {}, (_err, user, _info) => {
      //           // if (_err) return reject(_err);
      //           if (user) {
      //             return resolve({
      //               ...user,
      //               isAuthorized: true,
      //               isPublicBase: true,
      //             });
      //           } else {
      //             resolve({ roles: 'guest' });
      //           }
      //         })(req, res, next);
      //       } else {
      //         resolve({ roles: 'guest' });
      //       }
      //     },
      //   )(req, res, next);
      // });
      //
      // await promisify((req as any).login.bind(req))(user);
    } catch (e) {
      console.log(e);
      // return throwError(new Error('Internal error'));
    }
    next();
    // return next.handle().pipe(
    //   map((data) => {
    //     return data;
    //   }),
    // );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await this.use(
      context.switchToHttp().getRequest(),
      context.switchToHttp().getResponse(),
      () => {},
    );
    return true;
  }
}

@Injectable()
export class AclMiddleware implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const permissionName = this.reflector.get<string>(
      'permission',
      context.getHandler(),
    );
    const allowedRoles = this.reflector.get<(OrgUserRoles | string)[]>(
      'allowedRoles',
      context.getHandler(),
    );
    const blockApiTokenAccess = this.reflector.get<boolean>(
      'blockApiTokenAccess',
      context.getHandler(),
    );

    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    req.customProperty = 'This is a custom property';

    const roles: Record<string, boolean> = extractRolesObj(req.user?.roles);

    if (req?.user?.is_api_token && blockApiTokenAccess) {
      NcError.forbidden('Not allowed with API token');
    }
    if (
      (!allowedRoles || allowedRoles.some((role) => roles?.[role])) &&
      !(
        roles?.creator ||
        roles?.owner ||
        roles?.editor ||
        roles?.viewer ||
        roles?.commenter ||
        roles?.[OrgUserRoles.SUPER_ADMIN] ||
        roles?.[OrgUserRoles.CREATOR] ||
        roles?.[OrgUserRoles.VIEWER]
      )
    ) {
      NcError.unauthorized('Unauthorized access');
    }
    // todo : verify user have access to project or not

    const isAllowed =
      roles &&
      Object.entries(roles).some(([name, hasRole]) => {
        return (
          hasRole &&
          projectAcl[name] &&
          (projectAcl[name] === '*' ||
            (projectAcl[name].exclude &&
              !projectAcl[name].exclude[permissionName]) ||
            (projectAcl[name].include &&
              projectAcl[name].include[permissionName]))
        );
      });
    if (!isAllowed) {
      NcError.forbidden(
        `${permissionName} - ${Object.keys(roles).filter(
          (k) => roles[k],
        )} : Not allowed`,
      );
    }

    return next.handle().pipe(
      map((data) => {
        return data;
      }),
    );
  }
}

export const UseProjectIdMiddleware =
  () => (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    UseInterceptors(ExtractProjectIdMiddleware)(target, key, descriptor);
  };

export const UseAclMiddleware =
  ({
    permissionName,
    allowedRoles,
    blockApiTokenAccess,
  }: {
    permissionName: string;
    allowedRoles?: (OrgUserRoles | string)[];
    blockApiTokenAccess?: boolean;
  }) =>
  (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    SetMetadata('permission', permissionName)(target, key, descriptor);
    SetMetadata('allowedRoles', allowedRoles)(target, key, descriptor);
    SetMetadata('blockApiTokenAccess', blockApiTokenAccess)(
      target,
      key,
      descriptor,
    );
    // UseInterceptors(ExtractProjectIdMiddleware)(target, key, descriptor);
    UseInterceptors(AclMiddleware)(target, key, descriptor);
  };
export const Acl =
  (
    permissionName: string,
    {
      allowedRoles,
      blockApiTokenAccess,
    }: {
      allowedRoles?: (OrgUserRoles | string)[];
      blockApiTokenAccess?: boolean;
    } = {},
  ) =>
  (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    SetMetadata('permission', permissionName)(target, key, descriptor);
    SetMetadata('allowedRoles', allowedRoles)(target, key, descriptor);
    SetMetadata('blockApiTokenAccess', blockApiTokenAccess)(
      target,
      key,
      descriptor,
    );
    // UseInterceptors(ExtractProjectIdMiddleware)(target, key, descriptor);
    UseInterceptors(AclMiddleware)(target, key, descriptor);
  };

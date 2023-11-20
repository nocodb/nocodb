import { Injectable, SetMetadata, UseInterceptors } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { extractRolesObj, OrgUserRoles, ProjectRoles } from 'nocodb-sdk';
import { map } from 'rxjs';
import type { Observable } from 'rxjs';
import type {
  CallHandler,
  CanActivate,
  ExecutionContext,
  NestInterceptor,
  NestMiddleware,
} from '@nestjs/common';
import {
  Base,
  Column,
  Filter,
  FormViewColumn,
  GalleryViewColumn,
  GridViewColumn,
  Hook,
  Model,
  Sort,
  SyncSource,
  View,
} from '~/models';
import rolePermissions from '~/utils/acl';
import { NcError } from '~/middlewares/catchError';

export const rolesLabel = {
  [OrgUserRoles.SUPER_ADMIN]: 'Super Admin',
  [OrgUserRoles.CREATOR]: 'Org Creator',
  [OrgUserRoles.VIEWER]: 'Org Viewer',
  [ProjectRoles.OWNER]: 'Base Owner',
  [ProjectRoles.CREATOR]: 'Base Creator',
  [ProjectRoles.VIEWER]: 'Base Viewer',
  [ProjectRoles.EDITOR]: 'Base Editor',
  [ProjectRoles.COMMENTER]: 'Base Commenter',
};

export function getRolesLabels(
  roles: (OrgUserRoles | ProjectRoles | string)[],
) {
  return roles
    .filter(
      (role) =>
        ![OrgUserRoles.CREATOR, OrgUserRoles.VIEWER].includes(
          role as OrgUserRoles,
        ),
    )
    .map((role) => rolesLabel[role]);
}

// todo: refactor name since we are using it as auth guard
@Injectable()
export class ExtractIdsMiddleware implements NestMiddleware, CanActivate {
  async use(req, res, next): Promise<any> {
    const { params } = req;

    // extract base id based on request path params
    if (params.baseName) {
      const base = await Base.getByTitleOrId(params.baseName);
      if (base) {
        req.ncProjectId = base.id;
        res.locals.base = base;
      }
    }
    if (params.baseId) {
      req.ncProjectId = params.baseId;
    } else if (params.dashboardId) {
      req.ncProjectId = params.dashboardId;
    } else if (params.tableId || params.modelId) {
      const model = await Model.getByIdOrName({
        id: params.tableId || params.modelId,
      });
      req.ncProjectId = model?.base_id;
    } else if (params.viewId) {
      const view =
        (await View.get(params.viewId)) || (await Model.get(params.viewId));
      req.ncProjectId = view?.base_id;
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
      req.ncProjectId = view?.base_id;
    } else if (params.publicDataUuid) {
      const view = await View.getByUUID(req.params.publicDataUuid);
      req.ncProjectId = view?.base_id;
    } else if (params.hookId) {
      const hook = await Hook.get(params.hookId);
      req.ncProjectId = hook?.base_id;
    } else if (params.gridViewColumnId) {
      const gridViewColumn = await GridViewColumn.get(params.gridViewColumnId);
      req.ncProjectId = gridViewColumn?.base_id;
    } else if (params.formViewColumnId) {
      const formViewColumn = await FormViewColumn.get(params.formViewColumnId);
      req.ncProjectId = formViewColumn?.base_id;
    } else if (params.galleryViewColumnId) {
      const galleryViewColumn = await GalleryViewColumn.get(
        params.galleryViewColumnId,
      );
      req.ncProjectId = galleryViewColumn?.base_id;
    } else if (params.columnId) {
      const column = await Column.get({ colId: params.columnId });
      req.ncProjectId = column?.base_id;
    } else if (params.filterId) {
      const filter = await Filter.get(params.filterId);
      req.ncProjectId = filter?.base_id;
    } else if (params.filterParentId) {
      const filter = await Filter.get(params.filterParentId);
      req.ncProjectId = filter?.base_id;
    } else if (params.sortId) {
      const sort = await Sort.get(params.sortId);
      req.ncProjectId = sort?.base_id;
    } else if (params.syncId) {
      const syncSource = await SyncSource.get(req.params.syncId);
      req.ncProjectId = syncSource.base_id;
    }
    // extract fk_model_id from query params only if it's audit post endpoint
    else if (
      [
        '/api/v1/db/meta/audits/rows/:rowId/update',
        '/api/v1/db/meta/audits/comments',
        '/api/v2/meta/audits/rows/:rowId/update',
        '/api/v2/meta/audits/comments',
      ].some(
        (auditInsertOrUpdatePath) => req.route.path === auditInsertOrUpdatePath,
      ) &&
      req.method === 'POST' &&
      req.body?.fk_model_id
    ) {
      const model = await Model.getByIdOrName({
        id: req.body.fk_model_id,
      });
      req.ncProjectId = model?.base_id;
    }
    // extract fk_model_id from query params only if it's audit get endpoint
    else if (
      [
        '/api/v1/db/meta/audits/comments/count',
        '/api/v1/db/meta/audits/comments',
        '/api/v2/meta/audits/comments/count',
        '/api/v2/meta/audits/comments',
      ].some((auditReadPath) => req.route.path === auditReadPath) &&
      req.method === 'GET' &&
      req.query.fk_model_id
    ) {
      const model = await Model.getByIdOrName({
        id: req.query?.fk_model_id,
      });
      req.ncProjectId = model?.base_id;
    }
    // extract base id from query params only if it's userMe endpoint or webhook plugin list
    else if (
      [
        '/auth/user/me',
        '/api/v1/db/auth/user/me',
        '/api/v1/auth/user/me',
        '/api/v1/db/meta/plugins/webhook',
        '/api/v2/meta/plugins/webhook',
      ].some((userMePath) => req.route.path === userMePath) &&
      req.query.base_id
    ) {
      req.ncProjectId = req.query.base_id;
    }

    next();
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

function getUserRoleForScope(user: any, scope: string) {
  if (scope === 'base') {
    return user?.base_roles;
  } else if (scope === 'org') {
    return user?.roles;
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
    const scope = this.reflector.get<string>('scope', context.getHandler());

    const req = context.switchToHttp().getRequest();

    const userScopeRole =
      req.user.roles?.[OrgUserRoles.SUPER_ADMIN] === true
        ? OrgUserRoles.SUPER_ADMIN
        : getUserRoleForScope(req.user, scope);

    if (!userScopeRole) {
      NcError.forbidden('Unauthorized access');
    }

    // assign owner role to super admin for all bases
    if (userScopeRole === OrgUserRoles.SUPER_ADMIN) {
      req.user.base_roles = {
        [ProjectRoles.OWNER]: true,
      };
    }

    const roles: Record<string, boolean> = extractRolesObj(userScopeRole);

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
    // todo : verify user have access to base or not

    const isAllowed =
      roles &&
      Object.entries(roles).some(([name, hasRole]) => {
        return (
          hasRole &&
          rolePermissions[name] &&
          (rolePermissions[name] === '*' ||
            (rolePermissions[name].exclude &&
              !rolePermissions[name].exclude[permissionName]) ||
            (rolePermissions[name].include &&
              rolePermissions[name].include[permissionName]))
        );
      });
    if (!isAllowed) {
      NcError.forbidden(
        `${permissionName} - ${getRolesLabels(
          Object.keys(roles).filter((k) => roles[k]),
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

export const Acl =
  (
    permissionName: string,
    {
      scope = 'base',
      allowedRoles,
      blockApiTokenAccess,
    }: {
      scope?: string;
      allowedRoles?: (OrgUserRoles | string)[];
      blockApiTokenAccess?: boolean;
    } = {},
  ) =>
  (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    SetMetadata('permission', permissionName)(target, key, descriptor);
    SetMetadata('scope', scope)(target, key, descriptor);
    SetMetadata('allowedRoles', allowedRoles)(target, key, descriptor);
    SetMetadata('blockApiTokenAccess', blockApiTokenAccess)(
      target,
      key,
      descriptor,
    );
    UseInterceptors(AclMiddleware)(target, key, descriptor);
  };

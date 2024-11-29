import { Injectable, SetMetadata, UseInterceptors } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  extractRolesObj,
  OrgUserRoles,
  ProjectRoles,
  SourceRestriction,
} from 'nocodb-sdk';
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
  Comment,
  Extension,
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
import { NcError } from '~/helpers/catchError';
import { RootScopes } from '~/utils/globals';
import { sourceRestrictions } from '~/utils/acl';
import { Source } from '~/models';

export const rolesLabel = {
  [OrgUserRoles.SUPER_ADMIN]: 'Super Admin',
  [OrgUserRoles.CREATOR]: 'Org Creator',
  [OrgUserRoles.VIEWER]: 'Org Viewer',
  [ProjectRoles.OWNER]: 'Base Owner',
  [ProjectRoles.CREATOR]: 'Base Creator',
  [ProjectRoles.VIEWER]: 'Base Viewer',
  [ProjectRoles.EDITOR]: 'Base Editor',
  [ProjectRoles.COMMENTER]: 'Base Commenter',
  [ProjectRoles.NO_ACCESS]: 'No Access',
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

    const context = {
      workspace_id: RootScopes.BYPASS,
      base_id: RootScopes.BYPASS,
    };

    // extract base id based on request path params
    if (params.baseName) {
      const base = await Base.getByTitleOrId(context, params.baseName);

      if (!base) {
        NcError.baseNotFound(params.baseName);
      }

      if (base) {
        req.ncBaseId = base.id;
        if (params.tableName) {
          // extract model and then source id from model
          const model = await Model.getByAliasOrId(context, {
            base_id: base.id,
            aliasOrId: params.tableName,
          });

          if (!model) {
            NcError.tableNotFound(req.params.tableName);
          }

          req.ncSourceId = model?.source_id;
        }
      }
    }
    if (params.baseId) {
      req.ncBaseId = params.baseId;
    } else if (params.dashboardId) {
      req.ncBaseId = params.dashboardId;
    } else if (params.tableId || params.modelId) {
      const model = await Model.getByIdOrName(context, {
        id: params.tableId || params.modelId,
      });

      if (!model) {
        NcError.tableNotFound(params.tableId || params.modelId);
      }

      req.ncBaseId = model.base_id;
      req.ncSourceId = model.source_id;
    } else if (params.viewId) {
      const view =
        (await View.get(context, params.viewId)) ||
        (await Model.get(context, params.viewId));

      if (!view) {
        NcError.viewNotFound(params.viewId);
      }

      req.ncBaseId = view.base_id;
      req.ncSourceId = view.source_id;
    } else if (
      params.formViewId ||
      params.gridViewId ||
      params.kanbanViewId ||
      params.galleryViewId ||
      params.calendarViewId
    ) {
      const view = await View.get(
        context,
        params.formViewId ||
          params.gridViewId ||
          params.kanbanViewId ||
          params.galleryViewId ||
          params.calendarViewId,
      );

      if (!view) {
        NcError.viewNotFound(
          params.formViewId ||
            params.gridViewId ||
            params.kanbanViewId ||
            params.galleryViewId ||
            params.calendarViewId,
        );
      }

      req.ncBaseId = view.base_id;
      req.ncSourceId = view.source_id;
    } else if (params.publicDataUuid) {
      const view = await View.getByUUID(context, req.params.publicDataUuid);

      if (!view) {
        NcError.viewNotFound(params.publicDataUuid);
      }

      req.ncBaseId = view.base_id;
      req.ncSourceId = view.source_id;
    } else if (params.sharedViewUuid) {
      const view = await View.getByUUID(context, req.params.sharedViewUuid);

      if (!view) {
        NcError.viewNotFound(req.params.sharedViewUuid);
      }

      req.ncBaseId = view.base_id;
      req.ncSourceId = view.source_id;
    } else if (params.sharedBaseUuid) {
      const base = await Base.getByUuid(context, req.params.sharedBaseUuid);

      if (!base) {
        NcError.baseNotFound(req.params.sharedBaseUuid);
      }

      req.ncBaseId = base?.id;
    } else if (params.hookId) {
      const hook = await Hook.get(context, params.hookId);

      if (!hook) {
        NcError.hookNotFound(params.hookId);
      }

      req.ncBaseId = hook.base_id;
      req.ncSourceId = hook.source_id;
    } else if (params.gridViewColumnId) {
      const gridViewColumn = await GridViewColumn.get(
        context,
        params.gridViewColumnId,
      );

      if (!gridViewColumn) {
        NcError.fieldNotFound(params.gridViewColumnId);
      }

      req.ncBaseId = gridViewColumn.base_id;
      req.ncSourceId = gridViewColumn.source_id;
    } else if (params.formViewColumnId) {
      const formViewColumn = await FormViewColumn.get(
        context,
        params.formViewColumnId,
      );

      if (!formViewColumn) {
        NcError.fieldNotFound(params.formViewColumnId);
      }

      req.ncBaseId = formViewColumn.base_id;
      req.ncSourceId = formViewColumn.source_id;
    } else if (params.galleryViewColumnId) {
      const galleryViewColumn = await GalleryViewColumn.get(
        context,
        params.galleryViewColumnId,
      );

      if (!galleryViewColumn) {
        NcError.fieldNotFound(params.galleryViewColumnId);
      }

      req.ncBaseId = galleryViewColumn.base_id;
      req.ncSourceId = galleryViewColumn.source_id;
    } else if (params.columnId) {
      const column = await Column.get(context, { colId: params.columnId });

      if (!column) {
        NcError.fieldNotFound(params.columnId);
      }

      req.ncBaseId = column.base_id;
      req.ncSourceId = column.source_id;
    } else if (params.filterId) {
      const filter = await Filter.get(context, params.filterId);

      if (!filter) {
        NcError.genericNotFound('Filter', params.filterId);
      }

      req.ncBaseId = filter.base_id;
      req.ncSourceId = filter.source_id;
    } else if (params.filterParentId) {
      const filter = await Filter.get(context, params.filterParentId);

      if (!filter) {
        NcError.genericNotFound('Filter', params.filterParentId);
      }

      req.ncBaseId = filter.base_id;
      req.ncSourceId = filter.source_id;
    } else if (params.sortId) {
      const sort = await Sort.get(context, params.sortId);

      if (!sort) {
        NcError.genericNotFound('Sort', params.sortId);
      }

      req.ncBaseId = sort.base_id;
      req.ncSourceId = sort.source_id;
    } else if (params.syncId) {
      const syncSource = await SyncSource.get(context, req.params.syncId);

      if (!syncSource) {
        NcError.genericNotFound('Sync Source', params.syncId);
      }

      req.ncBaseId = syncSource.base_id;
      req.ncSourceId = syncSource.source_id;
    } else if (params.extensionId) {
      const extension = await Extension.get(context, req.params.extensionId);

      if (!extension) {
        NcError.genericNotFound('Extension', params.extensionId);
      }

      req.ncBaseId = extension.base_id;
    }
    // extract fk_model_id from query params only if it's audit post endpoint
    else if (
      [
        '/api/v1/db/meta/audits/rows/:rowId/update',
        '/api/v2/meta/audits/rows/:rowId/update',
        '/api/v1/db/meta/comments',
        '/api/v2/meta/comments',
      ].some(
        (auditInsertOrUpdatePath) => req.route.path === auditInsertOrUpdatePath,
      ) &&
      req.method === 'POST' &&
      req.body?.fk_model_id
    ) {
      const model = await Model.getByIdOrName(context, {
        id: req.body.fk_model_id,
      });

      if (!model) {
        NcError.tableNotFound(req.body.fk_model_id);
      }

      req.ncBaseId = model.base_id;
      req.ncSourceId = model.source_id;
    }
    // extract fk_model_id from query params only if it's audit get endpoint
    else if (
      [
        '/api/v2/meta/comments/count',
        '/api/v1/db/meta/comments/count',
        '/api/v2/meta/comments',
        '/api/v1/db/meta/comments',
        '/api/v1/db/meta/audits',
        '/api/v2/meta/audits',
      ].some((auditReadPath) => req.route.path === auditReadPath) &&
      req.method === 'GET' &&
      req.query.fk_model_id
    ) {
      const model = await Model.getByIdOrName(context, {
        id: req.query?.fk_model_id,
      });

      if (!model) {
        NcError.tableNotFound(req.query?.fk_model_id);
      }

      req.ncBaseId = model.base_id;
      req.ncSourceId = model.source_id;
    } else if (
      [
        '/api/v1/db/meta/comment/:commentId',
        '/api/v2/meta/comment/:commentId',
      ].some((commentPatchPath) => req.route.path === commentPatchPath) &&
      (req.method === 'PATCH' || req.method === 'DELETE') &&
      req.params.commentId
    ) {
      const comment = await Comment.get(context, params.commentId);

      if (!comment) {
        NcError.genericNotFound('Comment', params.commentId);
      }

      req.ncBaseId = comment.base_id;
      req.ncSourceId = comment.source_id;
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
      req.ncBaseId = req.query.base_id;
    }

    // if integration list endpoint is called with baseId, then extract baseId if it's valid
    if (
      req.route.path === '/api/v2/meta/integrations' &&
      req.method === 'GET' &&
      req.query.baseId
    ) {
      // check if baseId is valid and under the workspace
      const base = await Base.get(context, req.query.baseId);
      if (!base) {
        NcError.baseNotFound(req.query.baseId);
      }
      req.ncBaseId = base.id;
    }

    req.context = {
      workspace_id: null,
      base_id: req.ncBaseId,
    };

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
    const extendedScope = this.reflector.get<string>(
      'extendedScope',
      context.getHandler(),
    );

    const req = context.switchToHttp().getRequest();

    if (!req.user?.isAuthorized) {
      NcError.unauthorized('Invalid token');
    }
    const userScopeRole =
      req.user.roles?.[OrgUserRoles.SUPER_ADMIN] === true
        ? OrgUserRoles.SUPER_ADMIN
        : getUserRoleForScope(req.user, scope);

    if (!userScopeRole) {
      NcError.forbidden("You don't have permission to access this resource");
    }

    // assign owner role to super admin for all bases
    if (userScopeRole === OrgUserRoles.SUPER_ADMIN) {
      req.user.base_roles = {
        [ProjectRoles.OWNER]: true,
      };
    }

    const roles: Record<string, boolean> = extractRolesObj(userScopeRole);

    // extendedScope is used to allow access based on extended scope in which permission is prefixed with scope name and separated by underscore
    const extendedScopeRoles =
      extendedScope && getUserRoleForScope(req.user, extendedScope);

    if (req?.user?.is_api_token && blockApiTokenAccess) {
      NcError.apiTokenNotAllowed();
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
      (Object.entries(roles).some(([name, hasRole]) => {
        return (
          hasRole &&
          rolePermissions[name] &&
          (rolePermissions[name] === '*' ||
            (rolePermissions[name].exclude &&
              !rolePermissions[name].exclude[permissionName]) ||
            (rolePermissions[name].include &&
              rolePermissions[name].include[permissionName]))
        );
      }) ||
        // extendedScope is used to allow access based on extended scope in which permission is prefixed with scope name and separated by underscore
        (extendedScopeRoles &&
          Object.entries(extendedScopeRoles).some(([name, hasRole]) => {
            return (
              hasRole &&
              rolePermissions[name] &&
              (rolePermissions[name] === '*' ||
                (rolePermissions[name].exclude &&
                  !rolePermissions[name].exclude[
                    scope + '_' + permissionName
                  ]) ||
                (rolePermissions[name].include &&
                  rolePermissions[name].include[scope + '_' + permissionName]))
            );
          })));
    if (!isAllowed) {
      NcError.permissionDenied(permissionName, roles, extendedScopeRoles);

      // NcError.forbidden(
      //
      //
      //   `${permissionName} - ${getRolesLabels(
      //     Object.keys(roles).filter((k) => roles[k]),
      //   )} : Not allowed`,
      // );
    }

    // check if permission have source level permission restriction
    // 1. Check if it's present in the source restriction list
    // 2. If present, check if write permission is allowed
    if (
      sourceRestrictions[SourceRestriction.SCHEMA_READONLY][permissionName] ||
      sourceRestrictions[SourceRestriction.DATA_READONLY][permissionName]
    ) {
      let source: Source;

      // if tableCreate and source ID is empty, then extract the default source from base
      if (!req.ncSourceId && req.ncBaseId && permissionName === 'tableCreate') {
        const sources = await Source.list(req.context, {
          baseId: req.ncBaseId,
        });
        if (req.params.sourceId) {
          source = sources.find((s) => s.id === req.params.sourceId);
        } else {
          source = sources.find((s) => s.isMeta()) || sources[0];
        }
      } else if (req.ncSourceId) {
        source = await Source.get(req.context, req.ncSourceId);
      }

      // todo: replace with better error and this is not an expected error
      if (!source) {
        NcError.notFound('Source not found or source id not extracted');
      }

      if (
        source.is_schema_readonly &&
        sourceRestrictions[SourceRestriction.SCHEMA_READONLY][permissionName]
      ) {
        NcError.sourceMetaReadOnly(source.alias);
      }

      if (
        source.is_data_readonly &&
        sourceRestrictions[SourceRestriction.DATA_READONLY][permissionName]
      ) {
        NcError.sourceDataReadOnly(source.alias);
      }
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
      extendedScope,
    }: {
      scope?: string;
      allowedRoles?: (OrgUserRoles | string)[];
      blockApiTokenAccess?: boolean;
      extendedScope?: string;
    } = {},
  ) =>
  (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    SetMetadata('permission', permissionName)(target, key, descriptor);
    SetMetadata('scope', scope)(target, key, descriptor);
    // extendedScope is used to allow access based on extended scope in which permission is prefixed with scope name and separated by underscore
    SetMetadata('extendedScope', extendedScope)(target, key, descriptor);
    SetMetadata('allowedRoles', allowedRoles)(target, key, descriptor);
    SetMetadata('blockApiTokenAccess', blockApiTokenAccess)(
      target,
      key,
      descriptor,
    );
    UseInterceptors(AclMiddleware)(target, key, descriptor);
  };

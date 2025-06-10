import {
  Injectable,
  Logger,
  SetMetadata,
  UseInterceptors,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  CloudOrgUserRoles,
  extractRolesObj,
  NcApiVersion,
  OrgUserRoles,
  ProjectRoles,
  SourceRestriction,
  ViewLockType,
  WorkspaceUserRoles,
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
  Integration,
  MCPToken,
  Model,
  Sort,
  Source,
  SyncSource,
  View,
} from '~/models';
import rolePermissions, {
  generateReadablePermissionErr,
  sourceRestrictions,
} from '~/utils/acl';
import { NcError } from '~/helpers/catchError';
import { GlobalGuard } from '~/guards/global/global.guard';
import { JwtStrategy } from '~/strategies/jwt.strategy';
import { RootScopes } from '~/utils/globals';
import Noco from '~/Noco';

export const rolesLabel = {
  [OrgUserRoles.SUPER_ADMIN]: 'Super Admin',
  [OrgUserRoles.CREATOR]: 'Org Creator',
  [OrgUserRoles.VIEWER]: 'Org Viewer',
  [WorkspaceUserRoles.OWNER]: 'Workspace Owner',
  [WorkspaceUserRoles.CREATOR]: 'Workspace Creator',
  [WorkspaceUserRoles.VIEWER]: 'Workspace Viewer',
  [WorkspaceUserRoles.EDITOR]: 'Workspace Editor',
  [WorkspaceUserRoles.COMMENTER]: 'Workspace Commenter',
  [ProjectRoles.OWNER]: 'Base Owner',
  [ProjectRoles.CREATOR]: 'Base Creator',
  [ProjectRoles.VIEWER]: 'Base Viewer',
  [ProjectRoles.EDITOR]: 'Base Editor',
  [ProjectRoles.COMMENTER]: 'Base Commenter',
};

const VIEW_KEY = Symbol('view');

export function getRolesLabels(
  roles: (OrgUserRoles | WorkspaceUserRoles | ProjectRoles | string)[],
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const logger: Logger = new Logger('AclMiddleware');

const getApiVersionFromUrl = (url: string) => {
  if (url.startsWith('/api/v3')) return NcApiVersion.V3;
  else if (url.startsWith('/api/v2')) return NcApiVersion.V2;
  else if (url.startsWith('/api/v1')) return NcApiVersion.V1;
  return undefined;
};

// todo: refactor name since we are using it as auth guard
@Injectable()
export class ExtractIdsMiddleware implements NestMiddleware, CanActivate {
  async use(req, res, next): Promise<any> {
    const { params } = req;
    let view;

    const context = {
      workspace_id: RootScopes.BYPASS,
      base_id: RootScopes.BYPASS,
      api_version: getApiVersionFromUrl(req.route.path),
    };

    // this is a special route for ws operations we pass 'nc' as base id
    const isInternalApi = !!req.path?.startsWith('/api/v2/internal');
    const isInternalWorkspaceScope = isInternalApi && params.baseId === 'nc';

    req.ncApiVersion = context.api_version;

    // extract base id based on request path params

    if (params.mcpTokenId) {
      const mcpToken = await MCPToken.get(context, params.mcpTokenId);

      if (!mcpToken) {
        NcError.genericNotFound('MCPToken', params.mcpTokenId);
      }

      req.ncBaseId = mcpToken.base_id;
    }

    if (params.baseId || params.baseName) {
      // We allow title for backward compatibility - TODO: we should get rid of it in future
      const base = await Base.getByTitleOrId(
        context,
        params.baseId ?? params.baseName,
      );

      if (!base) {
        if (context.api_version === NcApiVersion.V3) {
          NcError.baseNotFoundV3(params.baseId ?? params.baseName);
        } else {
          NcError.baseNotFound(params.baseId ?? params.baseName);
        }
      }

      if (base) {
        req.ncBaseId = base.id;
        if (params.tableName) {
          // extract model and then source id from model
          const model = await Model.getByAliasOrId(
            {
              workspace_id: base.fk_workspace_id,
              base_id: base.id,
            },
            {
              base_id: base.id,
              aliasOrId: params.tableName,
            },
          );

          if (!model) {
            if (context.api_version === NcApiVersion.V3) {
              NcError.tableNotFoundV3(params.tableId || params.modelId);
            } else {
              NcError.tableNotFound(req.params.tableName);
            }
          }

          req.ncSourceId = model?.source_id;
        }
      }
    }

    if (params.baseId && !isInternalWorkspaceScope) {
      req.ncBaseId = params.baseId;
    } else if (params.dashboardId) {
      req.ncBaseId = params.dashboardId;
    } else if (params.integrationId) {
      const integration = await Integration.get(context, params.integrationId);
      if (!integration) {
        NcError.integrationNotFound(params.integrationId);
      }
      req.ncWorkspaceId = integration.fk_workspace_id;
    } else if (params.tableId || params.modelId) {
      const model = await Model.getByIdOrName(context, {
        id: params.tableId || params.modelId,
      });

      if (!model) {
        if (context.api_version === NcApiVersion.V3) {
          NcError.tableNotFoundV3(params.tableId || params.modelId);
        } else {
          NcError.tableNotFound(params.tableId || params.modelId);
        }
      }

      req.ncBaseId = model.base_id;
      req.ncSourceId = model.source_id;
    } else if (params.viewId) {
      view =
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
      view = await View.get(
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
        NcError.viewNotFound(req.params.publicDataUuid);
      }

      req.ncBaseId = view?.base_id;
      req.ncSourceId = view?.source_id;
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
        NcError.genericNotFound('Webhook', params.hookId);
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

      if (gridViewColumn.fk_view_id) {
        view = await View.get(context, gridViewColumn.fk_view_id);
      }

      req.ncBaseId = gridViewColumn?.base_id;
      req.ncSourceId = gridViewColumn?.source_id;
    } else if (params.formViewColumnId) {
      const formViewColumn = await FormViewColumn.get(
        context,
        params.formViewColumnId,
      );

      if (!formViewColumn) {
        NcError.fieldNotFound(params.formViewColumnId);
      }

      if (formViewColumn.fk_view_id) {
        view = await View.get(context, formViewColumn.fk_view_id);
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

      if (galleryViewColumn.fk_view_id) {
        view = await View.get(context, galleryViewColumn.fk_view_id);
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

      if (filter.fk_view_id) {
        view = await View.get(context, filter.fk_view_id);
      }

      req.ncBaseId = filter.base_id;
      req.ncSourceId = filter.source_id;
    } else if (params.filterParentId) {
      const filter = await Filter.get(context, params.filterParentId);

      if (!filter) {
        NcError.genericNotFound('Filter', params.filterParentId);
      }

      if (filter.fk_view_id) {
        view = await View.get(context, filter.fk_view_id);
      }

      req.ncBaseId = filter.base_id;
      req.ncSourceId = filter.source_id;
    } else if (params.sortId) {
      const sort = await Sort.get(context, params.sortId);

      if (!sort) {
        NcError.genericNotFound('Sort', params.sortId);
      }

      if (sort.fk_view_id) {
        view = await View.get(context, sort.fk_view_id);
      }

      req.ncBaseId = sort.base_id;
      req.ncSourceId = sort.source_id;
    } else if (params.syncId) {
      const syncSource = await SyncSource.get(context, req.params.syncId);

      if (!syncSource) {
        NcError.genericNotFound('Sync Source', req.params.syncId);
      }

      req.ncBaseId = syncSource.base_id;
      req.ncSourceId = syncSource.source_id;
    } else if (params.extensionId) {
      const extension = await Extension.get(context, req.params.extensionId);

      if (!extension) {
        NcError.genericNotFound('Extension', req.params.extensionId);
      }

      req.ncBaseId = extension.base_id;
    }
    // extract fk_model_id from query params only if it's audit post or comments post, get, patch, delete endpoint
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
        if (context.api_version === NcApiVersion.V3) {
          NcError.tableNotFoundV3(params.tableId || params.modelId);
        } else {
          NcError.tableNotFound(req.body.fk_model_id);
        }
      }

      req.ncBaseId = model.base_id;
      req.ncSourceId = model.source_id;
    } else if (
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
        if (context.api_version === NcApiVersion.V3) {
          NcError.tableNotFoundV3(params.tableId || params.modelId);
        } else {
          NcError.tableNotFound(req.query?.fk_model_id);
        }
      }

      req.ncBaseId = model.base_id;
      req.ncSourceId = model.source_id;
    } else if (
      [
        '/api/v1/db/meta/comment/:commentId',
        '/api/v2/meta/comment/:commentId',
        '/api/v1/db/meta/comment/:commentId/resolve',
        '/api/v2/meta/comment/:commentId/resolve',
      ].some((auditPatchPath) => req.route.path === auditPatchPath) &&
      (req.method === 'PATCH' ||
        req.method === 'DELETE' ||
        req.method === 'POST') &&
      req.params.commentId
    ) {
      const audit = await Comment.get(context, params.commentId);

      if (!audit) {
        NcError.genericNotFound('Comment', params.commentId);
      }

      req.ncBaseId = audit.base_id;
      req.ncSourceId = audit.source_id;
    }
    // extract base id from query params only if it's userMe endpoint
    else if (
      ['/auth/user/me', '/api/v1/db/auth/user/me', '/api/v1/auth/user/me'].some(
        (userMePath) => req.route.path === userMePath,
      ) &&
      (req.query.base_id || req.query.workspace_id)
    ) {
      // use base to get workspace id if base id is provided
      if (req.query.base_id) {
        req.ncBaseId = req.query.base_id;
      } else {
        req.ncWorkspaceId = req.query.workspace_id;
      }
    }

    // todo:  verify all scenarios
    // extract workspace id based on request path params or
    // extract base id based on request path params
    if (params.baseName && !req.ncBaseId) {
      // we expect project_name to be id for EE
      const base = await Base.get(context, params.baseName);
      if (base) {
        req.ncBaseId = base.id;
        req.ncWorkspaceId = (base as Base).fk_workspace_id;

        if (req.params.tableName) {
          // extract model and then source id from model
          const model = await Model.getByAliasOrId(context, {
            base_id: base.id,
            aliasOrId: req.params.tableName,
          });

          if (!model) {
            NcError.tableNotFound(req.params.tableName);
          }

          req.ncSourceId = model?.source_id;
        }
      } else {
        NcError.baseNotFound(params.baseName);
      }
    } else if (req.ncBaseId && req.ncBaseId !== 'nc') {
      const base = await Base.get(context, req.ncBaseId);
      if (base) {
        req.ncWorkspaceId = (base as Base).fk_workspace_id;
      } else {
        NcError.baseNotFound(req.ncBaseId);
      }
    } else if (req.params.workspaceId) {
      req.ncWorkspaceId = req.params.workspaceId;
    }
    // extract workspace id from body only if it's base create endpoint
    else if (
      ['/api/v2/meta/bases', '/api/v1/db/meta/projects'].some(
        (baseCreatePath) => req.route.path === baseCreatePath,
      ) &&
      req.method === 'POST' &&
      req.body.fk_workspace_id
    ) {
      req.ncWorkspaceId = req.body.fk_workspace_id;
    }

    // if integration list endpoint is called with baseId, then extract baseId if it's valid
    if (
      req.route.path === '/api/v2/meta/workspaces/:workspaceId/integrations' &&
      req.method === 'GET' &&
      req.query.baseId
    ) {
      // check if baseId is valid and under the workspace
      const base = await Base.get(context, req.query.baseId);
      if (!base || base.fk_workspace_id !== req.ncWorkspaceId) {
        NcError.baseNotFound(req.query.baseId);
      }
      req.ncBaseId = base.id;
    }

    // if view API and view is pesonal view then check if user has access to view
    if (view && view.lock_type === ViewLockType.Personal) {
      req[VIEW_KEY] = view;
    }

    if (!req.ncOrgId && req.params.orgId) {
      req.ncOrgId = req.params.orgId;
    }

    if (!req.ncWorkspaceId) {
      req.ncWorkspaceId = Noco.ncDefaultWorkspaceId;
    }

    req.context = {
      org_id: req.ncOrgId,
      workspace_id: req.ncWorkspaceId,
      base_id: req.ncBaseId,
      api_version: context.api_version,
    };

    await this.additionalValidation({ req, res, next });

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

  // additional validation logic which can be overridden
  protected async additionalValidation(_param: {
    next: any;
    res: any;
    req: any;
  }) {
    // do nothing
  }
}

// todo: refactor and move scope name to enum
function getUserRoleForScope(user: any, scope: string) {
  if (scope === 'workspace') {
    return user?.workspace_roles;
  } else if (scope === 'base') {
    return user?.base_roles;
  } else if (scope === 'cloud-org') {
    return user?.org_roles;
  } else if (scope === 'org') {
    return user?.roles;
  }
}

@Injectable()
export class AclMiddleware implements NestInterceptor {
  constructor(private reflector: Reflector, private jwtStrategy: JwtStrategy) {}

  async aclFn(
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
    context: ExecutionContext,
    req,
  ) {
    // limit user access to organization
    if (
      req.ncWorkspaceId &&
      req.user.extra?.org_id &&
      req.user.extra.org_id !== req.ncOrgId
    ) {
      NcError.forbidden('User access limited to Organization');
    }

    // if user is not defined then run GlobalGuard
    // it's to take care if we are missing @UseGuards(GlobalGuard) in controller
    // todo: later we can move guard part to this middleware or add where it's missing
    if (!req.user) {
      try {
        const guard = new GlobalGuard(this.jwtStrategy);
        await guard.canActivate(context);
      } catch (e) {
        console.log(e);
      }
    }

    if (!req.user?.isAuthorized) {
      NcError.unauthorized('Invalid token');
    }

    const userScopeRole =
      req.user.roles?.[OrgUserRoles.SUPER_ADMIN] === true
        ? OrgUserRoles.SUPER_ADMIN
        : getUserRoleForScope(req.user, scope);

    // extendedScope is used to allow access based on extended scope in which permission is prefixed with scope name and separated by underscore
    const extendedScopeRoles =
      extendedScope && getUserRoleForScope(req.user, extendedScope);

    if (!userScopeRole) {
      if (req.ncApiVersion === NcApiVersion.V3) {
        NcError.forbidden('Unauthorized access');
      } else {
        NcError.forbidden("You don't have permission to access this resource");
      }
    }

    // assign owner role to super admin for all bases
    if (userScopeRole === OrgUserRoles.SUPER_ADMIN) {
      req.user.base_roles = {
        [ProjectRoles.OWNER]: true,
      };
    }

    const roles: Record<string, boolean> = extractRolesObj(userScopeRole);

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
        roles?.['no-access'] ||
        roles?.[WorkspaceUserRoles.OWNER] ||
        roles?.[WorkspaceUserRoles.CREATOR] ||
        roles?.[WorkspaceUserRoles.EDITOR] ||
        roles?.[WorkspaceUserRoles.VIEWER] ||
        roles?.[WorkspaceUserRoles.COMMENTER] ||
        roles?.[WorkspaceUserRoles.NO_ACCESS] ||
        roles?.[OrgUserRoles.SUPER_ADMIN] ||
        roles?.[OrgUserRoles.CREATOR] ||
        roles?.[OrgUserRoles.VIEWER] ||
        roles?.[CloudOrgUserRoles.CREATOR] ||
        roles?.[CloudOrgUserRoles.VIEWER] ||
        roles?.[CloudOrgUserRoles.OWNER]
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
      NcError.forbidden(
        generateReadablePermissionErr(
          permissionName,
          roles,
          extendedScopeRoles,
        ),
      );

      // NcError.forbidden(
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
  }

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

    await this.aclFn(
      permissionName,
      {
        scope,
        allowedRoles,
        blockApiTokenAccess,
        extendedScope,
      },
      context,
      req,
    );

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

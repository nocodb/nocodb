import {
  Injectable,
  Logger,
  SetMetadata,
  UseInterceptors,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  OrgUserRoles,
  ProjectRoles,
  WorkspacePlan,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import { map } from 'rxjs';
import { extractRolesObj } from 'nocodb-sdk';
import type { Observable } from 'rxjs';
import type {
  CallHandler,
  CanActivate,
  ExecutionContext,
  NestInterceptor,
  NestMiddleware,
} from '@nestjs/common';
import {
  Audit,
  Base,
  Column,
  Filter,
  FormViewColumn,
  GalleryViewColumn,
  GridViewColumn,
  Hook,
  Layout,
  Model,
  Sort,
  SyncSource,
  View,
  Widget,
  Workspace,
} from '~/models';
import rolePermissions from '~/utils/acl';
import { NcError } from '~/middlewares/catchError';

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

const logger: Logger = new Logger('AclMiddleware');

const workspacesOnThisServer: string[] = !process.env.NC_WORKSPACE_ID
  ? [] // If process.env.NC_WORKSPACE_ID is empty, set workspaceIds to an empty array
  : process.env.NC_WORKSPACE_ID.split(',').map((value) => value.trim());

// todo: refactor name since we are using it as auth guard
@Injectable()
export class ExtractIdsMiddleware implements NestMiddleware, CanActivate {
  async use(req, res, next): Promise<any> {
    const { params } = req;

    if (params.baseId) {
      req.ncBaseId = params.baseId;
    } else if (params.dashboardId) {
      req.ncBaseId = params.dashboardId;
    } else if (params.tableId || params.modelId) {
      const model = await Model.getByIdOrName({
        id: params.tableId || params.modelId,
      });
      req.ncBaseId = model?.base_id;
    } else if (params.viewId) {
      const view =
        (await View.get(params.viewId)) || (await Model.get(params.viewId));
      req.ncBaseId = view?.base_id;
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
      req.ncBaseId = view?.base_id;
    } else if (params.publicDataUuid) {
      const view = await View.getByUUID(req.params.publicDataUuid);
      req.ncBaseId = view?.base_id;
    } else if (params.hookId) {
      const hook = await Hook.get(params.hookId);
      req.ncBaseId = hook?.base_id;
    } else if (params.gridViewColumnId) {
      const gridViewColumn = await GridViewColumn.get(params.gridViewColumnId);
      req.ncBaseId = gridViewColumn?.base_id;
    } else if (params.formViewColumnId) {
      const formViewColumn = await FormViewColumn.get(params.formViewColumnId);
      req.ncBaseId = formViewColumn?.base_id;
    } else if (params.galleryViewColumnId) {
      const galleryViewColumn = await GalleryViewColumn.get(
        params.galleryViewColumnId,
      );
      req.ncBaseId = galleryViewColumn?.base_id;
    } else if (params.columnId) {
      const column = await Column.get({ colId: params.columnId });
      req.ncBaseId = column?.base_id;
    } else if (params.filterId) {
      const filter = await Filter.get(params.filterId);
      req.ncBaseId = filter?.base_id;
    } else if (params.filterParentId) {
      const filter = await Filter.get(params.filterParentId);
      req.ncBaseId = filter?.base_id;
    } else if (params.sortId) {
      const sort = await Sort.get(params.sortId);
      req.ncBaseId = sort?.base_id;
    } else if (params.layoutId) {
      const layout = await Layout.get(params.layoutId);
      req.ncBaseId = layout?.base_id;
    } else if (params.widgetId) {
      const widget = await Widget.get(params.widgetId);
      const layout = await Layout.get(widget.layout_id);
      req.ncBaseId = layout?.base_id;
    } else if (params.syncId) {
      const syncSource = await SyncSource.get(req.params.syncId);
      req.ncBaseId = syncSource.base_id;
    }
    // extract fk_model_id from query params only if it's audit post endpoint
    else if (
      [
        '/api/v1/db/meta/audits/rows/:rowId/update',
        '/api/v2/meta/audits/rows/:rowId/update',
        '/api/v1/db/meta/audits/comments',
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
      req.ncBaseId = model?.base_id;
    }
    // extract fk_model_id from query params only if it's audit get endpoint
    else if (
      [
        '/api/v2/meta/audits/comments/count',
        '/api/v2/meta/audits/comments',
        '/api/v1/db/meta/audits/comments/count',
        '/api/v1/db/meta/audits/comments',
      ].some((auditReadPath) => req.route.path === auditReadPath) &&
      req.method === 'GET' &&
      req.query.fk_model_id
    ) {
      const model = await Model.getByIdOrName({
        id: req.query?.fk_model_id,
      });
      req.ncBaseId = model?.base_id;
    } else if (
      [
        '/api/v1/db/meta/audits/:auditId/comment',
        '/api/v2/meta/audits/:auditId/comment',
      ].some((auditPatchPath) => req.route.path === auditPatchPath) &&
      req.method === 'PATCH' &&
      req.params.auditId
    ) {
      const audit = await Audit.get(params.auditId);
      req.ncBaseId = audit?.base_id;
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
      const base = await Base.get(params.baseName);
      if (base) {
        req.ncBaseId = base.id;
        req.ncWorkspaceId = (base as Base).fk_workspace_id;
        res.locals.base = base;
      }
    } else if (req.ncBaseId) {
      const base = await Base.get(req.ncBaseId);
      if (base) {
        req.ncWorkspaceId = (base as Base).fk_workspace_id;
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

    if (req.route.path === '/api/v1/workspaces/:workspaceId/status') {
      // skip workspace id check for workspace status update endpoint which is used internally
    } else if (req.ncWorkspaceId && workspacesOnThisServer.length) {
      if (!workspacesOnThisServer.includes(req.ncWorkspaceId)) {
        logger.error(
          `Requested workspace id: ${req.ncWorkspaceId} does not match with listed domain names, This can happen due to incorrect routing rules in LB`,
        );
      }
    } else if (req.ncWorkspaceId) {
      const workspace = await Workspace.get(req.ncWorkspaceId);
      if (!workspace) {
        NcError.badRequest('Invalid workspace id');
      }

      if (
        workspace.plan &&
        workspace.plan !== WorkspacePlan.FREE &&
        process.env.NC_DISABLE_MUX === 'true'
      ) {
        logger.error(
          `id: ${workspace.id} - status: ${workspace.status} - plan: ${workspace.plan} request reached to multi tenant server`,
        );
      }
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
  if (scope === 'workspace') {
    return user?.workspace_roles;
  } else if (scope === 'base') {
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
    const _res = context.switchToHttp().getResponse();

    if (!req.user?.isAuthorized) {
      NcError.unauthorized('Invalid token');
    }

    const userScopeRole = getUserRoleForScope(req.user, scope);

    if (!userScopeRole) {
      NcError.forbidden('Unauthorized access');
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
        roles?.[WorkspaceUserRoles.OWNER] ||
        roles?.[WorkspaceUserRoles.CREATOR] ||
        roles?.[WorkspaceUserRoles.EDITOR] ||
        roles?.[WorkspaceUserRoles.VIEWER] ||
        roles?.[WorkspaceUserRoles.COMMENTER] ||
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

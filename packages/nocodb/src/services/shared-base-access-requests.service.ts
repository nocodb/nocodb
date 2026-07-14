import { Injectable } from '@nestjs/common';
import {
  AppEvents,
  hasMinimumRoleAccess,
  ProjectRoles,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { NcError } from '~/helpers/catchError';
import {
  Base,
  BaseUser,
  SharedBaseAccessRequest,
  User,
} from '~/models';

@Injectable()
export class SharedBaseAccessRequestsService {
  constructor(private readonly appHooksService: AppHooksService) {}

  private async resolveSharedBase(
    context: NcContext,
    sharedBaseUuid: string,
  ) {
    const base = await Base.getByUuid(context, sharedBaseUuid);
    if (!base?.uuid) {
      NcError.baseNotFound(sharedBaseUuid);
    }
    if (base.default_role) {
      NcError.badRequest(
        'Shared base feature is not available for private bases',
      );
    }
    if (base.is_sandbox) {
      NcError.badRequest(
        'Shared links cannot be used on sandbox bases. Share the master base instead.',
      );
    }
    return base;
  }

  private baseContext(base: Base): NcContext {
    return {
      workspace_id: base.fk_workspace_id,
      base_id: base.id,
    } as NcContext;
  }

  private async getEffectiveBaseRoles(
    context: NcContext,
    userId: string,
    baseId: string,
  ) {
    const userWithRoles = await User.getWithRoles(context, userId, {
      baseId,
      workspaceId: context.workspace_id,
    });
    return userWithRoles?.base_roles || null;
  }

  private serializeRequest(
    request: SharedBaseAccessRequest,
    extras: Record<string, any> = {},
  ) {
    return {
      id: request.id,
      base_id: request.base_id,
      fk_workspace_id: request.fk_workspace_id,
      fk_user_id: request.fk_user_id,
      requested_role: request.requested_role,
      status: request.status,
      message: request.message,
      reviewed_by: request.reviewed_by,
      reviewed_at: request.reviewed_at,
      created_at: request.created_at,
      updated_at: request.updated_at,
      ...extras,
    };
  }

  async create(
    context: NcContext,
    param: {
      sharedBaseUuid: string;
      message?: string;
      req: NcRequest;
    },
  ) {
    if (!param.req?.user?.id || !param.req.user.isAuthorized) {
      NcError.unauthorized('Authentication required');
    }

    const base = await this.resolveSharedBase(context, param.sharedBaseUuid);
    const baseCtx = this.baseContext(base);
    const userId = param.req.user.id;

    const baseRoles = await this.getEffectiveBaseRoles(baseCtx, userId, base.id);
    if (
      baseRoles &&
      hasMinimumRoleAccess({ base_roles: baseRoles }, ProjectRoles.EDITOR)
    ) {
      return {
        already_has_access: true,
        base_id: base.id,
        fk_workspace_id: base.fk_workspace_id,
        status: 'approved',
      };
    }

    const existing = await SharedBaseAccessRequest.getByBaseAndUser(
      baseCtx,
      base.id,
      userId,
    );

    if (existing?.status === 'pending') {
      return this.serializeRequest(existing, { already_pending: true });
    }

    if (existing?.status === 'approved') {
      // Role may have been revoked after a previous approval — reopen as pending.
      const reopened = await SharedBaseAccessRequest.update(baseCtx, existing.id!, {
        status: 'pending',
        message: param.message || existing.message || null,
        reviewed_by: null,
        reviewed_at: null,
        requested_role: 'editor',
      });

      this.emitAccessRequest(base, param.req, reopened!);
      return this.serializeRequest(reopened!);
    }

    if (existing?.status === 'rejected') {
      const reopened = await SharedBaseAccessRequest.update(baseCtx, existing.id!, {
        status: 'pending',
        message: param.message || null,
        reviewed_by: null,
        reviewed_at: null,
        requested_role: 'editor',
      });

      this.emitAccessRequest(base, param.req, reopened!);
      return this.serializeRequest(reopened!);
    }

    const created = await SharedBaseAccessRequest.insert(baseCtx, {
      fk_workspace_id: base.fk_workspace_id,
      base_id: base.id,
      fk_user_id: userId,
      requested_role: 'editor',
      status: 'pending',
      message: param.message || null,
    });

    this.emitAccessRequest(base, param.req, created!);
    return this.serializeRequest(created!);
  }

  async getMine(
    context: NcContext,
    param: {
      sharedBaseUuid: string;
      req: NcRequest;
    },
  ) {
    if (!param.req?.user?.id || !param.req.user.isAuthorized) {
      NcError.unauthorized('Authentication required');
    }

    const base = await this.resolveSharedBase(context, param.sharedBaseUuid);
    const baseCtx = this.baseContext(base);
    const userId = param.req.user.id;

    const baseRoles = await this.getEffectiveBaseRoles(baseCtx, userId, base.id);
    if (
      baseRoles &&
      hasMinimumRoleAccess({ base_roles: baseRoles }, ProjectRoles.EDITOR)
    ) {
      return {
        already_has_access: true,
        base_id: base.id,
        fk_workspace_id: base.fk_workspace_id,
        status: 'approved',
      };
    }

    const existing = await SharedBaseAccessRequest.getByBaseAndUser(
      baseCtx,
      base.id,
      userId,
    );

    if (!existing) {
      return {
        status: null,
        base_id: base.id,
        fk_workspace_id: base.fk_workspace_id,
      };
    }

    return this.serializeRequest(existing);
  }

  async list(
    context: NcContext,
    param: {
      baseId: string;
      status?: 'pending' | 'approved' | 'rejected';
    },
  ) {
    const base = await Base.get(context, param.baseId);
    if (!base) NcError.baseNotFound(param.baseId);

    const baseCtx = this.baseContext(base);
    const requests = await SharedBaseAccessRequest.listByBase(
      baseCtx,
      base.id,
      param.status || 'pending',
    );

    const enriched = await Promise.all(
      requests.map(async (request) => {
        const user = await User.get(request.fk_user_id!);
        return this.serializeRequest(request, {
          email: user?.email || null,
          display_name: user?.display_name || null,
          user_meta: user?.meta || null,
        });
      }),
    );

    return enriched;
  }

  async approve(
    context: NcContext,
    param: {
      baseId: string;
      requestId: string;
      req: NcRequest;
    },
  ) {
    const base = await Base.get(context, param.baseId);
    if (!base) NcError.baseNotFound(param.baseId);

    const baseCtx = this.baseContext(base);
    const request = await SharedBaseAccessRequest.get(baseCtx, param.requestId);
    if (!request || request.base_id !== base.id) {
      NcError.notFound('Access request not found');
    }
    if (request.status !== 'pending') {
      NcError.badRequest('Only pending requests can be approved');
    }

    // Shared link may have been disabled after the request was filed.
    if (!base.uuid) {
      NcError.badRequest('Shared base link is no longer active');
    }

    const baseUser = await BaseUser.get(
      baseCtx,
      base.id,
      request.fk_user_id!,
    );

    if (baseUser?.is_mapped && baseUser.roles) {
      await BaseUser.updateRoles(
        baseCtx,
        base.id,
        request.fk_user_id!,
        ProjectRoles.EDITOR,
      );
    } else if (baseUser?.is_mapped) {
      await BaseUser.updateRoles(
        baseCtx,
        base.id,
        request.fk_user_id!,
        ProjectRoles.EDITOR,
      );
    } else {
      await BaseUser.insert(baseCtx, {
        base_id: base.id,
        fk_user_id: request.fk_user_id!,
        roles: ProjectRoles.EDITOR,
        invited_by: param.req.user?.id,
      });
    }

    const updated = await SharedBaseAccessRequest.update(baseCtx, request.id!, {
      status: 'approved',
      reviewed_by: param.req.user?.id,
      reviewed_at: new Date(),
    });

    const requester = await User.get(request.fk_user_id!);
    this.appHooksService.emit(AppEvents.BASE_ACCESS_REQUEST_APPROVED, {
      context: baseCtx,
      base,
      request: updated,
      requester,
      reviewedBy: param.req.user,
      req: param.req,
    } as any);

    return this.serializeRequest(updated!, {
      email: requester?.email || null,
      display_name: requester?.display_name || null,
    });
  }

  async reject(
    context: NcContext,
    param: {
      baseId: string;
      requestId: string;
      req: NcRequest;
    },
  ) {
    const base = await Base.get(context, param.baseId);
    if (!base) NcError.baseNotFound(param.baseId);

    const baseCtx = this.baseContext(base);
    const request = await SharedBaseAccessRequest.get(baseCtx, param.requestId);
    if (!request || request.base_id !== base.id) {
      NcError.notFound('Access request not found');
    }
    if (request.status !== 'pending') {
      NcError.badRequest('Only pending requests can be rejected');
    }

    const updated = await SharedBaseAccessRequest.update(baseCtx, request.id!, {
      status: 'rejected',
      reviewed_by: param.req.user?.id,
      reviewed_at: new Date(),
    });

    const requester = await User.get(request.fk_user_id!);
    this.appHooksService.emit(AppEvents.BASE_ACCESS_REQUEST_REJECTED, {
      context: baseCtx,
      base,
      request: updated,
      requester,
      reviewedBy: param.req.user,
      req: param.req,
    } as any);

    return this.serializeRequest(updated!, {
      email: requester?.email || null,
      display_name: requester?.display_name || null,
    });
  }

  private emitAccessRequest(
    base: Base,
    req: NcRequest,
    request: SharedBaseAccessRequest,
  ) {
    this.appHooksService.emit(AppEvents.BASE_ACCESS_REQUEST, {
      context: this.baseContext(base),
      base,
      request,
      requester: req.user,
      req,
    } as any);
  }
}

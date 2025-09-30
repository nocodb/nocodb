import { Injectable } from '@nestjs/common';
import {
  AppEvents,
  extractRolesObj,
  ProjectRoles,
  UserType,
  type ExtensionReqType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { Extension } from '~/models';
import { hasMinimumRole } from '~/utils/roleHelper';
import { NcError } from '~/helpers/ncError';
import { generateReadablePermissionErr } from 'src/utils/acl';

@Injectable()
export class ExtensionsService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async extensionList(context: NcContext, param: { baseId: string }) {
    return await Extension.list(context, param.baseId);
  }

  async extensionRead(context: NcContext, param: { extensionId: string }) {
    return await Extension.get(context, param.extensionId);
  }

  async extensionCreate(
    context: NcContext,
    param: {
      extension: ExtensionReqType;
      req: NcRequest;
      minAccessRole?: string;
    },
  ) {
    this.verifyMininumRoleAccess({
      user: param.req.user,
      minAccessRole: param.minAccessRole,
      permissionName: 'extensionCreate',
    });

    validatePayload(
      'swagger.json#/components/schemas/ExtensionReq',
      param.extension,
    );

    const res = await Extension.insert(context, {
      ...param.extension,
      fk_user_id: param.req.user.id,
    });

    this.appHooksService.emit(AppEvents.EXTENSION_CREATE, {
      extensionId: res.id,
      extension: param.extension,
      req: param.req,
    });

    return res;
  }

  async extensionUpdate(
    context: NcContext,
    param: {
      extensionId: string;
      extension: ExtensionReqType;
      req: NcRequest;
      minAccessRole?: string;
    },
  ) {
    this.verifyMininumRoleAccess({
      user: param.req.user,
      minAccessRole: param.minAccessRole,
      permissionName: 'extensionUpdate',
    });

    validatePayload(
      'swagger.json#/components/schemas/ExtensionReq',
      param.extension,
    );

    const res = await Extension.update(
      context,
      param.extensionId,
      param.extension,
    );

    this.appHooksService.emit(AppEvents.EXTENSION_UPDATE, {
      extensionId: param.extensionId,
      extension: param.extension,
      req: param.req,
    });

    return res;
  }

  async extensionDelete(
    context: NcContext,
    param: {
      extensionId: string;
      req: NcRequest;
      minAccessRole?: string;
    },
  ) {
    this.verifyMininumRoleAccess({
      user: param.req.user,
      minAccessRole: param.minAccessRole,
      permissionName: 'extensionDelete',
    });

    const res = await Extension.delete(context, param.extensionId);

    this.appHooksService.emit(AppEvents.EXTENSION_DELETE, {
      extensionId: param.extensionId,
      req: param.req,
    });

    return res;
  }

  verifyMininumRoleAccess(param: {
    user: UserType & {
      base_roles?: Record<string, boolean>;
      workspace_roles?: Record<string, boolean>;
    };
    minAccessRole?: string;
    permissionName: string;
  }) {
    if (
      !hasMinimumRole(
        param.user,
        (param.minAccessRole as ProjectRoles) || ProjectRoles.CREATOR,
      )
    ) {
      const roles = extractRolesObj(param.user.base_roles);

      NcError.forbidden(
        generateReadablePermissionErr(param.permissionName, roles, 'base'),
      );
    }
  }
}

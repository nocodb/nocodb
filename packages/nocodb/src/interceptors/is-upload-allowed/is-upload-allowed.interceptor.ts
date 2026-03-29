import { Injectable } from '@nestjs/common';
import {
  extractRolesObj,
  OrgUserRoles,
  ProjectRoles,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import type { Observable } from 'rxjs';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import Noco from '~/Noco';
import { NcError } from '~/helpers/catchError';
import { MetaTable } from '~/utils/globals';

@Injectable()
export class UploadAllowedInterceptor implements NestInterceptor {
  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();

    if (!request['user']?.id) {
      if (!request['user']?.isPublicBase) {
        NcError.unauthorized('Unauthorized');
      }
    }

    try {
      const userRoles = extractRolesObj(request['user'].roles);
      const wsRoles = request['user'].workspace_roles || {};

      if (
        userRoles[OrgUserRoles.SUPER_ADMIN] ||
        userRoles[OrgUserRoles.CREATOR] ||
        userRoles[ProjectRoles.EDITOR] ||
        wsRoles[WorkspaceUserRoles.CREATOR] ||
        wsRoles[WorkspaceUserRoles.OWNER] ||
        !!(await Noco.ncMeta
          .knex(MetaTable.PROJECT_USERS)
          .where(function () {
            this.where('roles', ProjectRoles.OWNER);
            this.orWhere('roles', ProjectRoles.CREATOR);
            this.orWhere('roles', ProjectRoles.EDITOR);
          })
          .andWhere('fk_user_id', request['user'].id)
          .first())
      ) {
        return next.handle();
      }
    } catch {}

    NcError.badRequest('Upload not allowed');
  }
}

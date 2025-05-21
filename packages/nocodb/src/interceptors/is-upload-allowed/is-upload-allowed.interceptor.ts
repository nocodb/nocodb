import { Injectable } from '@nestjs/common';
import { extractRolesObj, OrgUserRoles, ProjectRoles } from 'nocodb-sdk';
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
      if (
        extractRolesObj(request['user'].roles)[OrgUserRoles.SUPER_ADMIN] ||
        extractRolesObj(request['user'].roles)[OrgUserRoles.CREATOR] ||
        extractRolesObj(request['user'].roles)[ProjectRoles.EDITOR] ||
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

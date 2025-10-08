import { Inject, Injectable } from '@nestjs/common';
import { type NcContext, type NcRequest, WorkspaceUserRoles } from 'nocodb-sdk';
import { DuplicateService as DuplicateServiceCE } from 'src/modules/jobs/jobs/export-import/duplicate.service';
import { NcError } from 'src/helpers/catchError';
import type { Roles } from 'nocodb-sdk';
import { type Base, User } from '~/models';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { BasesService } from '~/services/bases.service';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';

@Injectable()
export class DuplicateService extends DuplicateServiceCE {
  constructor(
    @Inject('JobsService') protected readonly jobsService: IJobsService,
    protected readonly basesService: BasesService,
    protected readonly appHooksService: AppHooksService,
  ) {
    super(jobsService, basesService, appHooksService);
  }

  override async handleDifferentWs({
    targetBase,
    context,
    req,
  }: {
    sourceBase: Base;
    targetBase: Base;
    context: NcContext;
    req: NcRequest;
  }) {
    const fk_workspace_id = targetBase.fk_workspace_id;
    const user = req.user;
    const targetWsUser: {
      workspace_roles: Partial<Record<Roles, boolean>>;
    } = await User.getWithRoles(context, user.id, {
      workspaceId: fk_workspace_id,
    });
    if (
      !targetWsUser.workspace_roles[WorkspaceUserRoles.OWNER] &&
      !targetWsUser.workspace_roles[WorkspaceUserRoles.CREATOR]
    ) {
      NcError.unauthorized(
        'You are not authorized to duplicate to selected workspace',
      );
    }
  }
}

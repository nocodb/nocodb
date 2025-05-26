import {
  Body,
  Controller,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AppEvents, ProjectStatus, WorkspaceUserRoles } from 'nocodb-sdk';
import dayjs from 'dayjs';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { GlobalGuard } from '~/guards/global/global.guard';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import Snapshot from '~/models/Snapshot';
import { NcError } from '~/helpers/catchError';
import { Base, WorkspaceUser } from '~/models';
import { BasesService } from '~/services/bases.service';
import { JobTypes } from '~/interface/Jobs';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import Noco from '~/Noco';
import { MetaTable } from '~/cli';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class SnapshotController {
  constructor(
    @Inject('JobsService') private readonly jobsService: IJobsService,
    protected readonly basesService: BasesService,
    protected readonly appHooksService: AppHooksService,
  ) {}

  @Acl('manageSnapshots')
  @Post('/api/v2/meta/bases/:baseId/snapshots')
  async createSnapshot(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseId') baseId: string,
    @Body() body: any,
  ) {
    const base = await Base.get(context, baseId);

    if (!base) {
      throw new Error(`Base not found for id '${baseId}'`);
    }

    const count = await Snapshot.countSnapshotsInBase(context, baseId);

    if (count === 2) {
      NcError.badRequest('You can only have 2 snapshots in a base');
    }

    if (count === 1) {
      const snapshots = await Snapshot.list(context, baseId);

      const lastCreatedSnapshot = snapshots?.sort(
        (a, b) => dayjs(b.created_at).unix() - dayjs(a.created_at).unix(),
      )[0];

      if (dayjs().diff(dayjs(lastCreatedSnapshot.created_at), 'hour') < 3) {
        NcError.badRequest('You can only create a snapshot every 3 hours');
      }
    }

    const source = (await base.getSources())[0];

    if (!source) {
      throw new Error(`Source not found!`);
    }

    const snapshotBase = await this.basesService.baseCreate({
      base: {
        title: base.title,
        status: ProjectStatus.JOB,
        meta: base.meta,
        color: base.color ?? '',
        type: 'database',
        ...(base.fk_workspace_id
          ? { fk_workspace_id: base.fk_workspace_id }
          : {}),
        is_snapshot: true,
      } as any,
      user: { id: req.user.id },
      req: { user: { id: req.user.id }, skipAudit: true } as any,
    });

    const snapshot = await Snapshot.insert(context, {
      base_id: base.id,
      fk_workspace_id: base.fk_workspace_id,
      snapshot_base_id: snapshotBase.id,
      created_by: req.user.id,
      status: ProjectStatus.JOB,
      title: body?.title ?? dayjs().format('Snapshot YYYY-MM-DD HH:mm:ss'),
    });

    const job = await this.jobsService.add(JobTypes.CreateSnapshot, {
      context: {
        workspace_id: base.fk_workspace_id,
        base_id: base.id,
      },
      user: req.user,
      baseId: base.id,
      sourceId: source.id,
      snapshotBaseId: snapshotBase.id,
      snapshot,
      options: {},
      req: {
        user: req.user,
        clientIp: req.clientIp,
        skipAudit: true,
      },
    });

    this.appHooksService.emit(AppEvents.SNAPSHOT_CREATE, {
      snapshot,
      base,
      context,
      req,
    });

    return { id: job.id };
  }

  @Acl('manageSnapshots')
  @Post('/api/v2/meta/bases/:baseId/snapshots/:snapshotId/restore')
  async restoreSnapshot(
    @TenantContext() context: NcContext,
    @Param('snapshotId') snapshotId: string,
    @Req() req: NcRequest,
    @Param('baseId') baseId: string,
    @Body()
    {
      workspaceId,
    }: {
      workspaceId: string;
    },
  ) {
    if (!workspaceId) {
      NcError.badRequest('Workspace id is required');
    }

    const roles = await WorkspaceUser.get(workspaceId, req.user.id);

    if (
      ![WorkspaceUserRoles.CREATOR, WorkspaceUserRoles.OWNER].includes(
        roles.roles as WorkspaceUserRoles,
      )
    ) {
      NcError.forbidden(
        `You don't have permission to restore snapshot in this workspace`,
      );
    }

    const base = await Base.get(context, baseId);

    if (!base) {
      NcError.baseNotFound(baseId);
    }

    const snapshot = await Snapshot.get(context, snapshotId);

    if (!snapshot) {
      NcError.notFound('Snapshot not found');
    }

    if (snapshot.status !== 'success') {
      NcError.badRequest('Snapshot is not ready to restore or has failed');
    }

    const source = (await base.getSources())[0];

    if (!source) {
      throw new Error(`Source not found!`);
    }
    const parentAuditId = await Noco.ncAudit.genNanoid(MetaTable.AUDIT);

    const targetBase = await this.basesService.baseCreate({
      base: {
        title: `${base.title} - ${snapshot.title}`.substring(0, 49),
        status: ProjectStatus.JOB,
        meta: base.meta,
        color: base.color ?? '',
        type: 'database',
        ...(workspaceId
          ? { fk_workspace_id: workspaceId }
          : { fk_workspace_id: base?.fk_workspace_id }),
      } as any,
      user: { id: req.user.id },
      req: {
        user: { id: req.user.id, email: req.user.email },
        ncParentAuditId: parentAuditId,
        ncWorkspaceId: base.fk_workspace_id,
      } as any,
    });

    const sourceBase = await Base.get(context, snapshot.base_id);

    this.appHooksService.emit(AppEvents.SNAPSHOT_RESTORE, {
      snapshot,
      context,
      targetBase,
      sourceBase,
      req,
    });

    const job = await this.jobsService.add(JobTypes.RestoreSnapshot, {
      context: {
        workspace_id: snapshot.fk_workspace_id,
        base_id: snapshot.snapshot_base_id,
      },
      targetContext: {
        workspace_id: workspaceId || targetBase?.fk_workspace_id,
        base_id: targetBase.id,
      },
      user: req.user,
      baseId: snapshot.snapshot_base_id,
      targetBaseId: targetBase.id,
      snapshot,
      options: {},
      req: {
        user: req.user,
        clientIp: req.clientIp,
        ncParentAuditId: parentAuditId,
        ncBaseId: targetBase.id,
        ncWorkspaceId: base.fk_workspace_id,
      },
    });

    return { id: job.id };
  }
}

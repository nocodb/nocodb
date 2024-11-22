import {
  Body,
  Controller,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ProjectStatus } from 'nocodb-sdk';
import dayjs from 'dayjs';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { GlobalGuard } from '~/guards/global/global.guard';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import Snapshot from '~/models/Snapshot';
import { NcError } from '~/helpers/catchError';
import { Base } from '~/models';
import { BasesService } from '~/services/bases.service';
import { JobTypes } from '~/interface/Jobs';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class SnapshotController {
  constructor(
    @Inject('JobsService') private readonly jobsService: IJobsService,
    protected readonly basesService: BasesService,
  ) {}

  // TODO: @DarkPhoenix2704 Add ACL
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
      req: { user: { id: req.user.id } } as any,
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
      },
    });

    return { id: job.id };
  }

  // TODO: @DarkPhoenix2704 Add ACL
  @Post('/api/v2/meta/bases/:baseId/snapshots/:snapshotId/restore')
  async restoreSnapshot(
    @TenantContext() context: NcContext,
    @Param('snapshotId') snapshotId: string,
    @Req() req: NcRequest,
    @Param('baseId') baseId: string,
  ) {
    const base = await Base.get(context, baseId);

    if (!base) {
      NcError.baseNotFound(baseId);
    }

    const snapshot = await Snapshot.get(context, snapshotId);

    if (!snapshot) {
      NcError.notFound('Snapshot not found');
    }

    const source = (await base.getSources())[0];

    if (!source) {
      throw new Error(`Source not found!`);
    }

    const targetBase = await this.basesService.baseCreate({
      base: {
        title: snapshot.title ?? base.title,
        status: ProjectStatus.JOB,
        meta: base.meta,
        color: base.color ?? '',
        type: 'database',
        ...(base.fk_workspace_id
          ? { fk_workspace_id: base.fk_workspace_id }
          : {}),
      } as any,
      user: { id: req.user.id },
      req: { user: { id: req.user.id } } as any,
    });

    const job = await this.jobsService.add(JobTypes.RestoreSnapshot, {
      context: {
        workspace_id: snapshot.fk_workspace_id,
        base_id: snapshot.snapshot_base_id,
      },
      user: req.user,
      baseId: snapshot.snapshot_base_id,
      targetBaseId: targetBase.id,
      snapshot,
      options: {},
      req: {
        user: req.user,
        clientIp: req.clientIp,
      },
    });

    return { id: job.id };
  }
}

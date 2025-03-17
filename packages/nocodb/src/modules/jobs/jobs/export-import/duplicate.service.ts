import { Inject, Injectable, NotImplementedException } from '@nestjs/common';
import {
  AppEvents,
  type NcContext,
  type NcRequest,
  ProjectStatus,
} from 'nocodb-sdk';
import { Base, Source } from '~/models';
import Noco from '~/Noco';
import { MetaTable } from '~/cli';
import { generateUniqueName } from '~/helpers/exportImportHelpers';
import { JobTypes } from '~/interface/Jobs';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { BasesService } from '~/services/bases.service';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';

@Injectable()
export class DuplicateService {
  constructor(
    @Inject('JobsService') protected readonly jobsService: IJobsService,
    protected readonly basesService: BasesService,
    protected readonly appHooksService: AppHooksService,
  ) {}

  async duplicateBase({
    context,
    req,
    baseId,
    sourceId,
    body,
  }: {
    context: NcContext;
    req: NcRequest;
    baseId: string;
    sourceId?: string;
    body?: {
      options?: {
        excludeData?: boolean;
        excludeViews?: boolean;
        excludeHooks?: boolean;
      };
      // override duplicated base
      base?: any;
    };
  }) {
    const base = await Base.get(context, baseId);

    if (!base) {
      throw new Error(`Base not found for id '${baseId}'`);
    }

    const source = sourceId
      ? await Source.get(context, sourceId)
      : (await base.getSources())[0];

    if (!source) {
      throw new Error(`Source not found!`);
    }

    if (
      body.base?.fk_workspace_id &&
      body.base?.fk_workspace_id !== '' &&
      (base.fk_workspace_id || body.base?.fk_workspace_id) &&
      base.fk_workspace_id !== body.base?.fk_workspace_id
    ) {
      await this.handleDifferentWs({
        context,
        req,
        sourceBase: base,
        targetBase: body.base,
      });
    }
    const targetWorkspaceId =
      body.base?.fk_workspace_id ?? context.workspace_id;
    const bases = await Base.list(targetWorkspaceId);

    const targetBaseTitle = body.base?.title ?? base.title;
    const uniqueTitle = generateUniqueName(
      `${targetBaseTitle} copy`,
      bases.map((p) => p.title),
    );

    const parentAuditId = await Noco.ncMeta.genNanoid(MetaTable.AUDIT);

    req.ncParentAuditId = parentAuditId;

    const dupProject = await this.basesService.baseCreate({
      base: {
        title: uniqueTitle,
        status: ProjectStatus.JOB,
        ...(body.base || {}),
      },
      user: {
        id: req.user.id,
        email: req.user.email,
        display_name: req.user.display_name,
      },
      req,
    });

    this.appHooksService.emit(AppEvents.BASE_DUPLICATE_START, {
      sourceBase: base,
      destBase: dupProject,
      user: req.user,
      req,
      context,
      id: parentAuditId,
      options: body?.options,
    });

    const job = await this.jobsService.add(JobTypes.DuplicateBase, {
      context,
      user: req.user,
      baseId: base.id,
      sourceId: source.id,
      dupProjectId: dupProject.id,
      options: body.options || {},
      req: {
        user: req.user,
        clientIp: req.clientIp,
        headers: req.headers,
        ncParentAuditId: parentAuditId,
      },
    });

    return { id: job.id, base_id: dupProject.id };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async handleDifferentWs(params: {
    sourceBase: Base;
    targetBase: Base;
    context: NcContext;
    req: NcRequest;
  }) {
    throw new NotImplementedException();
  }
}

import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { encryptPropIfRequired } from '~/utils/encryptDecrypt';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { DbServer, Workspace } from '~/models';
import { jdbcToXcConfig, metaUrlToDbConfig } from '~/utils/nc-config';
import { NcError } from '~/helpers/ncError';
import { JobTypes } from '~/interface/Jobs';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';

@Controller()
export class DbServerController {
  constructor(
    @Inject('JobsService') protected readonly jobsService: IJobsService,
  ) {}

  @Get('/internal/db-server')
  @UseGuards(MetaApiLimiterGuard, AuthGuard('basic'))
  async list() {
    return DbServer.list();
  }

  @Post('/internal/db-server')
  @UseGuards(MetaApiLimiterGuard, AuthGuard('basic'))
  async updateStatus(
    @Body()
    body: {
      title: string;
      url: string;
      conditions?: Record<string, string>;
      is_shared?: boolean;
      is_meta_url?: boolean;
    },
  ) {
    const { url, is_meta_url, ...rest } = body;

    const rawConfig = is_meta_url
      ? await metaUrlToDbConfig(url)
      : jdbcToXcConfig(url);

    const config = encryptPropIfRequired({ data: { config: rawConfig } });

    const dbServer = await DbServer.insert({
      ...rest,
      config,
    });

    return dbServer;
  }

  @Patch('/internal/db-server/:dbServerId')
  @UseGuards(MetaApiLimiterGuard, AuthGuard('basic'))
  async update(
    @Param('dbServerId') dbServerId: string,
    @Body() body: { conditions?: Record<string, string> },
  ) {
    const dbServer = await DbServer.getWithConfig(dbServerId);
    if (!dbServer) NcError.genericNotFound('DbServer', dbServerId);

    const updatedDbServer = await DbServer.update(dbServerId, {
      conditions: body.conditions,
    });

    return updatedDbServer;
  }

  @Post('/internal/db-server/workspace/:workspaceId/migrate')
  @UseGuards(MetaApiLimiterGuard, AuthGuard('basic'))
  async migrate(
    @Param('workspaceId') workspaceId: string,
    @Body() body: { conditions?: Record<string, string> },
  ) {
    const workspace = await Workspace.get(workspaceId);
    if (!workspace) NcError.genericNotFound('Workspace', workspaceId);

    const job = await this.jobsService.add(JobTypes.CloudDbMigrate, {
      workspaceId,
      conditions: body.conditions,
    });

    return {
      id: job.id,
    };
  }
}

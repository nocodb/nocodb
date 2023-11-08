import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import isDocker from 'is-docker';
import { ProjectReqType } from 'nocodb-sdk';
import type { BaseType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import Noco from '~/Noco';
import { packageVersion } from '~/utils/packageVersion';
import { BasesService } from '~/services/bases.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { Filter } from '~/models';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
export class BasesController {
  constructor(protected readonly projectsService: BasesService) {}

  @Acl('baseList', {
    scope: 'org',
  })
  @Get(['/api/v1/db/meta/projects/', '/api/v2/meta/bases/'])
  async list(@Query() queryParams: Record<string, any>, @Req() req: Request) {
    const bases = await this.projectsService.baseList({
      user: req.user,
      query: queryParams,
    });
    return new PagedResponseImpl(bases as BaseType[], {
      count: bases.length,
      limit: bases.length,
    });
  }

  @Acl('baseInfoGet')
  @Get([
    '/api/v1/db/meta/projects/:baseId/info',
    '/api/v2/meta/bases/:baseId/info',
  ])
  async baseInfoGet() {
    return {
      Node: process.version,
      Arch: process.arch,
      Platform: process.platform,
      Docker: isDocker(),
      RootDB: Noco.getConfig()?.meta?.db?.client,
      PackageVersion: packageVersion,
    };
  }

  @Acl('baseGet')
  @Get(['/api/v1/db/meta/projects/:baseId', '/api/v2/meta/bases/:baseId'])
  async baseGet(@Param('baseId') baseId: string) {
    const base = await this.projectsService.getProjectWithInfo({
      baseId: baseId,
    });

    this.projectsService.sanitizeProject(base);

    return base;
  }

  @Acl('baseUpdate')
  @Patch(['/api/v1/db/meta/projects/:baseId', '/api/v2/meta/bases/:baseId'])
  async baseUpdate(
    @Param('baseId') baseId: string,
    @Body() body: Record<string, any>,
    @Req() req: Request,
  ) {
    const base = await this.projectsService.baseUpdate({
      baseId,
      base: body,
      user: req.user,
      req,
    });

    return base;
  }

  @Acl('baseDelete')
  @Delete(['/api/v1/db/meta/projects/:baseId', '/api/v2/meta/bases/:baseId'])
  async baseDelete(@Param('baseId') baseId: string, @Req() req: Request) {
    const deleted = await this.projectsService.baseSoftDelete({
      baseId,
      user: req.user,
      req,
    });

    return deleted;
  }

  @Acl('baseCreate', {
    scope: 'org',
  })
  @Post(['/api/v1/db/meta/projects', '/api/v2/meta/bases'])
  @HttpCode(200)
  async baseCreate(@Body() baseBody: ProjectReqType, @Req() req: Request) {
    const base = await this.projectsService.baseCreate({
      base: baseBody,
      req,
      user: req['user'],
    });

    return base;
  }

  @Acl('hasEmptyOrNullFilters')
  @Get([
    '/api/v1/db/meta/projects/:baseId/has-empty-or-null-filters',
    '/api/v2/meta/bases/:baseId/has-empty-or-null-filters',
  ])
  async hasEmptyOrNullFilters(@Param('baseId') baseId: string) {
    return await Filter.hasEmptyOrNullFilters(baseId);
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PagedResponseImpl } from 'src/helpers/PagedResponse';
import { ProjectReqType } from 'nocodb-sdk';
import { BasesController as BasesControllerCE } from 'src/controllers/bases.controller';
import type { BaseType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { BasesService } from '~/services/bases.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
export class BasesController extends BasesControllerCE {
  constructor(protected readonly basesService: BasesService) {
    super(basesService);
  }

  @Acl('baseList', {
    scope: 'workspace',
  })
  @Get(['/api/v1/db/meta/projects/', '/api/v2/meta/bases/'])
  async list(@Query() queryParams: Record<string, any>, @Request() req) {
    const bases = await this.projectsService.baseList({
      user: req.user,
      query: queryParams,
    });
    return new PagedResponseImpl(bases as BaseType[], {
      count: bases.length,
      limit: bases.length,
    });
  }

  @Acl('baseCreate', {
    scope: 'workspace',
  })
  @Post(['/api/v1/db/meta/projects', '/api/v2/meta/bases'])
  @HttpCode(200)
  async baseCreate(@Body() baseBody: ProjectReqType, @Request() req) {
    const base = await this.projectsService.baseCreate({
      base: baseBody,
      user: req['user'],
      req
    });

    return base;
  }
}

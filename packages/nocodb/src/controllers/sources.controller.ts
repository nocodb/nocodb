import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BaseReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { SourcesService } from '~/services/sources.service';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { maskKnexConfig } from '~/helpers/responseHelpers';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class SourcesController {
  constructor(private readonly sourcesService: SourcesService) {}

  @Get([
    '/api/v1/db/meta/projects/:baseId/bases/:sourceId',
    '/api/v2/meta/bases/:baseId/sources/:sourceId',
  ])
  @Acl('baseGet')
  async baseGet(
    @TenantContext() context: NcContext,
    @Param('sourceId') sourceId: string,
  ) {
    const source = await this.sourcesService.baseGetWithConfig(context, {
      sourceId,
    });

    if (source.isMeta()) {
      source.config = undefined;
    }
    source.integration_config = undefined;

    maskKnexConfig(source);

    return source;
  }

  @Patch([
    '/api/v1/db/meta/projects/:baseId/bases/:sourceId',
    '/api/v2/meta/bases/:baseId/sources/:sourceId',
  ])
  @Acl('baseUpdate')
  async baseUpdate(
    @TenantContext() context: NcContext,
    @Param('sourceId') sourceId: string,
    @Param('baseId') baseId: string,
    @Body() body: BaseReqType,
    @Req() req: NcRequest,
  ) {
    const source = await this.sourcesService.baseUpdate(context, {
      sourceId,
      source: body,
      baseId,
      req,
    });

    source.config = undefined;
    source.integration_config = undefined;

    return source;
  }

  @Get([
    '/api/v1/db/meta/projects/:baseId/bases',
    '/api/v2/meta/bases/:baseId/sources',
  ])
  @Acl('baseList')
  async baseList(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
  ) {
    const sources = await this.sourcesService.baseList(context, {
      baseId,
    });

    for (const source of sources) {
      source.config = undefined;
      source.integration_config = undefined;
    }

    return new PagedResponseImpl(sources, {
      count: sources.length,
      limit: sources.length,
    });
  }
}

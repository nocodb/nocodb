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
import { FilterReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { FiltersService } from '~/services/filters.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { FiltersV3Service } from '~/services/v3/filters-v3.service';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class FiltersV3Controller {
  constructor(protected readonly filtersV3Service: FiltersV3Service) {}

  @Get('/api/v3/meta/views/:viewId/filters')
  @Acl('filterList')
  async filterList(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Param('hookId') hookId: string,
  ) {
    return {
      list: await this.filtersV3Service.filterList(context, {
        viewId,
        hookId,
      }),
    };
  }

  @Post([
    '/api/v3/meta/views/:viewId/filters',
    '/api/v3/meta/hooks/:hookId/filters',
    '/api/v3/meta/links/:linkColumnId/filters',
  ])
  @HttpCode(200)
  @Acl('filterCreate')
  async filterCreate(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Param('linkColumnId') linkColumnId: string,
    @Param('hookId') hookId: string,
    @Body() body: FilterReqType,
    @Req() req: NcRequest,
  ) {
    const filter = await this.filtersV3Service.filterCreate(context, {
      filter: body,
      viewId: viewId,
      hookId: hookId,
      linkColumnId,
      user: req.user,
      req,
    });
    return filter;
  }

  @Patch('/api/v3/meta/filters/:filterId')
  @Acl('filterUpdate')
  async filterUpdate(
    @TenantContext() context: NcContext,
    @Param('filterId') filterId: string,
    @Body() body: FilterReqType,
    @Req() req: NcRequest,
  ) {
    const filter = await this.filtersV3Service.filterUpdate(context, {
      filterId: filterId,
      filter: body,
      user: req.user,
      req,
    });
    return filter;
  }

  @Delete('/api/v3/meta/filters/:filterId')
  @Acl('filterDelete')
  async filterDelete(
    @TenantContext() context: NcContext,
    @Param('filterId') filterId: string,
    @Req() req: NcRequest,
  ) {
    const filter = await this.filtersV3Service.filterDelete(context, {
      req,
      filterId,
    });
    return filter;
  }
}

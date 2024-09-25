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

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class FiltersController {
  constructor(protected readonly filtersService: FiltersService) {}

  @Get([
    '/api/v1/db/meta/views/:viewId/filters',
    '/api/v2/meta/views/:viewId/filters',
  ])
  @Acl('filterList')
  async filterList(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Query('includeAllFilters') includeAllFilters: string,
  ) {
    return new PagedResponseImpl(
      await this.filtersService.filterList(context, {
        viewId,
        includeAllFilters: includeAllFilters === 'true',
      }),
    );
  }

  @Post([
    '/api/v1/db/meta/views/:viewId/filters',
    '/api/v2/meta/views/:viewId/filters',
  ])
  @HttpCode(200)
  @Acl('filterCreate')
  async filterCreate(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Body() body: FilterReqType,
    @Req() req: NcRequest,
  ) {
    const filter = await this.filtersService.filterCreate(context, {
      filter: body,
      viewId: viewId,
      user: req.user,
      req,
    });
    return filter;
  }

  @Post([
    '/api/v1/db/meta/hooks/:hookId/filters',
    '/api/v2/meta/hooks/:hookId/filters',
  ])
  @HttpCode(200)
  @Acl('hookFilterCreate')
  async hookFilterCreate(
    @TenantContext() context: NcContext,
    @Param('hookId') hookId: string,
    @Body() body: FilterReqType,
    @Req() req: NcRequest,
  ) {
    const filter = await this.filtersService.hookFilterCreate(context, {
      filter: body,
      hookId,
      user: req.user,
      req,
    });
    return filter;
  }

  @Get(['/api/v1/db/meta/filters/:filterId', '/api/v2/meta/filters/:filterId'])
  @Acl('filterGet')
  async filterGet(
    @TenantContext() context: NcContext,
    @Param('filterId') filterId: string,
  ) {
    return await this.filtersService.filterGet(context, { filterId });
  }

  @Get([
    '/api/v1/db/meta/filters/:filterParentId/children',
    '/api/v2/meta/filters/:filterParentId/children',
  ])
  @Acl('filterChildrenList')
  async filterChildrenRead(
    @TenantContext() context: NcContext,
    @Param('filterParentId') filterParentId: string,
  ) {
    return new PagedResponseImpl(
      await this.filtersService.filterChildrenList(context, {
        filterId: filterParentId,
      }),
    );
  }

  @Patch([
    '/api/v1/db/meta/filters/:filterId',
    '/api/v2/meta/filters/:filterId',
  ])
  @Acl('filterUpdate')
  async filterUpdate(
    @TenantContext() context: NcContext,
    @Param('filterId') filterId: string,
    @Body() body: FilterReqType,
    @Req() req: NcRequest,
  ) {
    const filter = await this.filtersService.filterUpdate(context, {
      filterId: filterId,
      filter: body,
      user: req.user,
      req,
    });
    return filter;
  }

  @Delete([
    '/api/v1/db/meta/filters/:filterId',
    '/api/v2/meta/filters/:filterId',
  ])
  @Acl('filterDelete')
  async filterDelete(
    @TenantContext() context: NcContext,
    @Param('filterId') filterId: string,
    @Req() req: NcRequest,
  ) {
    const filter = await this.filtersService.filterDelete(context, {
      req,
      filterId,
    });
    return filter;
  }

  @Get([
    '/api/v1/db/meta/hooks/:hookId/filters',
    '/api/v2/meta/hooks/:hookId/filters',
  ])
  @Acl('hookFilterList')
  async hookFilterList(
    @TenantContext() context: NcContext,
    @Param('hookId') hookId: string,
  ) {
    return new PagedResponseImpl(
      await this.filtersService.hookFilterList(context, {
        hookId: hookId,
      }),
    );
  }
}

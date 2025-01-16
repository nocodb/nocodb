import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FilterCreateV3Type, FilterUpdateV3Type } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { FiltersV3Service } from '~/services/v3/filters-v3.service';

type Filter = {
  field_id: string; // Replace with the actual type if not string
  operator: string; // Replace with the actual type if not string
  value: any; // Replace with the actual type if not any
};

type FilterGroupLevel3 = {
  group_operator: 'AND' | 'OR';
  filters: Filter[];
};

type FilterGroupLevel2 = {
  group_operator: 'AND' | 'OR';
  filters: (Filter | FilterGroupLevel3)[];
};

type FilterGroupLevel1 = {
  group_operator: 'AND' | 'OR';
  filters: (Filter | FilterGroupLevel2)[];
};

export type FilterGroup = FilterGroupLevel1;

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
    @Body() body: FilterCreateV3Type,
    @Req() req: NcRequest,
  ) {
    const filter = await this.filtersV3Service.filterCreate(context, {
      filter: body,
      viewId: viewId,
      user: req.user,
      req,
    });
    return filter;
  }

  @Patch('/api/v3/meta/views/:viewId/filters')
  @Acl('filterUpdate')
  async filterUpdate(
    @TenantContext() context: NcContext,
    @Body() body: FilterUpdateV3Type,
    @Req() req: NcRequest,
    @Param('viewId') viewId: string,
  ) {
    const filter = await this.filtersV3Service.filterUpdate(context, {
      filterId: body.id,
      filter: body,
      user: req.user,
      viewId,
      req,
    });
    return filter;
  }

  @Put('/api/v3/meta/views/:viewId/filters')
  @Acl('filterUpdate')
  async filterReplace(
    @TenantContext() context: NcContext,
    @Body() body: FilterCreateV3Type,
    @Req() req: NcRequest,
    @Param('viewId') viewId: string,
  ) {
    const filter = await this.filtersV3Service.filterReplace(context, {
      filter: body,
      user: req.user,
      req,
      viewId,
    });
    return filter;
  }

  @Delete('/api/v3/meta/views/:viewId/filters')
  @Acl('filterDelete')
  async filterDelete(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Body() body: { id: string },
    @Req() req: NcRequest,
  ) {
    const filter = await this.filtersV3Service.filterDelete(context, {
      req,
      viewId,
      filterId: body.id,
    });
    return filter;
  }
}

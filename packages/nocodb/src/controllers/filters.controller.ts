import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { FilterReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { FiltersService } from '~/services/filters.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class FiltersController {
  constructor(private readonly filtersService: FiltersService) {}

  @Get([
    '/api/v1/db/meta/views/:viewId/filters',
    '/api/v2/meta/views/:viewId/filters',
  ])
  @Acl('filterList')
  async filterList(@Param('viewId') viewId: string) {
    return new PagedResponseImpl(
      await this.filtersService.filterList({
        viewId,
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
    @Param('viewId') viewId: string,
    @Body() body: FilterReqType,
    @Req() req: Request,
  ) {
    const filter = await this.filtersService.filterCreate({
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
    @Param('hookId') hookId: string,
    @Body() body: FilterReqType,
    @Req() req: Request,
  ) {
    const filter = await this.filtersService.hookFilterCreate({
      filter: body,
      hookId,
      user: req.user,
      req,
    });
    return filter;
  }

  @Get(['/api/v1/db/meta/filters/:filterId', '/api/v2/meta/filters/:filterId'])
  @Acl('filterGet')
  async filterGet(@Param('filterId') filterId: string) {
    return await this.filtersService.filterGet({ filterId });
  }

  @Get([
    '/api/v1/db/meta/filters/:filterParentId/children',
    '/api/v2/meta/filters/:filterParentId/children',
  ])
  @Acl('filterChildrenList')
  async filterChildrenRead(@Param('filterParentId') filterParentId: string) {
    return new PagedResponseImpl(
      await this.filtersService.filterChildrenList({
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
    @Param('filterId') filterId: string,
    @Body() body: FilterReqType,
    @Req() req: Request,
  ) {
    const filter = await this.filtersService.filterUpdate({
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
  async filterDelete(@Param('filterId') filterId: string, @Req() req: Request) {
    const filter = await this.filtersService.filterDelete({
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
  async hookFilterList(@Param('hookId') hookId: string) {
    return new PagedResponseImpl(
      await this.filtersService.hookFilterList({
        hookId: hookId,
      }),
    );
  }
}

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
import { SortReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { SortsService } from '~/services/sorts.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class SortsController {
  constructor(private readonly sortsService: SortsService) {}

  @Get([
    '/api/v1/db/meta/views/:viewId/sorts/',
    '/api/v2/meta/views/:viewId/sorts/',
  ])
  @Acl('sortList')
  async sortList(@Param('viewId') viewId: string) {
    return new PagedResponseImpl(
      await this.sortsService.sortList({
        viewId,
      }),
    );
  }

  @Post([
    '/api/v1/db/meta/views/:viewId/sorts/',
    '/api/v2/meta/views/:viewId/sorts/',
  ])
  @HttpCode(200)
  @Acl('sortCreate')
  async sortCreate(
    @Param('viewId') viewId: string,
    @Body() body: SortReqType,
    @Req() req: Request,
  ) {
    const sort = await this.sortsService.sortCreate({
      sort: body,
      viewId,
      req,
    });
    return sort;
  }

  @Get(['/api/v1/db/meta/sorts/:sortId', '/api/v2/meta/sorts/:sortId'])
  @Acl('sortGet')
  async sortGet(@Param('sortId') sortId: string) {
    const sort = await this.sortsService.sortGet({
      sortId,
    });
    return sort;
  }

  @Patch(['/api/v1/db/meta/sorts/:sortId', '/api/v2/meta/sorts/:sortId'])
  @Acl('sortUpdate')
  async sortUpdate(
    @Param('sortId') sortId: string,
    @Body() body: SortReqType,
    @Req() req: Request,
  ) {
    const sort = await this.sortsService.sortUpdate({
      sortId,
      sort: body,
      req,
    });
    return sort;
  }

  @Delete(['/api/v1/db/meta/sorts/:sortId', '/api/v2/meta/sorts/:sortId'])
  @Acl('sortDelete')
  async sortDelete(@Param('sortId') sortId: string, @Req() req: Request) {
    const sort = await this.sortsService.sortDelete({
      sortId,
      req,
    });
    return sort;
  }
}

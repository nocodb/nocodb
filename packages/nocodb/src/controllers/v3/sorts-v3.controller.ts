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
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { SortsV3Service } from '~/services/v3/sorts-v3.service';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class SortsV3Controller {
  constructor(private readonly sortsV3Service: SortsV3Service) {}

  @Get('/api/v3/meta/views/:viewId/sorts')
  @Acl('sortList')
  async sortList(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
  ) {
    return new PagedResponseImpl(
      await this.sortsV3Service.sortList(context, {
        viewId,
      }),
    );
  }

  @Post('/api/v3/meta/views/:viewId/sorts/')
  @HttpCode(200)
  @Acl('sortCreate')
  async sortCreate(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Body() body: SortReqType,
    @Req() req: NcRequest,
  ) {
    const sort = await this.sortsV3Service.sortCreate(context, {
      sort: body,
      viewId,
      req,
    });
    return sort;
  }

  @Get('/api/v3/meta/sorts/:sortId')
  @Acl('sortGet')
  async sortGet(
    @TenantContext() context: NcContext,
    @Param('sortId') sortId: string,
  ) {
    const sort = await this.sortsV3Service.sortGet(context, {
      sortId,
    });
    return sort;
  }

  @Patch('/api/v3/meta/sorts/:sortId')
  @Acl('sortUpdate')
  async sortUpdate(
    @TenantContext() context: NcContext,
    @Param('sortId') sortId: string,
    @Body() body: SortReqType,
    @Req() req: NcRequest,
  ) {
    const sort = await this.sortsV3Service.sortUpdate(context, {
      sortId,
      sort: body,
      req,
    });
    return sort;
  }

  @Delete('/api/v3/meta/sorts/:sortId')
  @Acl('sortDelete')
  async sortDelete(
    @TenantContext() context: NcContext,
    @Param('sortId') sortId: string,
    @Req() req: NcRequest,
  ) {
    const sort = await this.sortsV3Service.sortDelete(context, {
      sortId,
      req,
    });
    return { list: sort };
  }
}

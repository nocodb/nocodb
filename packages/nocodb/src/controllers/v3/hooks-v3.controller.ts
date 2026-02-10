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
import { HookV3CreateV3Type, HookV3UpdateV3Type } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { PREFIX_APIV3_METABASE } from '~/constants/controllers';
import { HooksV3Service } from '~/services/v3/hooks-v3.service';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class HooksV3Controller {
  constructor(private readonly hooksV3Service: HooksV3Service) {}

  @Get(`${PREFIX_APIV3_METABASE}/tables/:tableId/hooks`)
  @Acl('hookList')
  async hookList(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
  ) {
    return {
      list: await this.hooksV3Service.hookList(context, { tableId }),
    };
  }

  @Post(`${PREFIX_APIV3_METABASE}/tables/:tableId/hooks`)
  @HttpCode(200)
  @Acl('hookCreate')
  async hookCreate(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Body() body: HookV3CreateV3Type,
    @Req() req: NcRequest,
  ) {
    return await this.hooksV3Service.hookCreate(context, {
      tableId,
      hook: body,
      req,
    });
  }

  @Get(`${PREFIX_APIV3_METABASE}/hooks/:hookId`)
  @Acl('hookRead')
  async hookRead(
    @TenantContext() context: NcContext,
    @Param('hookId') hookId: string,
  ) {
    return await this.hooksV3Service.hookGet(context, { hookId });
  }

  @Patch(`${PREFIX_APIV3_METABASE}/hooks/:hookId`)
  @Acl('hookUpdate')
  async hookUpdate(
    @TenantContext() context: NcContext,
    @Param('hookId') hookId: string,
    @Body() body: HookV3UpdateV3Type,
    @Req() req: NcRequest,
  ) {
    return await this.hooksV3Service.hookUpdate(context, {
      hookId,
      hook: body,
      req,
    });
  }

  @Delete(`${PREFIX_APIV3_METABASE}/hooks/:hookId`)
  @Acl('hookDelete')
  async hookDelete(
    @TenantContext() context: NcContext,
    @Param('hookId') hookId: string,
    @Req() req: NcRequest,
  ) {
    return await this.hooksV3Service.hookDelete(context, { hookId, req });
  }
}

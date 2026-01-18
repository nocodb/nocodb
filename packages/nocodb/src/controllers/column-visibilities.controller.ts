import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { GlobalGuard } from '~/guards/global/global.guard';
import { ColumnVisibilitiesService } from '~/services/column-visibilities.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class ColumnVisibilitiesController {
  constructor(
    private readonly columnVisibilitiesService: ColumnVisibilitiesService,
  ) {}

  @Post([
    '/api/v1/db/meta/tables/:tableId/column-visibility-rules',
    '/api/v2/meta/tables/:tableId/column-visibility-rules',
  ])
  @HttpCode(200)
  @Acl('columnVisibilitySet')
  async xcVisibilityMetaSetAll(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Body() body: any,
    @Req() req: NcRequest,
  ) {
    await this.columnVisibilitiesService.xcVisibilityMetaSetAll(context, {
      visibilityRule: body,
      baseId: context.base_id,
      tableId,
      req,
    });

    return { msg: 'Column visibility rules have been updated successfully' };
  }

  @Get([
    '/api/v1/db/meta/tables/:tableId/column-visibility-rules',
    '/api/v2/meta/tables/:tableId/column-visibility-rules',
  ])
  @Acl('columnVisibilityList')
  async columnVisibilityList(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
  ) {
    return this.columnVisibilitiesService.xcVisibilityMetaGet(context, {
      tableId,
    });
  }
}

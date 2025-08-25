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
  Request,
  UseGuards,
} from '@nestjs/common';
import { checkForFeature, PlanFeatureTypes } from '~/ee/helpers/paymentHelpers';
import { PREFIX_APIV3_METABASE } from '~/constants/controllers';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { NcContext } from '~/interface/config';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { ViewsV3Service } from '~/services/v3/views-v3.service';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class ViewsV3Controller {
  constructor(private readonly viewsV3Service: ViewsV3Service) {}

  @Get(`${PREFIX_APIV3_METABASE}/tables/:tableId/views`)
  @Acl('viewList')
  async viewList(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Query('includeM2M') includeM2M: string,
    @Request() req,
  ) {
    await checkForFeature(PlanFeatureTypes.FEATURE_API_VIEW_V3, context);

    return new PagedResponseImpl(
      await this.viewsV3Service.getViews(context, {
        tableId,
        req,
      }),
    );
  }

  @Get(`${PREFIX_APIV3_METABASE}/views/:viewId`)
  @Acl('viewGet')
  async viewGet(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Request() req,
  ) {
    await checkForFeature(PlanFeatureTypes.FEATURE_API_VIEW_V3, context);

    const view = await this.viewsV3Service.getView(context, {
      viewId: viewId,
      req,
    });
    return view;
  }

  @Post(`${PREFIX_APIV3_METABASE}/tables/:tableId/views`)
  @HttpCode(200)
  @Acl('viewCreate')
  async viewCreate(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Body() body: any,
    @Request() req,
  ) {
    await checkForFeature(PlanFeatureTypes.FEATURE_API_VIEW_V3, context);

    const view = await this.viewsV3Service.create(context, {
      req,
      tableId,
    });
    return view;
  }

  @Patch(`${PREFIX_APIV3_METABASE}/views/:viewId`)
  @Acl('viewUpdate')
  async viewUpdate(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Request() req,
  ) {
    await checkForFeature(PlanFeatureTypes.FEATURE_API_VIEW_V3, context);

    const view = await this.viewsV3Service.update(context, {
      viewId: viewId,
      req,
    });
    return view;
  }

  @Delete(`${PREFIX_APIV3_METABASE}/views/:viewId`)
  @Acl('viewDelete')
  async viewDelete(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Request() req,
  ) {
    await checkForFeature(PlanFeatureTypes.FEATURE_API_VIEW_V3, context);

    const view = await this.viewsV3Service.delete(context, {
      viewId: viewId,
      req,
    });
    return view;
  }
}

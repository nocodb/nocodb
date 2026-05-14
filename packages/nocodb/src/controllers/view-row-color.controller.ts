import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { NcContext, NcRequest } from 'nocodb-sdk';
import { Req } from '@nestjs/common';
import type { FilterType } from 'nocodb-sdk';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { ViewRowColorService } from '~/services/view-row-color.service';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller('/api/v1/db/meta/views/:viewId')
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class ViewRowColorController {
  constructor(private readonly viewRowColorService: ViewRowColorService) {}

  @Post('/row-color-select')
  @HttpCode(200)
  @Acl('viewRowColorSelectAdd')
  async setViewRowColorSelect(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Req() req: NcRequest,
    @Body()
    body: {
      fk_column_id: string;
      is_set_as_background: boolean;
    },
  ) {
    return await this.viewRowColorService.setRowColoringSelect(context, {
      ...body,
      fk_view_id: viewId,
      req,
    });
  }

  @Post('/row-color-conditions')
  @HttpCode(200)
  @Acl('viewRowColorConditionAdd')
  async addViewRowColorCondition(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Req() req: NcRequest,
    @Body()
    body: {
      color: string;
      is_set_as_background: boolean;
      type?: string;
      nc_order: number;
      fk_target_column_id?: string;
      filter: FilterType;
    },
  ) {
    return await this.viewRowColorService.addRowColoringCondition(context, {
      fk_view_id: viewId,
      condition: {
        color: body.color,
        is_set_as_background: body.is_set_as_background,
        nc_order: body.nc_order,
        type: body.type,
        fk_target_column_id: body.fk_target_column_id,
      },
      filter: body.filter,
      req,
    });
  }

  @Patch('/row-color-conditions/:id')
  @Acl('viewRowColorConditionUpdate')
  async updateViewRowColorCondition(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Param('id') id: string,
    @Req() req: NcRequest,
    @Body()
    body: {
      color: string;
      is_set_as_background: boolean;
      type?: string;
      nc_order: number;
      fk_target_column_id?: string;
    },
  ) {
    return await this.viewRowColorService.updateRowColoringCondition(context, {
      fk_view_id: viewId,
      fk_row_coloring_conditions_id: id,
      condition: {
        color: body.color,
        is_set_as_background: body.is_set_as_background,
        nc_order: body.nc_order,
        type: body.type,
        fk_target_column_id: body.fk_target_column_id,
      },
      req,
    });
  }

  @Delete('/row-color-conditions/:id')
  @Acl('viewRowColorConditionDelete')
  async deleteViewRowColorCondition(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Param('id') id: string,
    @Req() req: NcRequest,
  ) {
    return await this.viewRowColorService.deleteRowColoringCondition(context, {
      fk_view_id: viewId,
      fk_row_coloring_conditions_id: id,
      req,
    });
  }
}

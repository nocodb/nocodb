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
import { NcContext } from 'nocodb-sdk';
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
    @Body()
    body: {
      fk_column_id: string;
      is_set_as_background: boolean;
    },
  ) {
    return await this.viewRowColorService.setRowColoringSelect({
      ...body,
      fk_view_id: viewId,
      context,
    });
  }

  @Post('/row-color-conditions')
  @HttpCode(200)
  @Acl('viewRowColorConditionAdd')
  async addViewRowColorCondition(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Body()
    body: {
      color: string;
      is_set_as_background: boolean;
      nc_order: number;
      filter: FilterType;
    },
  ) {
    return await this.viewRowColorService.addRowColoringCondition({
      ...body,
      fk_view_id: viewId,
      context,
    });
  }

  @Patch('/row-color-conditions/:id')
  @Acl('viewRowColorConditionUpdate')
  async updateViewRowColorCondition(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Param('id') id: string,
    @Body()
    body: {
      color: string;
      is_set_as_background: boolean;
      nc_order: number;
    },
  ) {
    return await this.viewRowColorService.updateRowColoringCondition({
      ...body,
      context,
      fk_view_id: viewId,
      fk_row_coloring_conditions_id: id,
    });
  }

  @Delete('/row-color-conditions/:id')
  @Acl('viewRowColorConditionDelete')
  async deleteViewRowColorCondition(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Param('id') id: string,
  ) {
    return await this.viewRowColorService.deleteRowColoringCondition({
      context,
      fk_view_id: viewId,
      fk_row_coloring_conditions_id: id,
    });
  }
}

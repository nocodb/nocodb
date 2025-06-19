import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { NcContext } from 'nocodb-sdk';
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
  @Acl('viewRowColorSelectAdd')
  async setViewRowColorSelect(
    @TenantContext() context: NcContext,
    @Body() body: any,
  ) {
    return await this.viewRowColorService.setRowColoringSelect({
      ...body,
      context,
    });
  }

  @Post('/row-color-conditions')
  @Acl('viewRowColorConditionAdd')
  async addViewRowColorCondition(
    @TenantContext() context: NcContext,
    @Body() body: any,
  ) {
    return await this.viewRowColorService.addRowColoringCondition({
      ...body,
      context,
    });
  }

  @Patch('/row-color-conditions/:id')
  @Acl('viewRowColorConditionUpdate')
  async updateViewRowColorCondition(
    @TenantContext() context: NcContext,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return await this.viewRowColorService.updateRowColoringCondition({
      ...body,
      context,
      fk_row_coloring_conditions_id: id,
    });
  }

  @Delete('/row-color-conditions/:id')
  @Acl('viewRowColorConditionDelete')
  async deleteViewRowColorCondition(
    @TenantContext() context: NcContext,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return await this.viewRowColorService.deleteRowColoringCondition({
      ...body,
      context,
      fk_row_coloring_conditions_id: id,
    });
  }
}

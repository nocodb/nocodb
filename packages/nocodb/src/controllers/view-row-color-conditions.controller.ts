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

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class ViewRowColorConditionsController {
  constructor(private readonly viewRowColorService: ViewRowColorService) {}

  @Post('/api/v1/view-row-color-conditions')
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

  @Patch('/api/v1/view-row-color-conditions/:id')
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

  @Delete('/api/v1/view-row-color-conditions/:id')
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

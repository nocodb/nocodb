import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ViewColumnReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { ViewColumnsService } from '~/services/view-columns.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

@Controller()
@UseGuards(GlobalGuard)
export class ViewColumnsController {
  constructor(private readonly viewColumnsService: ViewColumnsService) {}

  @Get('/api/v1/db/meta/views/:viewId/columns/')
  @Acl('columnList')
  async columnList(@Param('viewId') viewId: string) {
    return new PagedResponseImpl(
      await this.viewColumnsService.columnList({
        viewId,
      }),
    );
  }

  @Post('/api/v1/db/meta/views/:viewId/columns/')
  @HttpCode(200)
  @Acl('columnAdd')
  async columnAdd(
    @Param('viewId') viewId: string,
    @Body() body: ViewColumnReqType,
  ) {
    const viewColumn = await this.viewColumnsService.columnAdd({
      viewId,
      column: body,
    });
    return viewColumn;
  }

  @Patch('/api/v1/db/meta/views/:viewId/columns/:columnId')
  @Acl('columnUpdate')
  async columnUpdate(
    @Param('viewId') viewId: string,
    @Param('columnId') columnId: string,
    @Body() body: ViewColumnReqType,
  ) {
    const result = await this.viewColumnsService.columnUpdate({
      viewId,
      columnId,
      column: body,
    });
    return result;
  }
}

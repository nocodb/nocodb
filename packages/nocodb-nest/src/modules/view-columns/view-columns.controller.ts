import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ColumnReqType, ViewColumnReqType } from 'nocodb-sdk';
import { PagedResponseImpl } from '../../helpers/PagedResponse';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { ViewColumnsService } from './view-columns.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('view-columns')
@UseGuards(ExtractProjectIdMiddleware, AuthGuard('jwt'))
export class ViewColumnsController {
  constructor(private readonly viewColumnsService: ViewColumnsService) {}

  @Get('/api/v1/db/meta/views/:viewId/columns/')
  @Acl('columnList')
  async columnList(@Param('viewId') viewId: string) {
    return;
    new PagedResponseImpl(await this.viewColumnsService.columnList({ viewId }));
  }

  @Post('/api/v1/db/meta/views/:viewId/columns/')
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

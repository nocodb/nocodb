import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ColumnReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { ColumnsService } from '~/services/columns.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

@Controller()
@UseGuards(GlobalGuard)
export class ColumnsController {
  constructor(private readonly columnsService: ColumnsService) {}

  @Post('/api/v1/db/meta/tables/:tableId/columns/')
  @HttpCode(200)
  @Acl('columnAdd')
  async columnAdd(
    @Param('tableId') tableId: string,
    @Body() body: ColumnReqType,
    @Request() req: any,
  ) {
    return await this.columnsService.columnAdd({
      tableId,
      column: body,
      req,
      user: req.user,
    });
  }

  @Patch('/api/v1/db/meta/columns/:columnId')
  @Acl('columnUpdate')
  async columnUpdate(
    @Param('columnId') columnId: string,
    @Body() body: ColumnReqType,
    @Request() req: any,
  ) {
    return await this.columnsService.columnUpdate({
      columnId: columnId,
      column: body,
      req,
      user: req.user,
    });
  }

  @Delete('/api/v1/db/meta/columns/:columnId')
  @Acl('columnDelete')
  async columnDelete(@Param('columnId') columnId: string, @Request() req: any) {
    return await this.columnsService.columnDelete({
      columnId,
      req,
      user: req.user,
    });
  }

  @Get('/api/v1/db/meta/columns/:columnId')
  @Acl('columnGet')
  async columnGet(@Param('columnId') columnId: string) {
    return await this.columnsService.columnGet({ columnId });
  }

  @Post('/api/v1/db/meta/columns/:columnId/primary')
  @HttpCode(200)
  @Acl('columnSetAsPrimary')
  async columnSetAsPrimary(@Param('columnId') columnId: string) {
    return await this.columnsService.columnSetAsPrimary({ columnId });
  }
}

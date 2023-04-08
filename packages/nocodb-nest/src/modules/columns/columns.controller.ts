import {
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
  Request,
  Patch,
  Delete,
  Get,
} from '@nestjs/common';
import { ColumnReqType } from 'nocodb-sdk';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { ColumnsService } from './columns.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('columns')
@UseGuards(ExtractProjectIdMiddleware, AuthGuard('jwt'))
export class ColumnsController {
  constructor(private readonly columnsService: ColumnsService) {}

  @Post('/api/v1/db/meta/tables/:tableId/columns/')
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
    });
  }

  @Delete('/api/v1/db/meta/columns/:columnId')
  @Acl('columnDelete')
  async columnDelete(@Param('columnId') columnId: string, @Request() req: any) {
    return await this.columnsService.columnDelete({ columnId, req });
  }

  @Get('/api/v1/db/meta/columns/:columnId')
  @Acl('columnGet')
  async columnGet(@Param('columnId') columnId: string) {
    return await this.columnsService.columnGet({ columnId });
  }

  @Post('/api/v1/db/meta/columns/:columnId/primary')
  @Acl('columnSetAsPrimary')
  async columnSetAsPrimary(@Param('columnId') columnId: string) {
    return await this.columnsService.columnSetAsPrimary({ columnId });
  }
}

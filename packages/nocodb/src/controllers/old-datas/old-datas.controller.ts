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
  Response,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GlobalGuard } from '../../guards/global/global.guard';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { OldDatasService } from './old-datas.service';

@Controller()
@UseGuards(ExtractProjectIdMiddleware, GlobalGuard)
export class OldDatasController {
  constructor(private readonly oldDatasService: OldDatasService) {}

  @Get('/nc/:projectId/api/v1/:tableName')
  @Acl('dataList')
  async dataList(
    @Request() req,
    @Response() res,
    @Param('projectId') projectId: string,
    @Param('tableName') tableName: string,
  ) {
    res.json(
      await this.oldDatasService.dataList({
        query: req.query,
        projectId: projectId,
        tableName: tableName,
      }),
    );
  }

  @Get('/nc/:projectId/api/v1/:tableName/count')
  @Acl('dataCount')
  async dataCount(
    @Request() req,
    @Response() res,
    @Param('projectId') projectId: string,
    @Param('tableName') tableName: string,
  ) {
    res.json(
      await this.oldDatasService.dataCount({
        query: req.query,
        projectId: projectId,
        tableName: tableName,
      }),
    );
  }

  @Post('/nc/:projectId/api/v1/:tableName')
  @HttpCode(200)
  @Acl('dataInsert')
  async dataInsert(
    @Request() req,
    @Response() res,
    @Param('projectId') projectId: string,
    @Param('tableName') tableName: string,
    @Body() body: any,
  ) {
    res.json(
      await this.oldDatasService.dataInsert({
        projectId: projectId,
        tableName: tableName,
        body: body,
        cookie: req,
      }),
    );
  }

  @Get('/nc/:projectId/api/v1/:tableName/:rowId')
  @Acl('dataRead')
  async dataRead(
    @Request() req,
    @Response() res,
    @Param('projectId') projectId: string,
    @Param('tableName') tableName: string,
    @Param('rowId') rowId: string,
  ) {
    res.json(
      await this.oldDatasService.dataRead({
        projectId: projectId,
        tableName: tableName,
        rowId: rowId,
        query: req.query,
      }),
    );
  }

  @Patch('/nc/:projectId/api/v1/:tableName/:rowId')
  @Acl('dataUpdate')
  async dataUpdate(
    @Request() req,
    @Response() res,
    @Param('projectId') projectId: string,
    @Param('tableName') tableName: string,
    @Param('rowId') rowId: string,
  ) {
    res.json(
      await this.oldDatasService.dataUpdate({
        projectId: projectId,
        tableName: tableName,
        body: req.body,
        cookie: req,
        rowId: rowId,
      }),
    );
  }

  @Delete('/nc/:projectId/api/v1/:tableName/:rowId')
  @Acl('dataDelete')
  async dataDelete(
    @Request() req,
    @Response() res,
    @Param('projectId') projectId: string,
    @Param('tableName') tableName: string,
    @Param('rowId') rowId: string,
  ) {
    res.json(
      await this.oldDatasService.dataDelete({
        projectId: projectId,
        tableName: tableName,
        cookie: req,
        rowId: rowId,
      }),
    );
  }
}

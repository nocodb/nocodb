import {
  Controller,
  UseGuards,
  Body,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  Response,
} from '@nestjs/common';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../../../middlewares/extract-project-id/extract-project-id.middleware';
import { AuthGuard } from '@nestjs/passport';
import { Project } from 'src/models';
import { OldDatasService } from './old-datas.service';

@Controller()
@UseGuards(ExtractProjectIdMiddleware, AuthGuard('jwt'))
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
    res.json(await this.oldDatasService.dataRead(req));
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
        rowId,
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
        rowId,
        cookie: req,
      }),
    );
  }
}

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
  async dataList(@Request() req, @Response() res) {
    res.json(await this.oldDatasService.getDataList(req));
  }

  @Get('/nc/:projectId/api/v1/:tableName/count')
  @Acl('dataCount')
  async dataCount(
    @Request() req,
    @Response() res,
    @Param('tableName') tableName: string,
  ) {
    res.json(await this.oldDatasService.getDataCount(req));
  }

  @Post('/nc/:projectId/api/v1/:tableName')
  @Acl('dataInsert')
  async dataInsert(@Request() req, @Response() res) {
    res.json(await this.oldDatasService.dataInsert(req));
  }
}

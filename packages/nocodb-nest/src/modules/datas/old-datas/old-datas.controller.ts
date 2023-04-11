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
} from '@nestjs/common';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../../../middlewares/extract-project-id/extract-project-id.middleware';
import { AuthGuard } from '@nestjs/passport';
import { DatasService } from '../datas.service';

@Controller()
@UseGuards(ExtractProjectIdMiddleware, AuthGuard('jwt'))
export class OldDatasController {
  constructor(private readonly datasService: DatasService) {}

  @Get('/nc/:projectId/api/v1/:tableName')
  @Acl('dataList')
  async dataList(@Request() req) {
    const { model, view } =
      await this.datasService.getViewAndModelFromRequestByAliasOrId(req);
    return await this.datasService.getDataList({
      model,
      view,
      query: req.query,
    });
  }
}

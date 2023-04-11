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

  @Get('/nc/:projectId/api/v1/:tableName/count')
  @Acl('dataCount')
  async dataCount(
    @Request() req,
    @Response() res,
    @Param('tableName') tableName: string,
  ) {
    const { model, view } =
      await this.datasService.getViewAndModelFromRequestByAliasOrId(req);
    const project = await Project.get(model.project_id);
    const countResult = await this.datasService.dataCount({
      query: req.query,
      projectName: project.title,
      tableName: tableName,
      viewName: view.title,
    });
    res.json(countResult);
  }

  @Post('/nc/:projectId/api/v1/:tableName')
  @Acl('dataInsert')
  async dataInsert(
    @Request() req,
    @Response() res,
    @Param('tableName') tableName: string,
    @Body() body: any,
  ) {
    const { model, view } =
      await this.datasService.getViewAndModelFromRequestByAliasOrId(req);
    const project = await Project.get(model.project_id);
    return res.json(
      await this.datasService.dataInsert({
        projectName: project.title,
        tableName: tableName,
        viewName: view.title,
        body: body,
        cookie: req,
      }),
    );
  }
}

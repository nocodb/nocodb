import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { TableReqType } from 'nocodb-sdk';
import {GlobalGuard} from "../../guards/global/global.guard";
import {TablesServiceEe} from "../services/tables.service";
import {Acl} from "../../middlewares/extract-project-and-workspace-id/extract-project-and-workspace-id.middleware";


@Controller()
@UseGuards(GlobalGuard)
export class TablesControllerEe {
  constructor(private readonly tablesService: TablesServiceEe) {}

  @Post('/api/v1/db/meta/projects/:projectId/:baseId/tables/magic')
  @Acl('tableCreateMagic')
  async tableCreateMagic(
    @Param('projectId') projectId: string,
    @Param('baseId') baseId: string,
    @Body() body: TableReqType,
    @Request() req,
  ) {
    return await this.tablesService.tableCreateMagic({
      projectId,
      baseId,
      title: body.title,
      tableName: body.table_name,
      user: req.user,
    });
  }

  @Post('/api/v1/db/meta/projects/:projectId/:baseId/schema/magic')
  @Acl('schemaMagic')
  async schemaMagic(
    @Param('projectId') projectId: string,
    @Param('baseId') baseId: string,
    @Body() body: any,
  ) {
    return await this.tablesService.schemaMagic({
      projectId: projectId,
      baseId: baseId,
      title: body.title,
      schemaName: body.schema_name,
    });
  }
}

import {
  Body,
  Controller,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { TableReqType } from 'nocodb-sdk';
import { TablesController as TablesControllerCE } from 'src/controllers/tables.controller';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { TablesService } from '~/services/tables.service';

@Controller()
@UseGuards(GlobalGuard)
export class TablesController extends TablesControllerCE {
  constructor(private readonly tablesServiceEE: TablesService) {
    super(tablesServiceEE);
  }

  @Post('/api/v1/db/meta/projects/:projectId/:baseId/tables/magic')
  @Acl('tableCreateMagic')
  async tableCreateMagic(
    @Param('projectId') projectId: string,
    @Param('baseId') baseId: string,
    @Body() body: TableReqType,
    @Request() req,
  ) {
    return await this.tablesServiceEE.tableCreateMagic({
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
    return await this.tablesServiceEE.schemaMagic({
      projectId: projectId,
      baseId: baseId,
      title: body.title,
      schemaName: body.schema_name,
    });
  }
}

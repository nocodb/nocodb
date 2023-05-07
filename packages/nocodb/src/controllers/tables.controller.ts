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
import { GlobalGuard } from '../guards/global/global.guard';
import extractRolesObj from '../utils/extractRolesObj';
import { PagedResponseImpl } from '../helpers/PagedResponse';
import {
  ExtractProjectIdMiddleware,
  UseAclMiddleware,
} from '../middlewares/extract-project-id/extract-project-id.middleware';
import { TablesService } from '../services/tables.service';

@Controller()
@UseGuards(ExtractProjectIdMiddleware, GlobalGuard)
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Get([
    '/api/v1/db/meta/projects/:projectId/tables',
    '/api/v1/db/meta/projects/:projectId/:baseId/tables',
  ])
  @UseAclMiddleware({
    permissionName: 'tableList',
  })
  async tableList(
    @Param('projectId') projectId: string,
    @Param('baseId') baseId: string,
    @Query('includeM2M') includeM2M: string,
    @Request() req,
  ) {
    return new PagedResponseImpl(
      await this.tablesService.getAccessibleTables({
        projectId,
        baseId,
        includeM2M: includeM2M === 'true',
        roles: extractRolesObj(req.user.roles),
      }),
    );
  }

  @Post([
    '/api/v1/db/meta/projects/:projectId/tables',
    '/api/v1/db/meta/projects/:projectId/:baseId/tables',
  ])
  @HttpCode(200)
  @UseAclMiddleware({
    permissionName: 'tableCreate',
  })
  async tableCreate(
    @Param('projectId') projectId: string,
    @Param('baseId') baseId: string,
    @Body() body: TableReqType,
    @Request() req,
  ) {
    const result = await this.tablesService.tableCreate({
      projectId: projectId,
      baseId: baseId,
      table: body,
      user: req.user,
    });

    return result;
  }

  @Get('/api/v1/db/meta/tables/:tableId')
  @UseAclMiddleware({
    permissionName: 'tableGet',
  })
  async tableGet(@Param('tableId') tableId: string, @Request() req) {
    const table = await this.tablesService.getTableWithAccessibleViews({
      tableId: req.params.tableId,
      user: req.user,
    });

    return table;
  }

  @Patch('/api/v1/db/meta/tables/:tableId')
  @UseAclMiddleware({
    permissionName: 'tableUpdate',
  })
  async tableUpdate(
    @Param('tableId') tableId: string,
    @Body() body: TableReqType,
    @Request() req,
  ) {
    await this.tablesService.tableUpdate({
      tableId: tableId,
      table: body,
      projectId: req.ncProjectId,
      user: req.user,
    });
    return { msg: 'The table has been updated successfully' };
  }

  @Delete('/api/v1/db/meta/tables/:tableId')
  @UseAclMiddleware({
    permissionName: 'tableDelete',
  })
  async tableDelete(@Param('tableId') tableId: string, @Request() req) {
    const result = await this.tablesService.tableDelete({
      tableId: req.params.tableId,
      user: (req as any).user,
      req,
    });

    return result;
  }

  @Post('/api/v1/db/meta/tables/:tableId/reorder')
  @UseAclMiddleware({
    permissionName: 'tableReorder',
  })
  @HttpCode(200)
  async tableReorder(
    @Param('tableId') tableId: string,
    @Body() body: { order: number },
  ) {
    return this.tablesService.reorderTable({
      tableId,
      order: body.order,
    });
  }
}

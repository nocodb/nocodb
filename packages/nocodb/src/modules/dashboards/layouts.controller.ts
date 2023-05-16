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
import { LayoutReqType } from 'nocodb-sdk';
import { ExtractProjectAndWorkspaceIdMiddleware } from '../../middlewares/extract-project-and-workspace-id/extract-project-and-workspace-id.middleware';
import { GlobalGuard } from '../../guards/global/global.guard';
import extractRolesObj from '../../utils/extractRolesObj';
import { PagedResponseImpl } from '../../helpers/PagedResponse';
import {
  Acl,
  UseAclMiddleware,
} from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { LayoutsService } from './layouts.service';

@Controller()
@UseGuards(ExtractProjectAndWorkspaceIdMiddleware, GlobalGuard)
export class LayoutsController {
  constructor(private readonly layoutService: LayoutsService) {}

  @Get([
    '/api/v1/dashboards/:dashboardId/layouts/:layoutId',
    '/api/v1/layouts/:layoutId',
  ])
  // TODO: Configure ACL here AND for all other new endpoints related to Layout
  // @UseAclMiddleware({
  //   permissionName: 'layoutGet',
  // })
  async layoutGet(@Param('layoutId') layoutId: string, @Request() req) {
    const layout = await this.layoutService.getLayout({
      layoutId,
      // user: req.user,
    });

    return layout;
  }

  @Get(['/api/v1/dashboards/:dashboardId/layouts'])
  // TODO: Configure ACL here AND for all other new endpoints related to Layout
  // @UseAclMiddleware({
  //   permissionName: 'layoutListlayoutList',
  // })
  async layoutList(@Param('dashboardId') dashboardId: string, @Request() req) {
    return new PagedResponseImpl(
      await this.layoutService.getLayouts({
        dashboardId,
        // roles: extractRolesObj(req.user.roles),
      }),
    );
  }

  @Post(['/api/v1/dashboards/:dashboardId/layouts'])
  @HttpCode(200)
  // TODO: Configure ACL here AND for all other new endpoints related to Layout
  // @UseAclMiddleware({
  //   permissionName: 'tableCreate',
  // })
  async layoutCreate(
    @Param('dashboardId') dashboardId: string,
    @Body() body: LayoutReqType,
    @Request() req,
  ) {
    const result = await this.layoutService.layoutCreate({
      dashboardId: dashboardId,
      layout: body,
      // user: req.user,
    });

    return result;
  }

  // @Patch('/api/v1/db/meta/tables/:tableId')
  // @UseAclMiddleware({
  //   permissionName: 'tableUpdate',
  // })
  // async tableUpdate(
  //   @Param('tableId') tableId: string,
  //   @Body() body: TableReqType,
  //   @Request() req,
  // ) {
  //   await this.layoutService.tableUpdate({
  //     tableId: tableId,
  //     table: body,
  //     dashboardId: req.ncDashboardId,
  //     user: req.user,
  //   });
  //   return { msg: 'The table has been updated successfully' };
  // }

  // @Delete('/api/v1/db/meta/tables/:tableId')
  // @UseAclMiddleware({
  //   permissionName: 'tableDelete',
  // })
  // async tableDelete(@Param('tableId') tableId: string, @Request() req) {
  //   const result = await this.layoutService.tableDelete({
  //     tableId: req.params.tableId,
  //     user: (req as any).user,
  //     req,
  //   });

  //   return result;
  // }

  // @Post('/api/v1/db/meta/tables/:tableId/reorder')
  // @UseAclMiddleware({
  //   permissionName: 'tableReorder',
  // })
  // @HttpCode(200)
  // async tableReorder(
  //   @Param('tableId') tableId: string,
  //   @Body() body: { order: number },
  // ) {
  //   return this.layoutService.reorderTable({
  //     tableId,
  //     order: body.order,
  //   });
  // }

  // @Post('/api/v1/dashboards/:dashboardId/:baseId/tables/magic')
  // @Acl('tableCreateMagic')
  // async tableCreateMagic(
  //   @Param('dashboardId') dashboardId: string,
  //   @Param('baseId') baseId: string,
  //   @Body() body: TableReqType,
  //   @Request() req,
  // ) {
  //   return await this.layoutService.tableCreateMagic({
  //     dashboardId,
  //     baseId,
  //     title: body.title,
  //     tableName: body.table_name,
  //     user: req.user,
  //   });
  // }

  // @Post('/api/v1/dashboards/:dashboardId/:baseId/schema/magic')
  // @Acl('schemaMagic')
  // async schemaMagic(
  //   @Param('dashboardId') dashboardId: string,
  //   @Param('baseId') baseId: string,
  //   @Body() body: any,
  // ) {
  //   return await this.layoutService.schemaMagic({
  //     dashboardId: dashboardId,
  //     baseId: baseId,
  //     title: body.title,
  //     schemaName: body.schema_name,
  //   });
  // }
}

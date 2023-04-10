import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ViewUpdateReqType } from 'nocodb-sdk';
import {
  ExtractProjectIdMiddleware,
  UseAclMiddleware,
} from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { WorkspacesService } from './workspaces.service';

@Controller()
@UseGuards(ExtractProjectIdMiddleware, AuthGuard('jwt'))
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get('/api/v1/workspaces/')
  @UseAclMiddleware({
    permissionName: 'workspaceList',
  })
  async list(@Request() req) {
    return await this.workspacesService.list({
      user: req.user,
    });
  }

  @Post('/api/v1/workspaces/')
  @UseAclMiddleware({
    permissionName: 'workspaceCreate',
  })
  async create(@Body() body: any, @Request() req) {
    return await this.workspacesService.create({
      workspaces: body,
      user: req.user,
    });
  }

  // @Patch('/api/v1/db/meta/views/:viewId')
  // @UseAclMiddleware({
  //   permissionName: 'viewUpdate',
  // })
  // async viewUpdate(
  //   @Param('viewId') viewId: string,
  //   @Body() body: ViewUpdateReqType,
  // ) {
  //   const result = await this.viewsService.viewUpdate({
  //     viewId,
  //     view: body,
  //   });
  //   return result;
  // }

  // @Delete('/api/v1/db/meta/views/:viewId')
  // @UseAclMiddleware({
  //   permissionName: 'viewDelete',
  // })
  // async viewDelete(@Param('viewId') viewId: string) {
  //   const result = await this.viewsService.viewDelete({ viewId });
  //   return result;
  // }

  // @Post('/api/v1/db/meta/views/:viewId/show-all')
  // @UseAclMiddleware({
  //   permissionName: 'showAllColumns',
  // })
  // async showAllColumns(
  //   @Param('viewId') viewId: string,
  //   @Query('ignoreIds') ignoreIds: string[],
  // ) {
  //   return await this.viewsService.showAllColumns({
  //     viewId,
  //     ignoreIds,
  //   });
  // }
  // @Post('/api/v1/db/meta/views/:viewId/hide-all')
  // @UseAclMiddleware({
  //   permissionName: 'hideAllColumns',
  // })
  // async hideAllColumns(
  //   @Param('viewId') viewId: string,
  //   @Query('ignoreIds') ignoreIds: string[],
  // ) {
  //   return await this.viewsService.hideAllColumns({
  //     viewId,
  //     ignoreIds,
  //   });
  // }

  // @Post('/api/v1/db/meta/views/:viewId/share')
  // @UseAclMiddleware({
  //   permissionName: 'shareView',
  // })
  // async shareView(@Param('viewId') viewId: string) {
  //   return await this.viewsService.shareView({ viewId });
  // }

  // @Get('/api/v1/db/meta/tables/:tableId/share')
  // async shareViewList(@Param('tableId') tableId: string) {
  //   return new PagedResponseImpl(
  //     await this.viewsService.shareViewList({
  //       tableId,
  //     }),
  //   );
  // }

  // @Patch('/api/v1/db/meta/views/:viewId/share')
  // @UseAclMiddleware({
  //   permissionName: 'shareViewUpdate',
  // })
  // async shareViewUpdate(
  //   @Param('viewId') viewId: string,
  //   @Body() body: ViewUpdateReqType,
  // ) {
  //   return await this.viewsService.shareViewUpdate({
  //     viewId,
  //     sharedView: body,
  //   });
  // }

  // @Delete('/api/v1/db/meta/views/:viewId/share')
  // @UseAclMiddleware({
  //   permissionName: 'shareViewDelete',
  // })
  // async shareViewDelete(@Param('viewId') viewId: string) {
  //   return await this.viewsService.shareViewDelete({ viewId });
  // }
}

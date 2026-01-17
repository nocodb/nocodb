import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NcContext } from '~/interface/config';
import { ScimGroupsService } from '~/ee/services/scim/scim-groups.service';
import { ScimAuthGuard } from '~/ee/guards/scim-auth.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';

@Controller()
@UseGuards(ScimAuthGuard)
export class ScimGroupsController {
  constructor(private readonly scimGroupsService: ScimGroupsService) {}

  @Get('/api/v3/meta/workspaces/:workspaceId/scim/v2/Groups/:groupId')
  async getGroup(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Param('groupId') groupId: string,
  ) {
    return this.scimGroupsService.getGroup(context, {
      workspaceId,
      scimId: groupId,
    });
  }

  @Get('/api/v3/meta/workspaces/:workspaceId/scim/v2/Groups')
  async listGroups(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Query('filter') filter?: string,
    @Query('startIndex') startIndex?: string,
    @Query('count') count?: string,
  ) {
    return this.scimGroupsService.listGroups(context, {
      workspaceId,
      filter,
      startIndex: startIndex ? parseInt(startIndex, 10) : 1,
      count: count ? parseInt(count, 10) : 100,
    });
  }

  @Post('/api/v3/meta/workspaces/:workspaceId/scim/v2/Groups')
  async createGroup(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Body() scimGroup: any,
  ) {
    return this.scimGroupsService.createGroup(context, {
      workspaceId,
      scimGroup,
    });
  }

  @Patch('/api/v3/meta/workspaces/:workspaceId/scim/v2/Groups/:groupId')
  async updateGroup(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Param('groupId') groupId: string,
    @Body() scimGroup: any,
  ) {
    return this.scimGroupsService.updateGroup(context, {
      workspaceId,
      scimId: groupId,
      scimGroup,
    });
  }

  @Delete('/api/v3/meta/workspaces/:workspaceId/scim/v2/Groups/:groupId')
  async deleteGroup(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Param('groupId') groupId: string,
  ) {
    return this.scimGroupsService.deleteGroup(context, {
      workspaceId,
      scimId: groupId,
    });
  }
}

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
  Req,
  UseGuards,
} from '@nestjs/common';
import { GlobalGuard } from '~/guards/global/global.guard';
import { TeamsService } from '~/services/teams.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import type {
  TeamCreateReqType,
  TeamUpdateReqType,
  TeamUserAddReqType,
  TeamUserUpdateReqType,
  InviteCreateReqType,
} from '~/services/teams.service';

@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
export class TeamsController {
  constructor(protected readonly teamsService: TeamsService) {}

  @Get('/api/v2/meta/teams')
  @Acl('teamList')
  async teamList(
    @TenantContext() context: NcContext,
    @Query('fk_org_id') fk_org_id?: string,
    @Query('fk_workspace_id') fk_workspace_id?: string,
  ) {
    return await this.teamsService.teamList(context, {
      fk_org_id,
      fk_workspace_id,
    });
  }

  @Get('/api/v2/meta/teams/:teamId')
  @Acl('teamGet')
  async teamGet(
    @TenantContext() context: NcContext,
    @Param('teamId') teamId: string,
  ) {
    return await this.teamsService.teamGet(context, { teamId });
  }

  @Post('/api/v2/meta/teams')
  @HttpCode(200)
  @Acl('teamCreate')
  async teamCreate(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Body() body: TeamCreateReqType,
  ) {
    return await this.teamsService.teamCreate(context, {
      team: body,
      req,
    });
  }

  @Patch('/api/v2/meta/teams/:teamId')
  @Acl('teamUpdate')
  async teamUpdate(
    @TenantContext() context: NcContext,
    @Param('teamId') teamId: string,
    @Req() req: NcRequest,
    @Body() body: TeamUpdateReqType,
  ) {
    return await this.teamsService.teamUpdate(context, {
      teamId,
      team: body,
      req,
    });
  }

  @Delete('/api/v2/meta/teams/:teamId')
  @Acl('teamDelete')
  async teamDelete(
    @TenantContext() context: NcContext,
    @Param('teamId') teamId: string,
    @Req() req: NcRequest,
  ) {
    return await this.teamsService.teamDelete(context, {
      teamId,
      req,
    });
  }

  @Get('/api/v2/meta/teams/:teamId/members')
  @Acl('teamUserList')
  async teamUserList(
    @TenantContext() context: NcContext,
    @Param('teamId') teamId: string,
  ) {
    return await this.teamsService.teamUserList(context, { teamId });
  }

  @Post('/api/v2/meta/teams/:teamId/members')
  @HttpCode(200)
  @Acl('teamUserAdd')
  async teamUserAdd(
    @TenantContext() context: NcContext,
    @Param('teamId') teamId: string,
    @Req() req: NcRequest,
    @Body() body: TeamUserAddReqType,
  ) {
    return await this.teamsService.teamUserAdd(context, {
      teamId,
      teamUser: body,
      req,
    });
  }

  @Patch('/api/v2/meta/teams/:teamId/members/:userId')
  @Acl('teamUserUpdate')
  async teamUserUpdate(
    @TenantContext() context: NcContext,
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
    @Req() req: NcRequest,
    @Body() body: TeamUserUpdateReqType,
  ) {
    return await this.teamsService.teamUserUpdate(context, {
      teamId,
      userId,
      teamUser: body,
      req,
    });
  }

  @Delete('/api/v2/meta/teams/:teamId/members/:userId')
  @Acl('teamUserRemove')
  async teamUserRemove(
    @TenantContext() context: NcContext,
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
    @Req() req: NcRequest,
  ) {
    return await this.teamsService.teamUserRemove(context, {
      teamId,
      userId,
      req,
    });
  }

  // Generic invite endpoints for both users and teams
  @Post('/api/v2/meta/invites')
  @HttpCode(200)
  @Acl('inviteCreate')
  async inviteCreate(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Body() body: InviteCreateReqType,
  ) {
    return await this.teamsService.inviteCreate(context, {
      invite: body,
      req,
    });
  }

  @Get('/api/v2/meta/invites')
  @Acl('inviteList')
  async inviteList(
    @TenantContext() context: NcContext,
    @Query('resource_type') resource_type?: string,
    @Query('resource_id') resource_id?: string,
  ) {
    return await this.teamsService.inviteList(context, {
      resource_type,
      resource_id,
    });
  }

  @Delete('/api/v2/meta/invites/:inviteId')
  @Acl('inviteDelete')
  async inviteDelete(
    @TenantContext() context: NcContext,
    @Param('inviteId') inviteId: string,
    @Req() req: NcRequest,
  ) {
    return await this.teamsService.inviteDelete(context, {
      inviteId,
      req,
    });
  }
} 
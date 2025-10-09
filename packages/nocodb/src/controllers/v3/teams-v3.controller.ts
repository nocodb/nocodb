import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { GlobalGuard } from '~/guards/global/global.guard';
import { TeamsV3Service } from '~/services/v3/teams-v3.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import type {
  TeamCreateV3ReqType,
  TeamUpdateV3ReqType,
  TeamMembersAddV3ReqType,
  TeamMembersRemoveV3ReqType,
  TeamMembersUpdateV3ReqType,
} from '~/services/v3/teams-v3.types';

@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
export class TeamsV3Controller {
  constructor(protected readonly teamsV3Service: TeamsV3Service) {}

  @Get('/api/v3/meta/:workspaceIdOrORGId/teams')
  @Acl('teamList')
  async teamList(
    @TenantContext() context: NcContext,
    @Param('workspaceIdOrORGId') workspaceIdOrORGId: string,
  ) {
    return await this.teamsV3Service.teamList(context, {
      workspaceIdOrORGId,
    });
  }

  @Get('/api/v3/meta/:workspaceIdOrORGId/teams/:teamId')
  @Acl('teamGet')
  async teamGet(
    @TenantContext() context: NcContext,
    @Param('workspaceIdOrORGId') workspaceIdOrORGId: string,
    @Param('teamId') teamId: string,
  ) {
    return await this.teamsV3Service.teamGet(context, {
      workspaceIdOrORGId,
      teamId,
    });
  }

  @Post('/api/v3/meta/:workspaceIdOrORGId/teams')
  @HttpCode(200)
  @Acl('teamCreate')
  async teamCreate(
    @TenantContext() context: NcContext,
    @Param('workspaceIdOrORGId') workspaceIdOrORGId: string,
    @Req() req: NcRequest,
    @Body() body: TeamCreateV3ReqType,
  ) {
    return await this.teamsV3Service.teamCreate(context, {
      workspaceIdOrORGId,
      team: body,
      req,
    });
  }

  @Patch('/api/v3/meta/:workspaceIdOrORGId/teams/:teamId')
  @Acl('teamUpdate')
  async teamUpdate(
    @TenantContext() context: NcContext,
    @Param('workspaceIdOrORGId') workspaceIdOrORGId: string,
    @Param('teamId') teamId: string,
    @Req() req: NcRequest,
    @Body() body: TeamUpdateV3ReqType,
  ) {
    return await this.teamsV3Service.teamUpdate(context, {
      workspaceIdOrORGId,
      teamId,
      team: body,
      req,
    });
  }

  @Delete('/api/v3/meta/:workspaceIdOrORGId/teams/:teamId')
  @Acl('teamDelete')
  async teamDelete(
    @TenantContext() context: NcContext,
    @Param('workspaceIdOrORGId') workspaceIdOrORGId: string,
    @Param('teamId') teamId: string,
    @Req() req: NcRequest,
  ) {
    return await this.teamsV3Service.teamDelete(context, {
      workspaceIdOrORGId,
      teamId,
      req,
    });
  }

  @Post('/api/v3/meta/:workspaceIdOrORGId/teams/:teamId/members')
  @HttpCode(200)
  @Acl('teamUserAdd')
  async teamMembersAdd(
    @TenantContext() context: NcContext,
    @Param('workspaceIdOrORGId') workspaceIdOrORGId: string,
    @Param('teamId') teamId: string,
    @Req() req: NcRequest,
    @Body() body: TeamMembersAddV3ReqType[],
  ) {
    return await this.teamsV3Service.teamMembersAdd(context, {
      workspaceIdOrORGId,
      teamId,
      members: body,
      req,
    });
  }

  @Delete('/api/v3/meta/:workspaceIdOrORGId/teams/:teamId/members')
  @Acl('teamUserRemove')
  async teamMembersRemove(
    @TenantContext() context: NcContext,
    @Param('workspaceIdOrORGId') workspaceIdOrORGId: string,
    @Param('teamId') teamId: string,
    @Req() req: NcRequest,
    @Body() body: TeamMembersRemoveV3ReqType[],
  ) {
    return await this.teamsV3Service.teamMembersRemove(context, {
      workspaceIdOrORGId,
      teamId,
      members: body,
      req,
    });
  }

  @Patch('/api/v3/meta/:workspaceIdOrORGId/teams/:teamId/members')
  @Acl('teamUserUpdate')
  async teamMembersUpdate(
    @TenantContext() context: NcContext,
    @Param('workspaceIdOrORGId') workspaceIdOrORGId: string,
    @Param('teamId') teamId: string,
    @Req() req: NcRequest,
    @Body() body: TeamMembersUpdateV3ReqType[],
  ) {
    return await this.teamsV3Service.teamMembersUpdate(context, {
      workspaceIdOrORGId,
      teamId,
      members: body,
      req,
    });
  }
}

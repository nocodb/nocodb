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
import type {
  BaseTeamCreateV3ReqType,
  BaseTeamDeleteV3ReqType,
  BaseTeamDetailV3Type,
  BaseTeamListV3Type,
  BaseTeamUpdateV3ReqType,
  BaseTeamV3ResponseType,
} from '~/ee/services/v3/base-teams-v3.types';
import { NcRequest } from '~/interface/config';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { BaseTeamsV3Service } from '~/ee/services/v3/base-teams-v3.service';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext } from '~/interface/config';

// Note: temporary controller for v3 base teams API, these paths will change in future
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
export class BaseTeamsV3Controller {
  constructor(private readonly baseTeamsV3Service: BaseTeamsV3Service) {}

  @Get('/api/v3/meta/bases/:baseId/invites')
  @Acl('baseTeamList', {
    scope: 'base',
  })
  async teamList(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
  ): Promise<BaseTeamListV3Type> {
    return this.baseTeamsV3Service.teamList(context, {
      baseId,
    });
  }

  @Post('/api/v3/meta/bases/:baseId/invites')
  @HttpCode(200)
  @Acl('baseTeamCreate', {
    scope: 'base',
  })
  async teamAdd(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Body() teams: BaseTeamCreateV3ReqType | BaseTeamCreateV3ReqType[],
    @Req() req: NcRequest,
  ): Promise<BaseTeamV3ResponseType | BaseTeamV3ResponseType[]> {
    const teamsArray = Array.isArray(teams) ? teams : [teams];

    if (teamsArray.length === 1) {
      // Single request
      return this.baseTeamsV3Service.teamAdd(context, {
        baseId,
        team: teamsArray[0],
        req,
      });
    } else {
      // Bulk request
      return this.baseTeamsV3Service.teamAddBulk(context, {
        baseId,
        teams: { teams: teamsArray },
        req,
      });
    }
  }

  @Get('/api/v3/meta/bases/:baseId/invites/:teamId')
  @Acl('baseTeamGet', {
    scope: 'base',
  })
  async teamDetail(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Param('teamId') teamId: string,
  ): Promise<BaseTeamDetailV3Type> {
    return this.baseTeamsV3Service.teamDetail(context, {
      baseId,
      teamId,
    });
  }

  @Patch('/api/v3/meta/bases/:baseId/invites')
  @Acl('baseTeamUpdate', {
    scope: 'base',
  })
  async teamUpdate(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Body() team: BaseTeamUpdateV3ReqType | BaseTeamUpdateV3ReqType[],
    @Req() req: NcRequest,
  ): Promise<BaseTeamV3ResponseType | BaseTeamV3ResponseType[]> {
    return this.baseTeamsV3Service.teamUpdate(context, {
      baseId,
      team,
      req,
    });
  }

  @Delete('/api/v3/meta/bases/:baseId/invites')
  @Acl('baseTeamDelete', {
    scope: 'base',
  })
  async teamRemove(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Body() teams: BaseTeamDeleteV3ReqType | BaseTeamDeleteV3ReqType[],
    @Req() req: NcRequest,
  ): Promise<{ msg: string }> {
    const teamsArray = Array.isArray(teams) ? teams : [teams];

    if (teamsArray.length === 1) {
      // Single request
      return this.baseTeamsV3Service.teamRemove(context, {
        baseId,
        team: teamsArray[0],
        req,
      });
    } else {
      // Bulk request
      return this.baseTeamsV3Service.teamRemoveBulk(context, {
        baseId,
        teams: { teams: teamsArray },
        req,
      });
    }
  }
}

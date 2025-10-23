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
import { PlanFeatureTypes } from 'nocodb-sdk';
import type {
  BaseTeamDetailV3Type,
  BaseTeamListV3Type,
  BaseTeamV3ResponseType,
} from '~/ee/services/v3/base-teams-v3.types';
import {
  BaseTeamCreateV3ReqType,
  BaseTeamDeleteV3ReqType,
  BaseTeamUpdateV3ReqType,
} from '~/ee/services/v3/base-teams-v3.types';
import { NcRequest } from '~/interface/config';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { BaseTeamsV3Service } from '~/ee/services/v3/base-teams-v3.service';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext } from '~/interface/config';
import { getFeature } from '~/helpers/paymentHelpers';
import { NcError } from '~/helpers/catchError';

@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
export class BaseTeamsV3Controller {
  constructor(private readonly baseTeamsV3Service: BaseTeamsV3Service) {}

  /**
   * Validates if the user has access to the Teams API.
   * This method checks if the feature is enabled for the workspace.
   * If not, it throws an error indicating that the feature is only available on paid plans.
   */
  async canExecute(context: NcContext) {
    if (
      !(await getFeature(
        PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT,
        context.workspace_id,
      ))
    ) {
      NcError.forbidden(
        'Accessing Teams API is only available on paid plans. Please upgrade your workspace plan to enable this feature. Your current plan is not sufficient.',
      );
    }
  }

  @Get('/api/v3/meta/bases/:baseId/invites')
  @Acl('baseTeamList', {
    scope: 'base',
  })
  async teamList(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
  ): Promise<BaseTeamListV3Type> {
    await this.canExecute(context);
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
    @Body() team: BaseTeamCreateV3ReqType,
    @Req() req: NcRequest,
  ): Promise<BaseTeamV3ResponseType> {
    await this.canExecute(context);
    return this.baseTeamsV3Service.teamAdd(context, {
      baseId,
      team,
      req,
    });
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
    await this.canExecute(context);
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
    await this.canExecute(context);
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
    @Body() team: BaseTeamDeleteV3ReqType | BaseTeamDeleteV3ReqType[],
    @Req() req: NcRequest,
  ): Promise<{ msg: string }> {
    await this.canExecute(context);
    return this.baseTeamsV3Service.teamRemove(context, {
      baseId,
      team,
      req,
    });
  }
}

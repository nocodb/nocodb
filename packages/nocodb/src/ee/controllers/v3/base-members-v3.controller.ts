import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BaseRolesV3Type, PlanFeatureTypes } from 'nocodb-sdk';
import type {
  BaseMemberCreateV3Type,
  BaseMemberDeleteV3Type,
  BaseMemberUpdateV3Type,
} from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { BaseMembersV3Service } from '~/services/v3/base-members-v3.service';
import { getFeature } from '~/helpers/paymentHelpers';

@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
export class BaseMembersV3Controller {
  constructor(protected readonly baseMembersV3Service: BaseMembersV3Service) {}

  async canExecute(context: NcContext) {
    if (
      !(await getFeature(
        PlanFeatureTypes.FEATURE_API_MEMBER_MANAGEMENT,
        context.workspace_id,
      ))
    ) {
      NcError.get(context).invalidRequestBody(
        'Accessing member management api is only available on paid plans. Please upgrade your workspace plan to enable this feature.',
      );
    }
  }

  @Post(['/api/v3/meta/bases/:baseId/members'])
  @HttpCode(200)
  @Acl('userInvite')
  async userInvite(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Req() req: NcRequest,
    @Body()
    baseMembers: BaseMemberCreateV3Type | BaseMemberCreateV3Type[number],
  ): Promise<any> {
    await this.canExecute(context);
    this.validatePayload(baseMembers, false);

    return await this.baseMembersV3Service.userInvite(context, {
      baseId,
      baseMembers: Array.isArray(baseMembers) ? baseMembers : [baseMembers],
      req,
    });
  }

  @Patch(['/api/v3/meta/bases/:baseId/members'])
  @Acl('baseUserUpdate')
  async baseUserUpdate(
    @TenantContext()
    context: NcContext,
    @Param('baseId')
    baseId: string,
    @Req()
    req: NcRequest,
    @Body()
    baseMembers: BaseMemberUpdateV3Type | BaseMemberUpdateV3Type[number],
  ): Promise<any> {
    await this.canExecute(context);
    this.validatePayload(baseMembers, true);

    return await this.baseMembersV3Service.baseMemberUpdate(context, {
      baseMembers: Array.isArray(baseMembers) ? baseMembers : [baseMembers],
      baseId,
      req,
    });
  }

  @Delete(['/api/v3/meta/bases/:baseId/members'])
  @Acl('baseUserDelete')
  async baseUserDelete(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Req() req: NcRequest,
    @Body()
    baseMembers: BaseMemberDeleteV3Type | BaseMemberDeleteV3Type[number],
  ): Promise<any> {
    await this.canExecute(context);
    this.validatePayload(baseMembers, true);

    await this.baseMembersV3Service.baseMemberUpdate(context, {
      baseId,
      req,
      baseMembers: (Array.isArray(baseMembers)
        ? baseMembers
        : [baseMembers]
      ).map((user) => ({
        user_id: user.user_id,
        base_role: BaseRolesV3Type.NoAccess,
      })),
    });
  }

  private validatePayload(
    baseUsers:
      | { user_id?: string; email?: string }[]
      | { user_id?: string; email?: string },
    idOnly = true,
  ) {
    // check email or id is present
    if (
      !baseUsers ||
      (Array.isArray(baseUsers) ? baseUsers : [baseUsers]).some((user) => {
        if (idOnly) return !user.user_id;
        return (!user.user_id && !user.email) || (user.user_id && user.email);
      })
    ) {
      if (idOnly) NcError.badRequest('user_id is required');
      else NcError.badRequest('Either email or user_id is required');
    }
  }
}

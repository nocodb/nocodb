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
import { BaseRolesV3Type } from 'nocodb-sdk';
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

@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
export class BaseMembersV3Controller {
  constructor(protected readonly baseMembersV3Service: BaseMembersV3Service) {}

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
    this.validatePayload(baseMembers);

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
    this.validatePayload(baseMembers);

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
    this.validatePayload(baseMembers);

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
    return {
      msg: 'The user has been deleted successfully',
    };
  }

  private validatePayload(
    baseUsers:
      | { user_id?: string; email?: string }[]
      | { user_id?: string; email?: string },
  ) {
    // check email or id is present
    if (
      !baseUsers ||
      (Array.isArray(baseUsers) ? baseUsers : [baseUsers]).some(
        (user) => !user.user_id && !user.email,
      )
    ) {
      NcError.badRequest('Either email or id is required');
    }
  }
}

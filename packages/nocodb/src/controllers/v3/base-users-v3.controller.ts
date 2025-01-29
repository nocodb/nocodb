import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BaseRolesV3Type } from 'nocodb-sdk';
import type {
  BaseUserCreateV3Type,
  BaseUserDeleteV3Type,
  BaseUserUpdateV3Type,
} from 'nocodb-sdk';
import type { ApiV3DataTransformationBuilder } from '~/utils/api-v3-data-transformation.builder';
import { NcError } from '~/helpers/catchError';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { BaseUsersV3Service } from '~/services/v3/base-users-v3.service';

@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
export class BaseUsersV3Controller {
  private builder: () => ApiV3DataTransformationBuilder;

  constructor(protected readonly baseUsersV3Service: BaseUsersV3Service) {}

  @Get(['/api/v3/meta/bases/:baseId/users'])
  @Acl('baseUserList')
  async userList(
    @TenantContext()
    context: NcContext,
    @Param('baseId')
    baseId: string,
  ) {
    return await this.baseUsersV3Service.userList(context, {
      baseId,
    });
  }

  @Post(['/api/v3/meta/bases/:baseId/users'])
  @Acl('userInvite')
  async userInvite(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Req() req: NcRequest,
    @Body() baseUsers: BaseUserCreateV3Type | BaseUserCreateV3Type[number],
  ): Promise<any> {
    this.validatePayload(baseUsers);

    return await this.baseUsersV3Service.userInvite(context, {
      baseId,
      baseUsers: Array.isArray(baseUsers) ? baseUsers : [baseUsers],
      req,
    });
  }

  @Patch(['/api/v3/meta/bases/:baseId/users'])
  @Acl('baseUserUpdate')
  async baseUserUpdate(
    @TenantContext()
    context: NcContext,
    @Param('baseId')
    baseId: string,
    @Req()
    req: NcRequest,
    @Body() baseUsers: BaseUserUpdateV3Type | BaseUserUpdateV3Type[number],
  ): Promise<any> {
    this.validatePayload(baseUsers);

    return await this.baseUsersV3Service.baseUserUpdate(context, {
      baseUsers: Array.isArray(baseUsers) ? baseUsers : [baseUsers],
      baseId,
      req,
    });
  }

  @Delete(['/api/v3/meta/bases/:baseId/users'])
  @Acl('baseUserDelete')
  async baseUserDelete(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Req() req: NcRequest,
    @Body() baseUsers: BaseUserDeleteV3Type | BaseUserDeleteV3Type[number],
  ): Promise<any> {
    this.validatePayload(baseUsers);

    await this.baseUsersV3Service.baseUserUpdate(context, {
      baseId,
      req,
      baseUsers: (Array.isArray(baseUsers) ? baseUsers : [baseUsers]).map(
        (user) => ({
          id: user.id,
          email: user.email,
          base_role: BaseRolesV3Type.NoAccess,
        }),
      ),
    });
    return {
      msg: 'The user has been deleted successfully',
    };
  }

  private validatePayload(
    baseUsers:
      | { id?: string; email?: string }[]
      | { id?: string; email?: string },
  ) {
    // check email or id is present
    if (
      !baseUsers ||
      (Array.isArray(baseUsers) ? baseUsers : [baseUsers]).some(
        (user) => !user.id && !user.email,
      )
    ) {
      NcError.badRequest('Either email or id is required');
    }
  }
}

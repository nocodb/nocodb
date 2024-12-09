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
import { ProjectRoles, ProjectUserReqType } from 'nocodb-sdk';
import type {
  ProjectUserDeleteV3ReqType,
  ProjectUserV3ReqType,
} from 'nocodb-sdk';
import type { ApiV3DataTransformationBuilder } from '~/utils/api-v3-data-transformation.builder';
import { GlobalGuard } from '~/guards/global/global.guard';
import { NcError } from '~/helpers/catchError';
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
    @Req()
    req: NcRequest,
  ) {
    const baseRoles = Object.keys((req.user as any)?.base_roles ?? {});
    const mode =
      baseRoles.includes(ProjectRoles.OWNER) ||
      baseRoles.includes(ProjectRoles.CREATOR)
        ? 'full'
        : 'viewer';

    return await this.baseUsersV3Service.userList(context, {
      baseId,
      mode,
    });
  }

  @Post(['/api/v3/meta/bases/:baseId/users'])
  @HttpCode(200)
  @Acl('userInvite')
  async userInvite(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Req() req: NcRequest,
    @Body() baseUsers: ProjectUserV3ReqType[],
  ): Promise<any> {
    return await this.baseUsersV3Service.userInvite(context, {
      baseId,
      baseUsers,
      req,
    });
  }

  @Patch(['/api/v3/meta/bases/:baseId/users/:userId'])
  @Acl('baseUserUpdate')
  async baseUserUpdate(
    @TenantContext()
    context: NcContext,
    @Param('baseId')
    baseId: string,
    @Param('userId')
    userId: string,
    @Req()
    req: NcRequest,
    @Body() baseUsers: ProjectUserV3ReqType[],
  ): Promise<any> {
    await this.baseUsersV3Service.baseUserUpdate(context, {
      baseUsers,
      baseId,
      userId,
      req,
    });
    return {
      msg: 'The user has been updated successfully',
    };
  }

  @Delete(['/api/v3/meta/bases/:baseId/users/:userId'])
  @Acl('baseUserDelete')
  async baseUserDelete(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Param('userId') userId: string,
    @Req() req: NcRequest,
    @Body() baseUsers: ProjectUserDeleteV3ReqType[],
  ): Promise<any> {
    await this.baseUsersV3Service.baseUserDelete(context, {
      baseId,
      req,
      baseUsers,
    });
    return {
      msg: 'The user has been deleted successfully',
    };
  }
}

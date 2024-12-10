import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { ProjectUserV3ReqType } from 'nocodb-sdk';
import type { ApiV3DataTransformationBuilder } from '~/utils/api-v3-data-transformation.builder';
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
    @Req()
    req: NcRequest,
  ) {
    return await this.baseUsersV3Service.userList(context, {
      baseId,
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

  @Patch(['/api/v3/meta/bases/:baseId/users'])
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
    return await this.baseUsersV3Service.baseUserUpdate(context, {
      baseUsers,
      baseId,
      userId,
      req,
    });
  }

  /*  @Delete(['/api/v3/meta/bases/:baseId/users'])
  @Acl('baseUserDelete')
  async baseUserDelete(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
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
  }*/
}

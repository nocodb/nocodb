import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { PlanFeatureTypes } from 'nocodb-sdk';
import { NcContext } from '~/interface/config';
import { ScimUsersService } from '~/ee/services/scim/scim-users.service';
import { ScimAuthGuard } from '~/ee/guards/scim-auth.guard';
import { ScimExceptionFilter } from '~/ee/filters/scim-exception/scim-exception.filter';
import { ScimContentTypeInterceptor } from '~/ee/interceptors/scim-content-type/scim-content-type.interceptor';
import { ScimApiLimiterGuard } from '~/ee/guards/scim-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { checkForFeature } from '~/ee/helpers/paymentHelpers';
import { isCloud, isOnPrem } from '~/utils';
import { NcError } from '~/helpers/catchError';

@Controller()
@UseGuards(ScimApiLimiterGuard, ScimAuthGuard)
@UseFilters(ScimExceptionFilter)
@UseInterceptors(ScimContentTypeInterceptor)
export class ScimUsersController {
  constructor(private readonly scimUsersService: ScimUsersService) {}

  private async checkScimFeature(context: NcContext) {
    if (isCloud || isOnPrem) {
      await checkForFeature(context, PlanFeatureTypes.FEATURE_SCIM);
    }
  }

  private validateScimPayload(body: any) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      NcError.badRequest('Invalid SCIM payload: expected a JSON object');
    }
  }

  @Get('/api/v3/meta/workspaces/:workspaceId/scim/v2/Users/:userId')
  async getUser(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
  ) {
    await this.checkScimFeature(context);
    return this.scimUsersService.getUser(context, {
      workspaceId,
      scimId: userId,
    });
  }

  @Get('/api/v3/meta/workspaces/:workspaceId/scim/v2/Users')
  async listUsers(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Query('filter') filter?: string,
    @Query('startIndex') startIndex?: string,
    @Query('count') count?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    await this.checkScimFeature(context);
    return this.scimUsersService.listUsers(context, {
      workspaceId,
      filter,
      startIndex: startIndex ? parseInt(startIndex, 10) : 1,
      count: count ? parseInt(count, 10) : 100,
      sortBy,
      sortOrder,
    });
  }

  @Post('/api/v3/meta/workspaces/:workspaceId/scim/v2/Users')
  @HttpCode(201)
  async createUser(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Body() scimUser: any,
    @Req() req: any,
  ) {
    await this.checkScimFeature(context);
    this.validateScimPayload(scimUser);
    return this.scimUsersService.createUser(context, {
      workspaceId,
      scimUser,
      req,
    });
  }

  @Put('/api/v3/meta/workspaces/:workspaceId/scim/v2/Users/:userId')
  async replaceUser(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @Body() scimUser: any,
    @Req() req: any,
  ) {
    await this.checkScimFeature(context);
    this.validateScimPayload(scimUser);
    return this.scimUsersService.replaceUser(context, {
      workspaceId,
      scimId: userId,
      scimUser,
      req,
    });
  }

  @Patch('/api/v3/meta/workspaces/:workspaceId/scim/v2/Users/:userId')
  async patchUser(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @Body() scimUser: any,
    @Req() req: any,
  ) {
    await this.checkScimFeature(context);
    this.validateScimPayload(scimUser);
    return this.scimUsersService.patchUser(context, {
      workspaceId,
      scimId: userId,
      scimUser,
      req,
    });
  }

  @Delete('/api/v3/meta/workspaces/:workspaceId/scim/v2/Users/:userId')
  @HttpCode(204)
  async deleteUser(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    await this.checkScimFeature(context);
    return this.scimUsersService.deactivateUser(context, {
      workspaceId,
      scimId: userId,
      req,
    });
  }
}

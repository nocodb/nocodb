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
import { NcRequest } from '~/interface/config';
import { NcContext } from '~/interface/config';
import { ScimGroupsService } from '~/ee/services/scim/scim-groups.service';
import { ScimAuthGuard } from '~/ee/guards/scim-auth.guard';
import { ScimExceptionFilter } from '~/ee/filters/scim-exception/scim-exception.filter';
import { ScimContentTypeInterceptor } from '~/ee/interceptors/scim-content-type/scim-content-type.interceptor';
import { ScimApiLimiterGuard } from '~/ee/guards/scim-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcError } from '~/helpers/catchError';

@Controller()
@UseGuards(ScimApiLimiterGuard, ScimAuthGuard)
@UseFilters(ScimExceptionFilter)
@UseInterceptors(ScimContentTypeInterceptor)
export class ScimGroupsController {
  constructor(private readonly scimGroupsService: ScimGroupsService) {}

  private async checkScimFeature(_context: NcContext) {
    // SCIM is available on licensed on-prem (license checked by LicenseGuard)
    // and on cloud enterprise orgs. No workspace-level plan check needed
    // since SCIM is now org-scoped.
  }

  private validateScimPayload(body: any) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      NcError.badRequest('Invalid SCIM payload: expected a JSON object');
    }
  }

  @Get('/api/v3/meta/orgs/:orgId/scim/v2/Groups/:groupId')
  async getGroup(
    @TenantContext() context: NcContext,
    @Param('orgId') orgId: string,
    @Param('groupId') groupId: string,
    @Query('excludedAttributes') excludedAttributes?: string,
  ) {
    await this.checkScimFeature(context);
    return this.scimGroupsService.getGroup(context, {
      orgId,
      scimId: groupId,
      excludedAttributes,
    });
  }

  @Get('/api/v3/meta/orgs/:orgId/scim/v2/Groups')
  async listGroups(
    @TenantContext() context: NcContext,
    @Param('orgId') orgId: string,
    @Query('filter') filter?: string,
    @Query('startIndex') startIndex?: string,
    @Query('count') count?: string,
    @Query('excludedAttributes') excludedAttributes?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    await this.checkScimFeature(context);
    return this.scimGroupsService.listGroups(context, {
      orgId,
      filter,
      startIndex: startIndex ? parseInt(startIndex, 10) : 1,
      count: count ? parseInt(count, 10) : 100,
      excludedAttributes,
      sortBy,
      sortOrder,
    });
  }

  @Post('/api/v3/meta/orgs/:orgId/scim/v2/Groups')
  @HttpCode(201)
  async createGroup(
    @TenantContext() context: NcContext,
    @Param('orgId') orgId: string,
    @Body() scimGroup: any,
    @Req() req: NcRequest,
  ) {
    await this.checkScimFeature(context);
    this.validateScimPayload(scimGroup);
    return this.scimGroupsService.createGroup(context, {
      orgId,
      scimGroup,
      req,
    });
  }

  @Put('/api/v3/meta/orgs/:orgId/scim/v2/Groups/:groupId')
  async replaceGroup(
    @TenantContext() context: NcContext,
    @Param('orgId') orgId: string,
    @Param('groupId') groupId: string,
    @Body() scimGroup: any,
    @Req() req: NcRequest,
  ) {
    await this.checkScimFeature(context);
    this.validateScimPayload(scimGroup);
    return this.scimGroupsService.replaceGroup(context, {
      orgId,
      scimId: groupId,
      scimGroup,
      req,
    });
  }

  @Patch('/api/v3/meta/orgs/:orgId/scim/v2/Groups/:groupId')
  async updateGroup(
    @TenantContext() context: NcContext,
    @Param('orgId') orgId: string,
    @Param('groupId') groupId: string,
    @Body() scimGroup: any,
    @Req() req: NcRequest,
  ) {
    await this.checkScimFeature(context);
    this.validateScimPayload(scimGroup);
    return this.scimGroupsService.updateGroup(context, {
      orgId,
      scimId: groupId,
      scimGroup,
      req,
    });
  }

  @Delete('/api/v3/meta/orgs/:orgId/scim/v2/Groups/:groupId')
  @HttpCode(204)
  async deleteGroup(
    @TenantContext() context: NcContext,
    @Param('orgId') orgId: string,
    @Param('groupId') groupId: string,
    @Req() req: NcRequest,
  ) {
    await this.checkScimFeature(context);
    return this.scimGroupsService.deleteGroup(context, {
      orgId,
      scimId: groupId,
      req,
    });
  }
}

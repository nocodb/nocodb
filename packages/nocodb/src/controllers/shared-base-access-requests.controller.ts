import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { GlobalGuard } from '~/guards/global/global.guard';
import { SharedBaseAccessRequestsService } from '~/services/shared-base-access-requests.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class SharedBaseAccessRequestsController {
  constructor(
    private readonly sharedBaseAccessRequestsService: SharedBaseAccessRequestsService,
  ) {}

  @Post([
    '/api/v1/db/meta/shared-bases/:sharedBaseUuid/access-requests',
    '/api/v2/meta/shared-bases/:sharedBaseUuid/access-requests',
  ])
  @HttpCode(200)
  @Acl('sharedBaseAccessRequestCreate', { scope: 'org' })
  async create(
    @TenantContext() context: NcContext,
    @Param('sharedBaseUuid') sharedBaseUuid: string,
    @Body() body: { message?: string },
    @Req() req: NcRequest,
  ) {
    return await this.sharedBaseAccessRequestsService.create(context, {
      sharedBaseUuid,
      message: body?.message,
      req,
    });
  }

  @Get([
    '/api/v1/db/meta/shared-bases/:sharedBaseUuid/access-requests',
    '/api/v2/meta/shared-bases/:sharedBaseUuid/access-requests',
  ])
  @Acl('sharedBaseAccessRequestGetMine', { scope: 'org' })
  async getMine(
    @TenantContext() context: NcContext,
    @Param('sharedBaseUuid') sharedBaseUuid: string,
    @Req() req: NcRequest,
  ) {
    return await this.sharedBaseAccessRequestsService.getMine(context, {
      sharedBaseUuid,
      req,
    });
  }

  @Get([
    '/api/v1/db/meta/projects/:baseId/shared-access-requests',
    '/api/v2/meta/bases/:baseId/shared-access-requests',
  ])
  @Acl('sharedBaseAccessRequestList', { blockPublicBaseAccess: true })
  async list(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Query('status') status?: 'pending' | 'approved' | 'rejected',
  ) {
    return await this.sharedBaseAccessRequestsService.list(context, {
      baseId,
      status,
    });
  }

  @Post([
    '/api/v1/db/meta/projects/:baseId/shared-access-requests/:requestId/approve',
    '/api/v2/meta/bases/:baseId/shared-access-requests/:requestId/approve',
  ])
  @HttpCode(200)
  @Acl('sharedBaseAccessRequestApprove', { blockPublicBaseAccess: true })
  async approve(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Param('requestId') requestId: string,
    @Req() req: NcRequest,
  ) {
    return await this.sharedBaseAccessRequestsService.approve(context, {
      baseId,
      requestId,
      req,
    });
  }

  @Post([
    '/api/v1/db/meta/projects/:baseId/shared-access-requests/:requestId/reject',
    '/api/v2/meta/bases/:baseId/shared-access-requests/:requestId/reject',
  ])
  @HttpCode(200)
  @Acl('sharedBaseAccessRequestReject', { blockPublicBaseAccess: true })
  async reject(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Param('requestId') requestId: string,
    @Req() req: NcRequest,
  ) {
    return await this.sharedBaseAccessRequestsService.reject(context, {
      baseId,
      requestId,
      req,
    });
  }
}

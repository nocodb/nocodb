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
import type { ExtensionReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { ExtensionsService } from '~/services/extensions.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class ExtensionsController {
  constructor(private readonly extensionsService: ExtensionsService) {}

  @Get(['/api/v2/extensions/:baseId'])
  @Acl('extensionList')
  async extensionList(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Req() _req: NcRequest,
  ) {
    return new PagedResponseImpl(
      await this.extensionsService.extensionList(context, { baseId }),
    );
  }

  @Post(['/api/v2/extensions/:baseId'])
  @Acl('extensionCreate')
  async extensionCreate(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Body() body: Partial<ExtensionReqType>,
    @Req() req: NcRequest,
  ) {
    return await this.extensionsService.extensionCreate(context, {
      extension: {
        ...body,
        base_id: baseId,
      },
      req,
    });
  }

  @Get(['/api/v2/extensions/:extensionId'])
  @Acl('extensionRead')
  async extensionRead(
    @TenantContext() context: NcContext,
    @Param('extensionId') extensionId: string,
  ) {
    return await this.extensionsService.extensionRead(context, { extensionId });
  }

  @Patch(['/api/v2/extensions/:extensionId'])
  @Acl('extensionUpdate')
  async extensionUpdate(
    @TenantContext() context: NcContext,
    @Param('extensionId') extensionId: string,
    @Body() body: Partial<ExtensionReqType>,
    @Req() req: NcRequest,
  ) {
    return await this.extensionsService.extensionUpdate(context, {
      extensionId,
      extension: body,
      req,
    });
  }

  @Delete(['/api/v2/extensions/:extensionId'])
  @Acl('extensionDelete')
  async extensionDelete(
    @TenantContext() context: NcContext,
    @Param('extensionId') extensionId: string,
    @Req() req: NcRequest,
  ) {
    return await this.extensionsService.extensionDelete(context, {
      extensionId,
      req,
    });
  }
}

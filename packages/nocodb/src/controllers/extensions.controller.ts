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
import { NcRequest } from '~/interface/config';
import { PagedResponseImpl } from '~/helpers/PagedResponse';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class ExtensionsController {
  constructor(private readonly extensionsService: ExtensionsService) {}

  @Get(['/api/v2/extensions/:baseId'])
  @Acl('extensionList')
  async extensionList(@Param('baseId') baseId: string, @Req() _req: NcRequest) {
    return new PagedResponseImpl(
      await this.extensionsService.extensionList({ baseId }),
    );
  }

  @Post(['/api/v2/extensions/:baseId'])
  @Acl('extensionCreate')
  async extensionCreate(
    @Param('baseId') baseId: string,
    @Body() body: Partial<ExtensionReqType>,
    @Req() req: NcRequest,
  ) {
    return await this.extensionsService.extensionCreate({
      extension: {
        ...body,
        base_id: baseId,
      },
      req,
    });
  }

  @Get(['/api/v2/extensions/:extensionId'])
  @Acl('extensionRead')
  async extensionRead(@Param('extensionId') extensionId: string) {
    return await this.extensionsService.extensionRead({ extensionId });
  }

  @Patch(['/api/v2/extensions/:extensionId'])
  @Acl('extensionUpdate')
  async extensionUpdate(
    @Param('extensionId') extensionId: string,
    @Body() body: Partial<ExtensionReqType>,
    @Req() req: NcRequest,
  ) {
    return await this.extensionsService.extensionUpdate({
      extensionId,
      extension: body,
      req,
    });
  }

  @Delete(['/api/v2/extensions/:extensionId'])
  @Acl('extensionDelete')
  async extensionDelete(
    @Param('extensionId') extensionId: string,
    @Req() req: NcRequest,
  ) {
    return await this.extensionsService.extensionDelete({
      extensionId,
      req,
    });
  }
}

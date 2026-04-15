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
import { PlanFeatureTypes } from 'nocodb-sdk';
import {
  ApiTokensV3CreateRequest,
  ApiTokensV3UpdateRequest,
} from '~/services/v3/api-tokens-v3.type';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { NcRequest } from '~/interface/config';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { License } from '~/decorators/license.decorator';
import { ApiTokensV3Service } from '~/services/v3/api-tokens-v3.service';
import { GlobalGuard } from '~/guards/global/global.guard';

@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
@License(PlanFeatureTypes.FEATURE_EE_CORE)
export class ApiTokensV3Controller {
  constructor(private readonly apiTokensV3Service: ApiTokensV3Service) {}

  @Get('/api/v3/meta/tokens')
  @Acl('apiTokenList', {
    scope: 'org',
    blockApiTokenAccess: true,
    blockOAuthTokenAccess: true,
  })
  async apiTokenList(@Req() req: NcRequest) {
    return await this.apiTokensV3Service.list({ cookie: req });
  }

  @Post('/api/v3/meta/tokens')
  @HttpCode(201)
  @Acl('apiTokenCreate', {
    scope: 'org',
    blockApiTokenAccess: true,
    blockOAuthTokenAccess: true,
  })
  async apiTokenCreate(
    @Req() req: NcRequest,
    @Body() body: ApiTokensV3CreateRequest,
  ) {
    return await this.apiTokensV3Service.create({ body, cookie: req });
  }

  @Patch('/api/v3/meta/tokens/:tokenId')
  @Acl('apiTokenUpdate', {
    scope: 'org',
    blockApiTokenAccess: true,
    blockOAuthTokenAccess: true,
  })
  async apiTokenUpdate(
    @Req() req: NcRequest,
    @Param('tokenId') tokenId: string,
    @Body() body: ApiTokensV3UpdateRequest,
  ) {
    return await this.apiTokensV3Service.update({
      id: tokenId,
      body,
      cookie: req,
    });
  }

  @Delete('/api/v3/meta/tokens/:tokenId')
  @Acl('apiTokenDelete', {
    scope: 'org',
    blockApiTokenAccess: true,
    blockOAuthTokenAccess: true,
  })
  async apiTokenDelete(
    @Req() req: NcRequest,
    @Param('tokenId') tokenId: string,
  ) {
    return await this.apiTokensV3Service.delete({ id: tokenId, cookie: req });
  }
}

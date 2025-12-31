import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTokensV3CreateRequest } from '~/services/v3/api-tokens-v3.type';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { NcRequest } from '~/interface/config';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { ApiTokensV3Service } from '~/services/v3/api-tokens-v3.service';
import { GlobalGuard } from '~/guards/global/global.guard';

@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
export class ApiTokensV3Controller {
  constructor(private readonly apiTokensV3Service: ApiTokensV3Service) {}

  @Get('/api/v3/meta/tokens')
  @Acl('apiTokenList', {
    scope: 'org',
  })
  async apiTokenList(@Req() req: NcRequest) {
    return await this.apiTokensV3Service.list({ cookie: req });
  }

  @Post('/api/v3/meta/tokens')
  @HttpCode(200)
  @Acl('apiTokenCreate', {
    scope: 'org',
  })
  async apiTokenCreate(
    @Req() req: NcRequest,
    @Body() body: ApiTokensV3CreateRequest,
  ) {
    return await this.apiTokensV3Service.create({ body, cookie: req });
  }

  @Delete('/api/v3/meta/tokens/:tokenId')
  @Acl('apiTokenDelete', {
    scope: 'org',
  })
  async apiTokenDelete(
    @Req() req: NcRequest,
    @Param('tokenId') tokenId: string,
  ) {
    return await this.apiTokensV3Service.delete({ id: tokenId, cookie: req });
  }
}

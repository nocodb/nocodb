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
import { ApiTokenReqType } from 'nocodb-sdk';
import { AuthGuard } from '@nestjs/passport';
import { getConditionalHandler } from '~/helpers/getHandler';
import { NcError } from '~/helpers/catchError';
import { OrgTokensEeService } from '~/services/org-tokens-ee.service';
import { OrgTokensService } from '~/services/org-tokens.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { NcRequest } from '~/interface/config';

@UseGuards(MetaApiLimiterGuard, AuthGuard('jwt'))
@Controller()
export class OrgTokensController {
  constructor(
    private readonly orgTokensService: OrgTokensService,
    private readonly orgTokensEeService: OrgTokensEeService,
  ) {}

  @Get('/api/v1/tokens')
  @Acl('apiTokenList', {
    scope: 'org',
    blockApiTokenAccess: true,
  })
  async apiTokenList(@Req() req: NcRequest) {
    return await getConditionalHandler(
      this.orgTokensService.apiTokenList,
      this.orgTokensEeService.apiTokenListEE,
    )({
      query: req.query,
      req: req,
      user: req['user'],
    });
  }

  // TODO: Once fine-grained tokens are stable, gate or deprecate V1 token
  // creation to allow orgs to enforce fine-grained-only policy.
  @Post('/api/v1/tokens')
  @HttpCode(200)
  @Acl('apiTokenCreate', {
    scope: 'org',
    blockApiTokenAccess: true,
  })
  async apiTokenCreate(@Req() req: NcRequest, @Body() body: ApiTokenReqType) {
    return await this.orgTokensService.apiTokenCreate({
      apiToken: body,
      user: req['user'],
      req,
    });
  }

  @Patch('/api/v1/tokens/:tokenId')
  @Acl('apiTokenUpdate', {
    scope: 'org',
    blockApiTokenAccess: true,
  })
  async apiTokenUpdate(
    @Req() _req: NcRequest,
    @Param('tokenId') _tokenId: string,
    @Body() _body: any,
  ) {
    // V1 token update is not supported — use V3 PATCH /api/v3/meta/tokens/:tokenId
    NcError.notImplemented(
      'Token update via V1 API is not supported. Use V3 API.',
    );
  }

  @Delete('/api/v1/tokens/:tokenId')
  @Acl('apiTokenDelete', {
    scope: 'org',
    blockApiTokenAccess: true,
  })
  async apiTokenDelete(
    @Req() req: NcRequest,
    @Param('tokenId') tokenId: string,
  ) {
    await this.orgTokensService.apiTokenDelete({
      tokenId,
      user: req['user'],
      req,
    });
  }
}

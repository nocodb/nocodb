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
import { Request } from 'express';
import { ApiTokenReqType } from 'nocodb-sdk';
import { AuthGuard } from '@nestjs/passport';
import { getConditionalHandler } from '~/helpers/getHandler';
import { OrgTokensEeService } from '~/services/org-tokens-ee.service';
import { OrgTokensService } from '~/services/org-tokens.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

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
  async apiTokenList(@Req() req: Request) {
    return await getConditionalHandler(
      this.orgTokensService.apiTokenList,
      this.orgTokensEeService.apiTokenListEE,
    )({
      query: req.query,
      user: req['user'],
    });
  }

  @Post('/api/v1/tokens')
  @HttpCode(200)
  @Acl('apiTokenCreate', {
    scope: 'org',
    blockApiTokenAccess: true,
  })
  async apiTokenCreate(@Req() req: Request, @Body() body: ApiTokenReqType) {
    return await this.orgTokensService.apiTokenCreate({
      apiToken: body,
      user: req['user'],
      req,
    });
  }

  @Delete('/api/v1/tokens/:token')
  @Acl('apiTokenDelete', {
    scope: 'org',
    // allowedRoles: [OrgUserRoles.SUPER],
    blockApiTokenAccess: true,
  })
  async apiTokenDelete(@Req() req: Request, @Param('token') token: string) {
    await this.orgTokensService.apiTokenDelete({
      token,
      user: req['user'],
      req,
    });
  }
}

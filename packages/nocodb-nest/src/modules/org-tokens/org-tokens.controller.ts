import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTokenReqType } from 'nocodb-sdk';
import { AuthGuard } from '@nestjs/passport';
import { getConditionalHandler } from '../../helpers/getHandler';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { OrgTokensEeService } from './ee/org-tokens/org-tokens-ee.service';
import { OrgTokensService } from './org-tokens.service';

@UseGuards(ExtractProjectIdMiddleware, AuthGuard('jwt'))
@Controller()
export class OrgTokensController {
  constructor(
    private readonly orgTokensService: OrgTokensService,
    private readonly orgTokensEeService: OrgTokensEeService,
  ) {}

  @Get('/api/v1/tokens')
  @Acl('apiTokenList', {
    blockApiTokenAccess: true,
  })
  async apiTokenList(@Request() req) {
    return await getConditionalHandler(
      this.orgTokensService.apiTokenList,
      this.orgTokensEeService.apiTokenListEE,
    )({
      query: req.query,
      user: req['user'],
    });
  }

  @Post('/api/v1/tokens')
  @Acl('apiTokenCreate', {
    blockApiTokenAccess: true,
  })
  async apiTokenCreate(@Request() req, @Body() body: ApiTokenReqType) {
    return await this.orgTokensService.apiTokenCreate({
      apiToken: body,
      user: req['user'],
    });
  }

  @Delete('/api/v1/tokens/:token')
  @Acl('apiTokenDelete', {
    // allowedRoles: [OrgUserRoles.SUPER],
    blockApiTokenAccess: true,
  })
  async apiTokenDelete(@Request() req, @Param('token') token: string) {
    return;
    await this.orgTokensService.apiTokenDelete({
      token,
      user: req['user'],
    });
  }
}

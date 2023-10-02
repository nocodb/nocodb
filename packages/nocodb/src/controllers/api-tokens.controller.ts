import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { GlobalGuard } from '~/guards/global/global.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { ApiTokensService } from '~/services/api-tokens.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

@Controller()
@UseGuards(GlobalGuard)
export class ApiTokensController {
  constructor(private readonly apiTokensService: ApiTokensService) {}

  @Get([
    '/api/v1/db/meta/projects/:baseId/api-tokens',
    '/api/v1/meta/bases/:baseId/api-tokens',
  ])
  @Acl('baseApiTokenList')
  async apiTokenList(@Request() req) {
    return new PagedResponseImpl(
      await this.apiTokensService.apiTokenList({ userId: req['user'].id }),
    );
  }

  @Post([
    '/api/v1/db/meta/projects/:baseId/api-tokens',
    '/api/v1/meta/bases/:baseId/api-tokens',
  ])
  @HttpCode(200)
  @Acl('baseApiTokenCreate')
  async apiTokenCreate(@Request() req, @Body() body) {
    return await this.apiTokensService.apiTokenCreate({
      tokenBody: body,
      userId: req['user'].id,
    });
  }

  @Delete([
    '/api/v1/db/meta/projects/:baseId/api-tokens/:token',
    '/api/v1/meta/bases/:baseId/api-tokens/:token',
  ])
  @Acl('baseApiTokenDelete')
  async apiTokenDelete(@Request() req, @Param('token') token: string) {
    return await this.apiTokensService.apiTokenDelete({
      token,
      user: req['user'],
    });
  }
}

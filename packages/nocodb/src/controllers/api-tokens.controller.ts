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
import { GlobalGuard } from '~/guards/global/global.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { ApiTokensService } from '~/services/api-tokens.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class ApiTokensController {
  constructor(private readonly apiTokensService: ApiTokensService) {}

  @Get([
    '/api/v1/db/meta/projects/:baseId/api-tokens',
    '/api/v2/meta/bases/:baseId/api-tokens',
  ])
  @Acl('baseApiTokenList')
  async apiTokenList(@Req() req: Request) {
    return new PagedResponseImpl(
      await this.apiTokensService.apiTokenList({ userId: req['user'].id }),
    );
  }

  @Post([
    '/api/v1/db/meta/projects/:baseId/api-tokens',
    '/api/v2/meta/bases/:baseId/api-tokens',
  ])
  @HttpCode(200)
  @Acl('baseApiTokenCreate')
  async apiTokenCreate(@Req() req: Request, @Body() body) {
    return await this.apiTokensService.apiTokenCreate({
      tokenBody: body,
      userId: req['user'].id,
      req,
    });
  }

  @Delete([
    '/api/v1/db/meta/projects/:baseId/api-tokens/:token',
    '/api/v2/meta/bases/:baseId/api-tokens/:token',
  ])
  @Acl('baseApiTokenDelete')
  async apiTokenDelete(@Req() req: Request, @Param('token') token: string) {
    return await this.apiTokensService.apiTokenDelete({
      token,
      user: req['user'],
      req,
    });
  }
}

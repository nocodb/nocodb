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

  @Get('/api/v1/db/meta/projects/:projectId/api-tokens')
  @Acl('projectApiTokenList')
  async apiTokenList(@Request() req) {
    return new PagedResponseImpl(
      await this.apiTokensService.apiTokenList({ userId: req['user'].id }),
    );
  }

  @Post('/api/v1/db/meta/projects/:projectId/api-tokens')
  @HttpCode(200)
  @Acl('projectApiTokenCreate')
  async apiTokenCreate(@Request() req, @Body() body) {
    return await this.apiTokensService.apiTokenCreate({
      tokenBody: body,
      userId: req['user'].id,
    });
  }

  @Delete('/api/v1/db/meta/projects/:projectId/api-tokens/:token')
  @Acl('projectApiTokenDelete')
  async apiTokenDelete(@Request() req, @Param('token') token: string) {
    return await this.apiTokensService.apiTokenDelete({
      token,
      user: req['user'],
    });
  }
}

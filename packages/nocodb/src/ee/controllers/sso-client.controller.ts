import axios from 'axios';
import { useAgent } from 'request-filtering-agent';
import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { UtilsController as UtilsControllerCE } from 'src/controllers/utils.controller';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
export class SsoClientController {
  constructor(
  ) {
  }

  @Post('/api/v2/sso')
  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @Acl('genericGPT')
  async genericGPT(@Body() body: any) {
    return await this.utilsService.genericGPT({
      body,
    });
  }
}

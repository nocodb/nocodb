import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ViewCreateReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { FormsService } from '~/services/forms.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  @Get(['/api/v1/db/meta/forms/:formViewId', '/api/v2/meta/forms/:formViewId'])
  @Acl('formViewGet')
  async formViewGet(@Param('formViewId') formViewId: string) {
    const formViewData = await this.formsService.formViewGet({
      formViewId,
    });
    return formViewData;
  }

  @Post([
    '/api/v1/db/meta/tables/:tableId/forms',
    '/api/v2/meta/tables/:tableId/forms',
  ])
  @HttpCode(200)
  @Acl('formViewCreate')
  async formViewCreate(
    @Param('tableId') tableId: string,
    @Body() body: ViewCreateReqType,
    @Req() req: Request,
  ) {
    const view = await this.formsService.formViewCreate({
      body,
      tableId,
      user: req.user,
      req,
    });
    return view;
  }
  @Patch([
    '/api/v1/db/meta/forms/:formViewId',
    '/api/v2/meta/forms/:formViewId',
  ])
  @Acl('formViewUpdate')
  async formViewUpdate(
    @Param('formViewId') formViewId: string,
    @Body() body,
    @Req() req: Request,
  ) {
    return await this.formsService.formViewUpdate({
      formViewId,
      form: body,
      req,
    });
  }
}

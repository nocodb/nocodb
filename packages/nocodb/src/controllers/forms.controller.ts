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
import { ViewCreateReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { FormsService } from '~/services/forms.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  @Get(['/api/v1/db/meta/forms/:formViewId', '/api/v2/meta/forms/:formViewId'])
  @Acl('formViewGet')
  async formViewGet(
    @TenantContext() context: NcContext,
    @Param('formViewId') formViewId: string,
  ) {
    const formViewData = await this.formsService.formViewGet(context, {
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
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Body() body: ViewCreateReqType,
    @Req() req: NcRequest,
  ) {
    const view = await this.formsService.formViewCreate(context, {
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
    @TenantContext() context: NcContext,
    @Param('formViewId') formViewId: string,
    @Body() body,
    @Req() req: NcRequest,
  ) {
    return await this.formsService.formViewUpdate(context, {
      formViewId,
      form: body,
      req,
    });
  }
}

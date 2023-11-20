import { Body, Controller, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { GlobalGuard } from '~/guards/global/global.guard';
import { FormColumnsService } from '~/services/form-columns.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

class FormColumnUpdateReqType {}

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class FormColumnsController {
  constructor(private readonly formColumnsService: FormColumnsService) {}

  @Patch([
    '/api/v1/db/meta/form-columns/:formViewColumnId',
    '/api/v2/meta/form-columns/:formViewColumnId',
  ])
  @Acl('columnUpdate')
  async columnUpdate(
    @Param('formViewColumnId') formViewColumnId: string,
    @Body() formViewColumnbody: FormColumnUpdateReqType,

    @Req() req: Request,
  ) {
    return await this.formColumnsService.columnUpdate({
      formViewColumnId,
      formViewColumn: formViewColumnbody,
      req,
    });
  }
}

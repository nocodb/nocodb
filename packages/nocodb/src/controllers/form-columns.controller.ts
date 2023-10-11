import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
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
  ) {
    return await this.formColumnsService.columnUpdate({
      formViewColumnId,
      formViewColumn: formViewColumnbody,
    });
  }
}

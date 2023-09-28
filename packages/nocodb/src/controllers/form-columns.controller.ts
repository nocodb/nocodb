import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { GlobalGuard } from '~/guards/global/global.guard';
import { FormColumnsService } from '~/services/form-columns.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

class FormColumnUpdateReqType {}

@Controller()
@UseGuards(GlobalGuard)
export class FormColumnsController {
  constructor(private readonly formColumnsService: FormColumnsService) {}

  @Patch([
    '/api/v1/db/meta/form-columns/:formViewColumnId',
    '/api/v1/meta/form-columns/:formViewColumnId',
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

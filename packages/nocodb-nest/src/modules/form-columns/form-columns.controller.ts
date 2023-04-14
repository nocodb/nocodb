import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GlobalGuard } from '../../guards/global/global.guard';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { FormColumnsService } from './form-columns.service';

class FormColumnUpdateReqType {}

@Controller()
@UseGuards(ExtractProjectIdMiddleware, GlobalGuard)
export class FormColumnsController {
  constructor(private readonly formColumnsService: FormColumnsService) {}

  @Patch('/api/v1/db/meta/form-columns/:formViewColumnId')
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

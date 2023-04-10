import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { FormColumnsService } from './form-columns.service';
import { AuthGuard } from '@nestjs/passport';

class FormColumnUpdateReqType {}

@Controller()
@UseGuards(ExtractProjectIdMiddleware, AuthGuard('jwt'))
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

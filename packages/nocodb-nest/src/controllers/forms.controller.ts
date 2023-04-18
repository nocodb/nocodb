import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ViewCreateReqType } from 'nocodb-sdk';
import { GlobalGuard } from '../guards/global/global.guard';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../middlewares/extract-project-id/extract-project-id.middleware';
import { FormsService } from '../services/forms.service';
import { ExtractProjectAndWorkspaceIdMiddleware } from '../middlewares/extract-project-and-workspace-id/extract-project-and-workspace-id.middleware';

@Controller()
@UseGuards(ExtractProjectAndWorkspaceIdMiddleware, GlobalGuard)
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  @Get('/api/v1/db/meta/forms/:formViewId')
  @Acl('formViewGet')
  async formViewGet(@Param('formViewId') formViewId: string) {
    const formViewData = await this.formsService.formViewGet({
      formViewId,
    });
    return formViewData;
  }

  @Post('/api/v1/db/meta/tables/:tableId/forms')
  @HttpCode(200)
  @Acl('formViewCreate')
  async formViewCreate(
    @Param('tableId') tableId: string,
    @Body() body: ViewCreateReqType,
  ) {
    const view = await this.formsService.formViewCreate({
      body,
      tableId,
    });
    return view;
  }
  @Patch('/api/v1/db/meta/forms/:formViewId')
  @Acl('formViewUpdate')
  async formViewUpdate(@Param('formViewId') formViewId: string, @Body() body) {
    return await this.formsService.formViewUpdate({
      formViewId,
      form: body,
    });
  }
}

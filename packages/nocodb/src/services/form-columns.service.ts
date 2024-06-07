import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { FormViewColumn } from '~/models';

@Injectable()
export class FormColumnsService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async columnUpdate(
    context: NcContext,
    param: {
      formViewColumnId: string;
      // todo: replace with FormColumnReq
      formViewColumn: FormViewColumn;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/FormColumnReq',
      param.formViewColumn,
    );

    const res = await FormViewColumn.update(
      context,
      param.formViewColumnId,
      param.formViewColumn,
    );

    this.appHooksService.emit(AppEvents.FORM_COLUMN_UPDATE, {
      req: param.req,
    });

    return res;
  }
}

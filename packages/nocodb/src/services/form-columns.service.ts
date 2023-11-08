import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { FormViewColumn } from '~/models';

@Injectable()
export class FormColumnsService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async columnUpdate(param: {
    formViewColumnId: string;
    // todo: replace with FormColumnReq
    formViewColumn: FormViewColumn;
    req: NcRequest;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/FormColumnReq',
      param.formViewColumn,
    );

    const res = await FormViewColumn.update(
      param.formViewColumnId,
      param.formViewColumn,
    );

    this.appHooksService.emit(AppEvents.FORM_COLUMN_UPDATE, {
      req: param.req,
    });

    return res;
  }
}

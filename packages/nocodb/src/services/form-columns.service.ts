import { Injectable } from '@nestjs/common';
import { T } from 'nc-help';
import { AppEvents } from 'nocodb-sdk';
import { validatePayload } from '../helpers';
import { FormViewColumn } from '../models';
import { AppHooksService } from './app-hooks/app-hooks.service';

@Injectable()
export class FormColumnsService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async columnUpdate(param: {
    formViewColumnId: string;
    // todo: replace with FormColumnReq
    formViewColumn: FormViewColumn;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/FormColumnReq',
      param.formViewColumn,
    );

    const res = await FormViewColumn.update(
      param.formViewColumnId,
      param.formViewColumn,
    );

    this.appHooksService.emit(AppEvents.FORM_COLUMN_UPDATE, {});

    return res;
  }
}

import { Injectable } from '@nestjs/common';
import { T } from 'nc-help';
import { validatePayload } from '../helpers';
import { FormViewColumn } from '../models';

@Injectable()
export class FormColumnsService {
  async columnUpdate(param: {
    formViewColumnId: string;
    // todo: replace with FormColumnReq
    formViewColumn: FormViewColumn;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/FormColumnReq',
      param.formViewColumn,
    );

    T.emit('evt', { evt_type: 'formViewColumn:updated' });
    return await FormViewColumn.update(
      param.formViewColumnId,
      param.formViewColumn,
    );
  }
}

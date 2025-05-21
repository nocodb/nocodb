import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { Column, FormViewColumn, View } from '~/models';
import { extractProps } from '~/helpers/extractProps';

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
    const oldFormViewColumn = await FormViewColumn.get(
      context,
      param.formViewColumnId,
    );

    const view = await View.get(context, oldFormViewColumn.fk_view_id);

    const column = await Column.get(context, {
      colId: oldFormViewColumn.fk_column_id,
    });

    const res = await FormViewColumn.update(
      context,
      param.formViewColumnId,
      param.formViewColumn,
    );

    this.appHooksService.emit(AppEvents.VIEW_COLUMN_UPDATE, {
      oldViewColumn: oldFormViewColumn,
      viewColumn: extractProps(param.formViewColumn, [
        'label',
        'help',
        'description',
        'required',
        'show',
        'order',
        'meta',
        'enable_scanner',
      ]),
      view,
      column,
      req: param.req,
      context,
    });

    return res;
  }
}

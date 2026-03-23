import { Injectable } from '@nestjs/common';
import { AppEvents, EventType } from 'nocodb-sdk';
import type { GridColumnReqType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import {
  type ViewWebhookManager,
  ViewWebhookManagerBuilder,
} from '~/utils/view-webhook-manager';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { Column, View } from '~/models';
import ListViewColumn from '~/models/ListViewColumn';
import { extractProps } from '~/helpers/extractProps';
import NocoSocket from '~/socket/NocoSocket';

@Injectable()
export class ListColumnsService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async listColumnUpdate(
    context: NcContext,
    param: {
      listViewColumnId: string;
      list: GridColumnReqType;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    validatePayload(
      'swagger.json#/components/schemas/GridColumnReq',
      param.list,
    );

    const oldListViewColumn = await ListViewColumn.get(
      context,
      param.listViewColumnId,
      ncMeta,
    );

    const column = await Column.get(
      context,
      {
        colId: oldListViewColumn.fk_column_id,
      },
      ncMeta,
    );

    const view = await View.get(
      context,
      oldListViewColumn.fk_view_id,
      ncMeta,
    );

    const viewWebhookManager =
      param.viewWebhookManager ??
      (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(view.id)
      ).forUpdate();

    const res = await ListViewColumn.update(
      context,
      param.listViewColumnId,
      param.list,
      ncMeta,
    );

    const viewColumn = extractProps(param.list, [
      'order',
      'show',
      'width',
    ]);

    this.appHooksService.emit(AppEvents.VIEW_COLUMN_UPDATE, {
      oldViewColumn: oldListViewColumn,
      viewColumn,
      column,
      view,
      req: param.req,
      context,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'view_column_update',
          payload: {
            ...oldListViewColumn,
            ...viewColumn,
          },
        },
      },
      context.socket_id,
    );
    if (!param.viewWebhookManager) {
      (await viewWebhookManager.withNewViewId(view.id)).emit();
    }

    return res;
  }
}

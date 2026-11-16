import { Injectable } from '@nestjs/common';
import { AppEvents, EventType } from 'nocodb-sdk';
import type { GridColumnReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { NcContext } from '~/interface/config';
import { MetaService } from '~/meta/meta.service';
import {
  type ViewWebhookManager,
  ViewWebhookManagerBuilder,
} from '~/utils/view-webhook-manager';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { OperationName } from '~/command-registry/op-names';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { assertViewConfigEditable } from '~/helpers/viewLockHelpers';
import { assertNotLockedViewOnLaneProduction } from '~/helpers/environmentGuards';
import { Column, GalleryViewColumn, View } from '~/models';
import { extractProps } from '~/helpers/extractProps';
import NocoSocket from '~/socket/NocoSocket';

@Injectable()
export class GalleryColumnsService {
  constructor(private readonly appHooksService: AppHooksService) {}

  @TraceCommand(OperationName.galleryColumnUpdate)
  async galleryColumnUpdate(
    context: NcContext,
    param: {
      galleryViewColumnId: string;
      gallery: GridColumnReqType;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    validatePayload(
      'swagger.json#/components/schemas/GridColumnReq',
      param.gallery,
    );

    const oldGalleryViewColumn = await GalleryViewColumn.get(
      context,
      param.galleryViewColumnId,
      ncMeta,
    );

    if (!oldGalleryViewColumn) {
      NcError.get(context).fieldNotFound(param.galleryViewColumnId);
    }

    await assertNotLockedViewOnLaneProduction(
      context,
      oldGalleryViewColumn.fk_view_id,
    );

    const column = await Column.get(
      context,
      { colId: oldGalleryViewColumn.fk_column_id },
      ncMeta,
    );

    const view = await View.get(
      context,
      oldGalleryViewColumn.fk_view_id,
      false,
      ncMeta,
    );
    assertViewConfigEditable(context, view, param.req);

    const viewWebhookManager =
      param.viewWebhookManager ??
      (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(view.id)
      ).forUpdate();

    const res = await GalleryViewColumn.update(
      context,
      param.galleryViewColumnId,
      param.gallery,
      ncMeta,
    );

    const viewColumn = extractProps(param.gallery, [
      'order',
      'show',
      'group_by',
      'group_by_order',
      'group_by_sort',
      'group_by_enabled',
    ]);

    this.appHooksService.emit(AppEvents.VIEW_COLUMN_UPDATE, {
      oldViewColumn: oldGalleryViewColumn,
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
            ...oldGalleryViewColumn,
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

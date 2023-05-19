import { Injectable } from '@nestjs/common';
import { AppEvents, ViewTypes } from 'nocodb-sdk';
import { T } from 'nc-help';
import { validatePayload } from '../helpers';
import { NcError } from '../helpers/catchError';
import { KanbanView, View } from '../models';
import { AppHooksService } from './app-hooks/app-hooks.service';
import type { KanbanUpdateReqType, ViewCreateReqType } from 'nocodb-sdk';

@Injectable()
export class KanbansService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async kanbanViewGet(param: { kanbanViewId: string }) {
    return await KanbanView.get(param.kanbanViewId);
  }

  async kanbanViewCreate(param: {
    tableId: string;
    kanban: ViewCreateReqType;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.kanban,
    );

    const view = await View.insert({
      ...param.kanban,
      // todo: sanitize
      fk_model_id: param.tableId,
      type: ViewTypes.KANBAN,
    });

    this.appHooksService.emit(AppEvents.VIEW_CREATE, {
      view,
      showAs: 'kanban',
    });

    return view;
  }

  async kanbanViewUpdate(param: {
    kanbanViewId: string;
    kanban: KanbanUpdateReqType;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/KanbanUpdateReq',
      param.kanban,
    );

    const view = await View.get(param.kanbanViewId);

    if (!view) {
      NcError.badRequest('View not found');
    }

    const res = await KanbanView.update(param.kanbanViewId, param.kanban);

    this.appHooksService.emit(AppEvents.VIEW_UPDATE, {
      view,
      showAs: 'kanban',
    });

    return res;
  }
}

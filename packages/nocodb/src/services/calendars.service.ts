import { Injectable } from '@nestjs/common';
import { AppEvents, ViewTypes } from 'nocodb-sdk';
import type {
  CalendarUpdateReqType,
  UserType,
  ViewCreateReqType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { CalendarView, Model, View } from '~/models';
import NocoCache from '~/cache/NocoCache';
import { CacheScope } from '~/utils/globals';

@Injectable()
export class CalendarsService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async calendarViewGet(context: NcContext, param: { calendarViewId: string }) {
    return await CalendarView.get(context, param.calendarViewId);
  }

  async calendarViewCreate(
    context: NcContext,
    param: {
      tableId: string;
      calendar: ViewCreateReqType;
      user: UserType;
      req: NcRequest;
      ownedBy?: string;
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.calendar,
    );

    const model = await Model.get(context, param.tableId);

    const { id } = await View.insertMetaOnly(
      context,
      {
        ...param.calendar,
        fk_model_id: param.tableId,
        type: ViewTypes.CALENDAR,
        base_id: model.base_id,
        source_id: model.source_id,
        created_by: param.user.id,
        owned_by: param.ownedBy || param.user.id,
      },
      model,
    );

    const view = await View.get(context, id);

    await NocoCache.appendToList(
      CacheScope.VIEW,
      [view.fk_model_id],
      `${CacheScope.VIEW}:${id}`,
    );

    this.appHooksService.emit(AppEvents.VIEW_CREATE, {
      view,
      showAs: 'calendar',
      user: param.user,

      req: param.req,
    });

    return view;
  }

  async calendarViewUpdate(
    context: NcContext,
    param: {
      calendarViewId: string;
      calendar: CalendarUpdateReqType;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/CalendarUpdateReq',
      param.calendar,
    );

    const view = await View.get(context, param.calendarViewId);

    if (!view) {
      NcError.viewNotFound(param.calendarViewId);
    }

    const res = await CalendarView.update(
      context,
      param.calendarViewId,
      param.calendar,
    );

    this.appHooksService.emit(AppEvents.VIEW_UPDATE, {
      view,
      showAs: 'calendar',
      req: param.req,
    });

    return res;
  }
}

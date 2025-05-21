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
import { CalendarView, Model, User, View } from '~/models';
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

    const { id } = await View.insertMetaOnly(context, {
      view: {
        ...param.calendar,
        fk_model_id: param.tableId,
        type: ViewTypes.CALENDAR,
        base_id: model.base_id,
        source_id: model.source_id,
        created_by: param.user?.id,
        owned_by: param.ownedBy || param.user?.id,
      },
      model,
      req: param.req,
    });

    const view = await View.get(context, id);

    await NocoCache.appendToList(
      CacheScope.VIEW,
      [view.fk_model_id],
      `${CacheScope.VIEW}:${id}`,
    );

    let owner = param.req.user;

    if (param.ownedBy) {
      owner = await User.get(param.ownedBy);
    }

    this.appHooksService.emit(AppEvents.CALENDAR_CREATE, {
      view: {
        ...view,
        ...param.calendar,
      },
      req: param.req,
      context,
      owner,
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

    const oldCalendarView = await CalendarView.get(
      context,
      param.calendarViewId,
    );

    const res = await CalendarView.update(
      context,
      param.calendarViewId,
      param.calendar,
    );

    let owner = param.req.user;

    if (view.owned_by && view.owned_by !== param.req.user?.id) {
      owner = await User.get(view.owned_by);
    }

    this.appHooksService.emit(AppEvents.CALENDAR_UPDATE, {
      view: {
        ...view,
        ...param.calendar,
      },
      calendarView: param.calendar,
      oldCalendarView,
      req: param.req,
      context,
      owner,
    });
    return res;
  }
}

import { Injectable } from '@nestjs/common';
import { AppEvents, ViewTypes } from 'nocodb-sdk';
import type {
  CalendarUpdateReqType,
  UserType,
  ViewCreateReqType,
} from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import { CalendarView, View } from '~/models';
import CalendarRange from '~/models/CalendarRange';

@Injectable()
export class CalendarsService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async calendarViewGet(param: { calendarViewId: string }) {
    const calendarView = await CalendarView.get(param.calendarViewId);
    if (!calendarView) {
      NcError.badRequest('Calendar view not found');
    }
    const calendarRanges = await CalendarRange.read(param.calendarViewId);
    return {
      ...calendarView,
      calendar_range: calendarRanges,
    };
  }

  async calendarViewCreate(param: {
    tableId: string;
    calendar: ViewCreateReqType;
    user: UserType;
    req: NcRequest;
  }) {
    -validatePayload(
      'swagger.json#/components/schemas/ViewCreateReq',
      param.calendar,
    );

    const view = await View.insert({
      ...param.calendar,
      // todo: sanitize
      fk_model_id: param.tableId,
      type: ViewTypes.CALENDAR,
    });

    this.appHooksService.emit(AppEvents.VIEW_CREATE, {
      view,
      showAs: 'calendar',
      user: param.user,

      req: param.req,
    });

    return view;
  }

  async calendarViewUpdate(param: {
    calendarViewId: string;
    calendar: CalendarUpdateReqType;
    req: NcRequest;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/CalendarUpdateReq',
      param.calendar,
    );

    const view = await View.get(param.calendarViewId);

    if (!view) {
      NcError.badRequest('View not found');
    }

    const res = await CalendarView.update(param.calendarViewId, param.calendar);

    this.appHooksService.emit(AppEvents.VIEW_UPDATE, {
      view,
      showAs: 'calendar',
      req: param.req,
    });

    return res;
  }
}

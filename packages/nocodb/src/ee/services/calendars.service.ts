import { Injectable } from '@nestjs/common';
import { CalendarsService as CalendarsServiceCE } from 'src/services/calendars.service';
import type {
  CalendarUpdateReqType,
  UserType,
  ViewCreateReqType,
} from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { ViewWebhookManager } from '~/utils/view-webhook-manager';
import { OperationName } from '~/command-registry/op-names';
import { NcContext } from '~/interface/config';
import { MetaService } from '~/meta/meta.service';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { assertNotSandbox } from '~/helpers/sandboxGuards';
@Injectable()
export class CalendarsService extends CalendarsServiceCE {
  constructor(protected readonly appHooksService: AppHooksService) {
    super(appHooksService);
  }

  @TraceCommand(OperationName.calendarViewCreate)
  async calendarViewCreate(
    context: NcContext,
    param: {
      tableId: string;
      calendar: ViewCreateReqType;
      user: UserType;
      req: NcRequest;
      ownedBy?: string;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    if (param?.ownedBy) {
      await assertNotSandbox(
        context,
        'Personal views cannot be created in a sandbox. Create them on the production base.',
      );
    }
    return super.calendarViewCreate(context, param, ncMeta);
  }

  @TraceCommand(OperationName.calendarViewUpdate)
  async calendarViewUpdate(
    context: NcContext,
    param: {
      calendarViewId: string;
      calendar: CalendarUpdateReqType;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    return super.calendarViewUpdate(context, param, ncMeta);
  }
}

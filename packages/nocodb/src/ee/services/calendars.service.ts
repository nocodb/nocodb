import { Injectable } from '@nestjs/common';
import { CalendarsService as CalendarsServiceCE } from 'src/services/calendars.service';
import type {
  CalendarUpdateReqType,
  UserType,
  ViewCreateReqType,
} from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { ViewWebhookManager } from '~/utils/view-webhook-manager';
import { NcContext } from '~/interface/config';
import { MetaService } from '~/meta/meta.service';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { viewActions } from '~/decorators/trace-command-descriptions';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { Model, View } from '~/models';
import { MetaTable } from '~/utils/globals';
import { assertNotSandbox } from '~/helpers/sandboxGuards';

@Injectable()
export class CalendarsService extends CalendarsServiceCE {
  constructor(protected readonly appHooksService: AppHooksService) {
    super(appHooksService);
  }

  @TraceCommand({
    entity: MetaTable.VIEWS,
    entityId: 'id',
    entityTitle: (p) => p?.calendar?.title,
    parentId: 'tableId',
    description: viewActions.add,
    resolveCtx: async (context, param) => {
      const table = await Model.get(context, param?.tableId);
      return { parentEntityTitle: table?.title };
    },
    idField: 'calendar',
  })
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

  @TraceCommand({
    entity: MetaTable.VIEWS,
    entityId: (p) => p?.calendarViewId,
    entityTitle: (p) => p?.calendar?.title,
    description: (ctx) =>
      ctx.extra?.oldTitle && ctx.extra.oldTitle !== ctx.entityTitle
        ? viewActions.rename(ctx)
        : viewActions.edit(ctx),
    resolveCtx: async (context, param) => {
      const view = await View.get(context, param?.calendarViewId);
      const table = view?.fk_model_id
        ? await Model.get(context, view.fk_model_id)
        : undefined;
      return {
        entityTitle: view?.title,
        parentEntityTitle: table?.title,
        extra: { oldTitle: view?.title },
      };
    },
  })
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

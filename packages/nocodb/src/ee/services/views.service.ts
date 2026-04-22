import { Injectable } from '@nestjs/common';
import { AppEvents, ViewTypes } from 'nocodb-sdk';
import { ViewsService as ViewsServiceCE } from 'src/services/views.service';
import type { UserType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { View, User } from '~/models';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { BaseTrashService } from '~/services/base-trash/base-trash.service';
import { NcError } from '~/helpers/catchError';
import Noco from '~/Noco';

@Injectable()
export class ViewsService extends ViewsServiceCE {
  constructor(
    protected readonly appHooksServiceEE: AppHooksService,
    protected readonly baseTrashService: BaseTrashService,
  ) {
    super(appHooksServiceEE);
  }

  async viewDelete(
    context: NcContext,
    param: {
      viewId: string;
      user: UserType & { base_roles?: Record<string, boolean> | string };
      skipTrash?: boolean;
      req: NcRequest;
    },
    ncMeta = Noco.ncMeta,
  ) {
    if (param.skipTrash) {
      return super.viewDelete(context, param, ncMeta);
    }

    const view = await View.get(context, param.viewId, false, ncMeta);
    if (!view) {
      NcError.get(context).genericNotFound('view', param.viewId);
    }

    await this.baseTrashService.trashResource(context, {
      resourceId: param.viewId,
      resourceType: 'view',
      user: param.user,
      req: param.req,
    });

    // Match CE: pick the type-specific delete event
    let deleteEvent = AppEvents.GRID_DELETE;
    if (view.type === ViewTypes.FORM) deleteEvent = AppEvents.FORM_DELETE;
    else if (view.type === ViewTypes.CALENDAR)
      deleteEvent = AppEvents.CALENDAR_DELETE;
    else if (view.type === ViewTypes.GALLERY)
      deleteEvent = AppEvents.GALLERY_DELETE;
    else if (view.type === ViewTypes.KANBAN)
      deleteEvent = AppEvents.KANBAN_DELETE;
    else if (view.type === ViewTypes.MAP) deleteEvent = AppEvents.MAP_DELETE;
    else if (view.type === ViewTypes.LIST) deleteEvent = AppEvents.LIST_DELETE;

    let owner = param.req.user;
    if (view.owned_by && view.owned_by !== param.req.user?.id) {
      owner = await User.get(view.owned_by);
    }

    this.appHooksServiceEE.emit(deleteEvent, {
      view,
      user: param.user,
      owner,
      req: param.req,
      context,
    });

    return true;
  }
}

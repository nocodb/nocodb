import { Injectable } from '@nestjs/common';
import { ViewColumnsService as ViewColumnsServiceCE } from 'src/services/view-columns.service';
import type { ViewColumnUpdateReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { ViewWebhookManager } from '~/utils/view-webhook-manager';
import { NcContext } from '~/interface/config';
import { MetaService } from '~/meta/meta.service';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { b } from '~/decorators/trace-command-descriptions';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { View } from '~/models';
import { MetaTable } from '~/utils/globals';

@Injectable()
export class ViewColumnsService extends ViewColumnsServiceCE {
  constructor(protected readonly appHooksService: AppHooksService) {
    super(appHooksService);
  }

  @TraceCommand({
    entity: MetaTable.GRID_VIEW_COLUMNS,
    entityId: (p) => p?.columnId,
    parentId: 'viewId',
    description: ({ parentEntityTitle }) =>
      `Edit view column settings in ${b(parentEntityTitle)}`,
    resolveCtx: async (context, param) => {
      const view = await View.get(context, param?.viewId);
      return { parentEntityTitle: view?.title };
    },
    deps: (p) =>
      p?.columnId ? [{ entity: MetaTable.COLUMNS, id: p.columnId }] : [],
  })
  async columnUpdate(
    context: NcContext,
    param: {
      viewId: string;
      columnId: string;
      column: ViewColumnUpdateReqType;
      req: NcRequest;
      internal?: boolean;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    return super.columnUpdate(context, param, ncMeta);
  }
}

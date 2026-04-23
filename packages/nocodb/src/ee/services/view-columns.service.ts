import { Injectable } from '@nestjs/common';
import { ViewColumnsService as ViewColumnsServiceCE } from 'src/services/view-columns.service';
import type { ViewColumnUpdateReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { ViewWebhookManager } from '~/utils/view-webhook-manager';
import { NcContext } from '~/interface/config';
import { MetaService } from '~/meta/meta.service';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { viewColumnActions } from '~/decorators/trace-command-descriptions';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { Column, Model, View } from '~/models';
import { MetaTable } from '~/utils/globals';

@Injectable()
export class ViewColumnsService extends ViewColumnsServiceCE {
  constructor(protected readonly appHooksService: AppHooksService) {
    super(appHooksService);
  }

  @TraceCommand({
    operation: 'viewColumnUpdate',
    entity: MetaTable.GRID_VIEW_COLUMNS,
    entityId: (p) => p?.columnId,
    parentId: 'viewId',
    description: viewColumnActions.update,
    resolveCtx: async (context, param) => {
      const view = await View.get(context, param?.viewId);
      const table = view?.fk_model_id
        ? await Model.get(context, view.fk_model_id)
        : undefined;
      const field = param?.columnId
        ? await Column.get(context, { colId: param.columnId })
        : undefined;
      return {
        parentEntityTitle: view?.title,
        extra: { fieldTitle: field?.title, tableTitle: table?.title },
      };
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

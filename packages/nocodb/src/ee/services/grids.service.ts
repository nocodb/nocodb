import { Injectable } from '@nestjs/common';
import { GridsService as GridsServiceCE } from 'src/services/grids.service';
import type { GridUpdateReqType, ViewCreateReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { ViewWebhookManager } from '~/utils/view-webhook-manager';
import { NcContext } from '~/interface/config';
import { MetaService } from '~/meta/meta.service';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { b, descUpdate } from '~/decorators/trace-command-descriptions';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { Model } from '~/models';
import { MetaTable } from '~/utils/globals';
import { assertNotSandbox } from '~/helpers/sandboxGuards';

@Injectable()
export class GridsService extends GridsServiceCE {
  constructor(protected readonly appHooksService: AppHooksService) {
    super(appHooksService);
  }

  @TraceCommand({
    entity: MetaTable.VIEWS,
    entityId: 'id',
    entityTitle: (p) => p?.grid?.title,
    parentId: 'tableId',
    description: ({ entityTitle, parentEntityTitle }) =>
      `Create grid view ${b(entityTitle)} in ${b(parentEntityTitle)}`,
    resolveCtx: async (context, param) => {
      const table = await Model.get(context, param?.tableId);
      return { parentEntityTitle: table?.title };
    },
    idField: 'grid',
  })
  async gridViewCreate(
    context: NcContext,
    param: {
      tableId: string;
      grid: ViewCreateReqType;
      req: NcRequest;
      ownedBy?: string;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    if (param?.ownedBy) {
      await assertNotSandbox(
        context,
        'Personal views cannot be created in a sandbox. Create them on the master base.',
      );
    }
    return super.gridViewCreate(context, param, ncMeta);
  }

  @TraceCommand({
    entity: MetaTable.VIEWS,
    entityId: (p) => p?.viewId,
    entityTitle: (p) => p?.grid?.title,
    description: descUpdate('grid view'),
  })
  async gridViewUpdate(
    context: NcContext,
    param: {
      viewId: string;
      grid: GridUpdateReqType;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    return super.gridViewUpdate(context, param, ncMeta);
  }
}

import { Injectable } from '@nestjs/common';
import { GridsService as GridsServiceCE } from 'src/services/grids.service';
import type { GridUpdateReqType, ViewCreateReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { ViewWebhookManager } from '~/utils/view-webhook-manager';
import { OperationName } from '~/command-registry/op-names';
import { NcContext } from '~/interface/config';
import { MetaService } from '~/meta/meta.service';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { assertNotSandbox } from '~/helpers/sandboxGuards';
@Injectable()
export class GridsService extends GridsServiceCE {
  constructor(protected readonly appHooksService: AppHooksService) {
    super(appHooksService);
  }

  @TraceCommand(OperationName.gridViewCreate)
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
        'Personal views cannot be created in a sandbox. Create them on the production base.',
      );
    }
    return super.gridViewCreate(context, param, ncMeta);
  }

  @TraceCommand(OperationName.gridViewUpdate)
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

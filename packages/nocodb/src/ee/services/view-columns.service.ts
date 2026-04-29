import { Injectable } from '@nestjs/common';
import { ViewColumnsService as ViewColumnsServiceCE } from 'src/services/view-columns.service';
import type { ViewColumnUpdateReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { ViewWebhookManager } from '~/utils/view-webhook-manager';
import { NcContext } from '~/interface/config';
import { MetaService } from '~/meta/meta.service';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { ViewColumnUpdateContract } from '~/command-registry/operations/sorts-visibilities.operations';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

@Injectable()
export class ViewColumnsService extends ViewColumnsServiceCE {
  constructor(protected readonly appHooksService: AppHooksService) {
    super(appHooksService);
  }

  @TraceCommand(ViewColumnUpdateContract)
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

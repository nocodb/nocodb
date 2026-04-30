import { Injectable } from '@nestjs/common';
import { ViewColumnsService as ViewColumnsServiceCE } from 'src/services/view-columns.service';
import type { ViewColumnUpdateReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { ViewWebhookManager } from '~/utils/view-webhook-manager';
import { OperationName } from '~/command-registry/_op-names';
import { NcContext } from '~/interface/config';
import { MetaService } from '~/meta/meta.service';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

@Injectable()
export class ViewColumnsService extends ViewColumnsServiceCE {
  constructor(protected readonly appHooksService: AppHooksService) {
    super(appHooksService);
  }

  @TraceCommand(OperationName.viewColumnUpdate)
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

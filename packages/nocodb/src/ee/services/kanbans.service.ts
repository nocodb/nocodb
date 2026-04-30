import { Injectable } from '@nestjs/common';
import { KanbansService as KanbansServiceCE } from 'src/services/kanbans.service';
import type {
  KanbanUpdateReqType,
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
export class KanbansService extends KanbansServiceCE {
  constructor(protected readonly appHooksService: AppHooksService) {
    super(appHooksService);
  }

  @TraceCommand(OperationName.kanbanViewCreate)
  async kanbanViewCreate(
    context: NcContext,
    param: {
      tableId: string;
      kanban: ViewCreateReqType;
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
    return super.kanbanViewCreate(context, param, ncMeta);
  }

  @TraceCommand(OperationName.kanbanViewUpdate)
  async kanbanViewUpdate(
    context: NcContext,
    param: {
      kanbanViewId: string;
      kanban: KanbanUpdateReqType;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    return super.kanbanViewUpdate(context, param, ncMeta);
  }
}

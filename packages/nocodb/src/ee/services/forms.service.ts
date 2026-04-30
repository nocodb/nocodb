import { Injectable } from '@nestjs/common';
import { FormsService as FormsServiceCE } from 'src/services/forms.service';
import type {
  FormUpdateReqType,
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
export class FormsService extends FormsServiceCE {
  constructor(protected readonly appHooksService: AppHooksService) {
    super(appHooksService);
  }

  @TraceCommand(OperationName.formViewCreate)
  async formViewCreate(
    context: NcContext,
    param: {
      tableId: string;
      body: ViewCreateReqType;
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
    return super.formViewCreate(context, param, ncMeta);
  }

  @TraceCommand(OperationName.formViewUpdate)
  async formViewUpdate(
    context: NcContext,
    param: {
      formViewId: string;
      form: FormUpdateReqType;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    return super.formViewUpdate(context, param, ncMeta);
  }
}

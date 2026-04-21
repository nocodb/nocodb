import { Injectable } from '@nestjs/common';
import { FormsService as FormsServiceCE } from 'src/services/forms.service';
import type {
  FormUpdateReqType,
  UserType,
  ViewCreateReqType,
} from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { ViewWebhookManager } from '~/utils/view-webhook-manager';
import { NcContext } from '~/interface/config';
import { MetaService } from '~/meta/meta.service';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { b } from '~/decorators/trace-command-descriptions';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { Model, View } from '~/models';
import { MetaTable } from '~/utils/globals';
import { assertNotSandbox } from '~/helpers/sandboxGuards';

@Injectable()
export class FormsService extends FormsServiceCE {
  constructor(protected readonly appHooksService: AppHooksService) {
    super(appHooksService);
  }

  @TraceCommand({
    entity: MetaTable.VIEWS,
    entityId: 'id',
    entityTitle: (p) => p?.body?.title,
    parentId: 'tableId',
    description: ({ entityTitle, parentEntityTitle }) =>
      `Create form view ${b(entityTitle)} in ${b(parentEntityTitle)}`,
    resolveCtx: async (context, param) => {
      const table = await Model.get(context, param?.tableId);
      return { parentEntityTitle: table?.title };
    },
    idField: 'body',
  })
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
        'Personal views cannot be created in a sandbox. Create them on the master base.',
      );
    }
    return super.formViewCreate(context, param, ncMeta);
  }

  @TraceCommand({
    entity: MetaTable.VIEWS,
    entityId: (p) => p?.formViewId,
    entityTitle: (p) => p?.form?.title,
    description: ({ entityTitle, extra }) =>
      extra?.oldTitle && extra.oldTitle !== entityTitle
        ? `Rename form view ${b(extra.oldTitle)} to ${b(entityTitle)}`
        : `Edit form view ${b(entityTitle)}`,
    resolveCtx: async (context, param) => {
      const view = await View.get(context, param?.formViewId);
      return { entityTitle: view?.title, extra: { oldTitle: view?.title } };
    },
  })
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

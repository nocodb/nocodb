import { Injectable } from '@nestjs/common';
import { AppEvents, EventType } from 'nocodb-sdk';
import { ExtensionsService as ExtensionsServiceCE } from 'src/services/extensions.service';
import type { ExtensionReqType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { extensionActions } from '~/decorators/trace-command-descriptions';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { BaseTrashService } from '~/services/base-trash/base-trash.service';
import { Extension } from '~/models';
import { NcError } from '~/helpers/catchError';
import NocoSocket from '~/socket/NocoSocket';
import { MetaTable } from '~/utils/globals';

@Injectable()
export class ExtensionsService extends ExtensionsServiceCE {
  constructor(
    protected readonly appHooksServiceEE: AppHooksService,
    protected readonly baseTrashService: BaseTrashService,
  ) {
    super(appHooksServiceEE);
  }

  @TraceCommand({
    entity: MetaTable.EXTENSIONS,
    entityId: 'id',
    entityTitle: (p, r) => p?.extension?.title ?? r?.title,
    description: extensionActions.add,
    idField: 'extension',
  })
  async extensionCreate(
    context: NcContext,
    param: {
      extension: ExtensionReqType;
      req: NcRequest;
    },
  ) {
    return super.extensionCreate(context, param);
  }

  @TraceCommand({
    entity: MetaTable.EXTENSIONS,
    entityId: (p) => p?.extensionId,
    entityTitle: (p) => p?.extension?.title,
    description: (ctx) =>
      ctx.extra?.oldTitle && ctx.extra.oldTitle !== ctx.entityTitle
        ? extensionActions.rename(ctx)
        : extensionActions.edit(ctx),
    resolveCtx: async (context, param) => {
      const ext = await Extension.get(context, param?.extensionId);
      return { extra: { oldTitle: ext?.title } };
    },
  })
  async extensionUpdate(
    context: NcContext,
    param: {
      extensionId: string;
      extension: ExtensionReqType;
      req: NcRequest;
    },
  ) {
    return super.extensionUpdate(context, param);
  }

  @TraceCommand({
    entity: MetaTable.EXTENSIONS,
    entityId: (p) => p?.extensionId,
    description: extensionActions.delete,
    resolveCtx: async (context, param) => {
      const ext = await Extension.get(context, param?.extensionId);
      return { entityTitle: ext?.title };
    },
  })
  async extensionDelete(
    context: NcContext,
    param: {
      extensionId: string;
      skipTrash?: boolean;
      req: NcRequest;
    },
    ncMeta?: MetaService,
  ) {
    if (param.skipTrash) {
      return super.extensionDelete(context, param, ncMeta);
    }

    const extension = await Extension.get(
      context,
      param.extensionId,
      false,
      ncMeta,
    );
    if (!extension) {
      NcError.get(context).extensionNotFound(param.extensionId);
    }

    await this.baseTrashService.trashResource(context, {
      resourceId: param.extensionId,
      resourceType: 'extension',
      user: param.req.user,
      req: param.req,
      ncMeta,
    });

    this.appHooksServiceEE.emit(AppEvents.EXTENSION_DELETE, {
      extensionId: param.extensionId,
      req: param.req,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'extension_delete',
          payload: extension,
        },
      },
      context.socket_id,
    );

    return true;
  }
}

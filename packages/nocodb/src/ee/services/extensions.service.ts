import { Injectable } from '@nestjs/common';
import { AppEvents, EventType } from 'nocodb-sdk';
import { ExtensionsService as ExtensionsServiceCE } from 'src/services/extensions.service';
import type { ExtensionReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { OperationName } from '~/command-registry/op-names';
import { NcContext } from '~/interface/config';
import { MetaService } from '~/meta/meta.service';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { BaseTrashService } from '~/services/base-trash/base-trash.service';
import { Extension } from '~/models';
import BaseTrash from '~/models/BaseTrash';
import { NcError } from '~/helpers/catchError';
import NocoSocket from '~/socket/NocoSocket';

@Injectable()
export class ExtensionsService extends ExtensionsServiceCE {
  constructor(
    protected readonly appHooksServiceEE: AppHooksService,
    protected readonly baseTrashService: BaseTrashService,
  ) {
    super(appHooksServiceEE);
  }

  @TraceCommand(OperationName.extensionCreate)
  async extensionCreate(
    context: NcContext,
    param: {
      extension: ExtensionReqType;
      req: NcRequest;
    },
  ) {
    return super.extensionCreate(context, param);
  }

  @TraceCommand(OperationName.extensionUpdate)
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

  @TraceCommand(OperationName.extensionDelete)
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

  async restoreExtension(
    context: NcContext,
    param: { extensionId: string; req: NcRequest },
    ncMeta?: MetaService,
  ) {
    const trashEntry = await BaseTrash.getByResourceId(
      context,
      'extension',
      param.extensionId,
      ncMeta,
    );
    if (!trashEntry?.id) {
      // Already restored / never trashed.
      return false;
    }

    await this.baseTrashService.restore(context, {
      trashId: trashEntry.id,
      user: param.req?.user ?? { id: '' },
      req: param.req,
      ncMeta,
    });

    return true;
  }
}

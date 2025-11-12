import { Injectable } from '@nestjs/common';
import { AppEvents, EventType, type ExtensionReqType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { Extension } from '~/models';
import NocoSocket from '~/socket/NocoSocket';
import { NcError } from '~/helpers/ncError';

@Injectable()
export class ExtensionsService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async extensionList(context: NcContext, param: { baseId: string }) {
    return await Extension.list(context, param.baseId);
  }

  async extensionRead(context: NcContext, param: { extensionId: string }) {
    const extension = await Extension.get(context, param.extensionId);

    if (!extension) {
      NcError.get(context).extensionNotFound(param.extensionId);
    }

    return extension;
  }

  async extensionCreate(
    context: NcContext,
    param: {
      extension: ExtensionReqType;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/ExtensionReq',
      param.extension,
    );

    const res = await Extension.insert(context, {
      ...param.extension,
      fk_user_id: param.req.user.id,
    });

    this.appHooksService.emit(AppEvents.EXTENSION_CREATE, {
      extensionId: res.id,
      extension: param.extension,
      req: param.req,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'extension_create',
          payload: res,
        },
      },
      context.socket_id,
    );

    return res;
  }

  async extensionUpdate(
    context: NcContext,
    param: {
      extensionId: string;
      extension: ExtensionReqType;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/ExtensionReq',
      param.extension,
    );

    await this.extensionRead(context, param);

    const res = await Extension.update(
      context,
      param.extensionId,
      param.extension,
    );

    this.appHooksService.emit(AppEvents.EXTENSION_UPDATE, {
      extensionId: param.extensionId,
      extension: param.extension,
      req: param.req,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'extension_update',
          payload: res,
        },
      },
      context.socket_id,
    );

    return res;
  }

  async extensionDelete(
    context: NcContext,
    param: {
      extensionId: string;
      req: NcRequest;
    },
  ) {
    const extension = await this.extensionRead(context, param);

    const res = await Extension.delete(context, param.extensionId);

    this.appHooksService.emit(AppEvents.EXTENSION_DELETE, {
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

    return res;
  }
}

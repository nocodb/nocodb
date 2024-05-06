import { Injectable } from '@nestjs/common';
import { AppEvents, type ExtensionReqType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { Extension } from '~/models';

@Injectable()
export class ExtensionsService {
  constructor(private readonly appHooksService: AppHooksService) {}

  async extensionList(param: { baseId: string }) {
    return await Extension.list(param.baseId);
  }

  async extensionRead(param: { extensionId: string }) {
    return await Extension.get(param.extensionId);
  }

  async extensionCreate(param: {
    extension: ExtensionReqType;
    req: NcRequest;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/ExtensionReq',
      param.extension,
    );

    const res = await Extension.insert({
      ...param.extension,
      fk_user_id: param.req.user.id,
    });

    this.appHooksService.emit(AppEvents.EXTENSION_CREATE, {
      extensionId: res.id,
      extension: param.extension,
      req: param.req,
    });

    return res;
  }

  async extensionUpdate(param: {
    extensionId: string;
    extension: ExtensionReqType;
    req: NcRequest;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/ExtensionReq',
      param.extension,
    );

    const res = await Extension.update(param.extensionId, param.extension);

    this.appHooksService.emit(AppEvents.EXTENSION_UPDATE, {
      extensionId: param.extensionId,
      extension: param.extension,
      req: param.req,
    });

    return res;
  }

  async extensionDelete(param: { extensionId: string; req: NcRequest }) {
    const res = await Extension.delete(param.extensionId);

    this.appHooksService.emit(AppEvents.EXTENSION_DELETE, {
      extensionId: param.extensionId,
      req: param.req,
    });

    return res;
  }
}

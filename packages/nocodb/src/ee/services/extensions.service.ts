import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import { ExtensionsService as ExtensionsServiceCE } from 'src/services/extensions.service';
import type { NcContext, NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { BaseTrashService } from '~/services/base-trash/base-trash.service';
import { Extension } from '~/models';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class ExtensionsService extends ExtensionsServiceCE {
  constructor(
    protected readonly appHooksServiceEE: AppHooksService,
    protected readonly baseTrashService: BaseTrashService,
  ) {
    super(appHooksServiceEE);
  }

  async extensionDelete(
    context: NcContext,
    param: {
      extensionId: string;
      skipTrash?: boolean;
      req: NcRequest;
    },
  ) {
    if (param.skipTrash) {
      return super.extensionDelete(context, param);
    }

    const extension = await Extension.get(context, param.extensionId);
    if (!extension) {
      NcError.get(context).extensionNotFound(param.extensionId);
    }

    await this.baseTrashService.trashResource(context, {
      resourceId: param.extensionId,
      resourceType: 'extension',
      user: param.req.user,
      req: param.req,
    });

    this.appHooksServiceEE.emit(AppEvents.EXTENSION_DELETE, {
      extensionId: param.extensionId,
      req: param.req,
    });

    return true;
  }
}

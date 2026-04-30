import { Injectable } from '@nestjs/common';
import { GalleriesService as GalleriesServiceCE } from 'src/services/galleries.service';
import type {
  GalleryUpdateReqType,
  UserType,
  ViewCreateReqType,
} from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { ViewWebhookManager } from '~/utils/view-webhook-manager';
import { OperationName } from '~/command-registry/_op-names';
import { NcContext } from '~/interface/config';
import { MetaService } from '~/meta/meta.service';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { assertNotSandbox } from '~/helpers/sandboxGuards';
@Injectable()
export class GalleriesService extends GalleriesServiceCE {
  constructor(protected readonly appHooksService: AppHooksService) {
    super(appHooksService);
  }

  @TraceCommand(OperationName.galleryViewCreate)
  async galleryViewCreate(
    context: NcContext,
    param: {
      tableId: string;
      gallery: ViewCreateReqType;
      user: UserType;
      ownedBy?: string;
      req: NcRequest;
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
    return super.galleryViewCreate(context, param, ncMeta);
  }

  @TraceCommand(OperationName.galleryViewUpdate)
  async galleryViewUpdate(
    context: NcContext,
    param: {
      galleryViewId: string;
      gallery: GalleryUpdateReqType;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    ncMeta?: MetaService,
  ) {
    return super.galleryViewUpdate(context, param, ncMeta);
  }
}

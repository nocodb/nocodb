import { Injectable } from '@nestjs/common';
import type { NcContext, NcRequest, ViewRowColourV3Type } from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import type { ViewWebhookManager } from '~/utils/view-webhook-manager';

@Injectable()
export class ViewRowColorV3Service {
  async replace(
    _context: NcContext,
    _params: {
      viewId: string;
      body: ViewRowColourV3Type;
      req: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
    },
    _ncMeta?: MetaService,
  ) {}
}

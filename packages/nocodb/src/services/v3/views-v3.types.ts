import type { NcContext, NcRequest } from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';

export interface IViewsV3Service {
  getView(
    context: NcContext,
    param: { viewId: string; req: NcRequest },
    ncMeta?: MetaService,
  ): Promise<any>;
}

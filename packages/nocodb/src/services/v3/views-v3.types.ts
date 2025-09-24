import type { NcContext, NcRequest } from 'nocodb-sdk';

export interface IViewsV3Service {
  getView(
    context: NcContext,
    param: { viewId: string; req: NcRequest },
  ): Promise<any>;
}

import { Injectable } from '@nestjs/common';
import type { NcContext, NcRequest, ViewRowColour } from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';

@Injectable()
export class ViewRowColorV3Service {
  async replace(
    _context: NcContext,
    _params: {
      viewId: string;
      body: ViewRowColour;
      req: NcRequest;
    },
    _ncMeta?: MetaService,
  ) {}
}

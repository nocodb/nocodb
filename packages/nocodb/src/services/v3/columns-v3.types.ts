import type { NcContext } from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import type { Column } from '~/models';

export interface IColumnsV3Service {
  columnGet(
    context: NcContext,
    param: { columnId: string; columns?: Column[] },
    ncMeta?: MetaService,
  ): Promise<any>;
}

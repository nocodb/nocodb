import { Injectable } from '@nestjs/common';
import { FiltersV3Service as FiltersV3ServiceCE } from 'src/services/v3/filters-v3.service';

// Re-export CE helpers so callers that import from '~/services/v3/filters-v3.service'
// (which resolves to this EE file in EE mode) still get them.
export { addDummyRootAndNest } from 'src/services/v3/filters-v3.service';
import type { FilterCreateV3Type } from 'nocodb-sdk';
import type { UserType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { NcContext } from '~/interface/config';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { b } from '~/decorators/trace-command-descriptions';
import { View } from '~/models';
import { MetaTable } from '~/utils/globals';

@Injectable()
export class FiltersV3Service extends FiltersV3ServiceCE {
  @TraceCommand({
    operation: 'filterCreateV3',
    entity: MetaTable.FILTER_EXP,
    entityId: (_p, r) => r?.filters?.[0]?.id,
    parentId: 'viewId',
    description: ({ parentEntityTitle }) =>
      `Add filter in ${b(parentEntityTitle)}`,
    resolveCtx: async (context, param) => {
      const view = await View.get(context, param?.viewId);
      return { parentEntityTitle: view?.title };
    },
    deps: (_p, r) => {
      const colId = r?.filters?.[0]?.fk_column_id;
      return colId ? [{ entity: MetaTable.COLUMNS, id: colId }] : [];
    },
  })
  async filterCreate(
    context: NcContext,
    param: {
      filter: FilterCreateV3Type;
      user: UserType;
      req: NcRequest;
    } & { viewId: string },
  ) {
    return super.filterCreate(context, param);
  }
}

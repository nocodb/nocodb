import { Injectable } from '@nestjs/common';
import { TablesService as TableServiceCE } from 'src/services/tables.service';
import type { TableReqType, UserType } from 'nocodb-sdk';
import type { User } from '~/models';
import type { NcContext, NcRequest } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { Base } from '~/models';
import { MetaDiffsService } from '~/services/meta-diffs.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { ColumnsService } from '~/services/columns.service';
import { getLimit, PlanLimitTypes } from '~/plan-limits';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

@Injectable()
export class TablesService extends TableServiceCE {
  constructor(
    protected readonly metaDiffServiceEE: MetaDiffsService,
    protected readonly appHooksServiceEE: AppHooksService,
    protected readonly columnsServiceEE: ColumnsService,
  ) {
    super(metaDiffServiceEE, appHooksServiceEE, columnsServiceEE);
  }

  async tableCreate(
    context: NcContext,
    param: {
      baseId: string;
      sourceId?: string;
      table: TableReqType;
      user: User | UserType;
      req?: NcRequest;
    },
  ) {
    const base = await Base.getWithInfo(context, param.baseId);
    let source = base.sources[0];

    if (source.id !== param.sourceId) {
      source = base.sources.find((b) => b.id === param.sourceId);
    }

    if (source && source.isMeta()) {
      const tablesInSource = await Noco.ncMeta.metaCount(
        context.workspace_id,
        context.base_id,
        MetaTable.MODELS,
        {
          condition: {
            source_id: source.id,
          },
        },
      );

      const tableLimitForWorkspace = await getLimit(
        PlanLimitTypes.TABLE_LIMIT,
        context.workspace_id,
      );

      if (tablesInSource >= tableLimitForWorkspace) {
        NcError.badRequest(
          `Only ${tableLimitForWorkspace} tables are allowed, for more please upgrade your plan`,
        );
      }
    }

    return super.tableCreate(context, param);
  }
}

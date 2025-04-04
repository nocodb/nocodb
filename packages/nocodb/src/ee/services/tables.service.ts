import { Injectable } from '@nestjs/common';
import { TablesService as TableServiceCE } from 'src/services/tables.service';
import type { NcApiVersion } from 'nocodb-sdk';
import type { TableReqType, UserType } from 'nocodb-sdk';
import type { User } from '~/models';
import type { NcContext, NcRequest } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { Base } from '~/models';
import { MetaDiffsService } from '~/services/meta-diffs.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { ColumnsService } from '~/services/columns.service';
import { getLimit, PlanLimitTypes } from '~/helpers/paymentHelpers';
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
      req: NcRequest;
      synced?: boolean;
      apiVersion?: NcApiVersion;
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

      const { limit: tableLimitForWorkspace, plan } = await getLimit(
        PlanLimitTypes.LIMIT_TABLE_PER_BASE,
        context.workspace_id,
      );

      if (tablesInSource >= tableLimitForWorkspace) {
        NcError.planLimitExceeded(
          `Only ${tableLimitForWorkspace} tables are allowed, for more please upgrade your plan`,
          {
            plan: plan?.title,
            limit: tableLimitForWorkspace,
            current: tablesInSource,
          },
        );
      }

      const { limit: columnLimitForWorkspace } = await getLimit(
        PlanLimitTypes.LIMIT_COLUMN_PER_TABLE,
        context.workspace_id,
      );

      if (
        param.table?.columns?.length &&
        param.table.columns.length >= columnLimitForWorkspace
      ) {
        NcError.planLimitExceeded(
          `Maximum ${columnLimitForWorkspace} columns are allowed, for more please upgrade your plan`,
          {
            plan: plan?.title,
            limit: columnLimitForWorkspace,
            current: param.table.columns.length,
          },
        );
      }
    }

    return super.tableCreate(context, {
      ...param,
      sourceId: source?.id || param.sourceId,
    });
  }
}

import { Injectable } from '@nestjs/common';
import { ColumnsService as ColumnsServiceCE } from 'src/services/columns.service';
import type { ColumnReqType, UserType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { MetaService } from '~/meta/meta.service';
import { validatePayload } from '~/helpers';
import { Base, Model } from '~/models';
import getWorkspaceForBase from '~/utils/getWorkspaceForBase';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { getLimit, PlanLimitTypes } from '~/plan-limits';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class ColumnsService extends ColumnsServiceCE {
  constructor(
    protected readonly metaService: MetaService,
    protected readonly appHooksService: AppHooksService,
  ) {
    super(metaService, appHooksService);
  }

  async columnAdd(param: {
    req: NcRequest;
    tableId: string;
    column: ColumnReqType;
    user: UserType;
    reuse?: any;
  }) {
    validatePayload('swagger.json#/components/schemas/ColumnReq', param.column);

    const model = await Model.get(param.tableId);

    const base = await Base.getWithInfo(model.base_id);

    const source = base.sources.find((s) => s.id === model.source_id);

    if (source && source.isMeta()) {
      const workspaceId = await getWorkspaceForBase(base.id);

      const columnsInTable = await Noco.ncMeta.metaCount(
        null,
        null,
        MetaTable.COLUMNS,
        {
          condition: {
            fk_model_id: model.id,
          },
        },
      );

      const columnLimitForWorkspace = await getLimit(
        PlanLimitTypes.COLUMN_LIMIT,
        workspaceId,
      );

      if (columnsInTable >= columnLimitForWorkspace) {
        NcError.badRequest(
          `Only ${columnLimitForWorkspace} columns are allowed, for more please upgrade your plan`,
        );
      }
    }

    return super.columnAdd(param);
  }
}

export { Altered } from 'src/services/columns.service';

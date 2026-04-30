import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import { TablesService as TableServiceCE } from 'src/services/tables.service';
import type { NcApiVersion } from 'nocodb-sdk';
import type { TableReqType, UserType } from 'nocodb-sdk';
import type { User } from '~/models';
import type { NcRequest } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import { NcContext } from '~/interface/config';
import { EEOnly } from '~/decorators/ee-only.decorator';
import { NcError } from '~/helpers/catchError';
import { Base, Model } from '~/models';
import { MetaDiffsService } from '~/services/meta-diffs.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { ColumnsService } from '~/services/columns.service';
import { LinkPlaceholderService } from '~/services/link-placeholder.service';
import { BaseTrashService } from '~/services/base-trash/base-trash.service';
import { getLimit, PlanLimitTypes } from '~/helpers/paymentHelpers';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import DateDependency from '~/models/DateDependency';

@Injectable()
export class TablesService extends TableServiceCE {
  constructor(
    protected readonly metaDiffServiceEE: MetaDiffsService,
    protected readonly appHooksServiceEE: AppHooksService,
    protected readonly columnsServiceEE: ColumnsService,
    protected readonly linkPlaceholderServiceEE: LinkPlaceholderService,
    @Inject(forwardRef(() => BaseTrashService))
    protected readonly baseTrashService: BaseTrashService,
  ) {
    super(
      metaDiffServiceEE,
      appHooksServiceEE,
      columnsServiceEE,
      linkPlaceholderServiceEE,
    );
  }

  async tableDelete(
    context: NcContext,
    param: {
      tableId: string;
      user: User | UserType;
      forceDeleteRelations?: boolean;
      forceDeleteSyncs?: boolean;
      skipLinkPlaceholder?: boolean;
      skipTrash?: boolean;
      req?: any;
    },
    ncMeta?: MetaService,
  ) {
    if (param.skipTrash) {
      return super.tableDelete(context, param as any, ncMeta);
    }

    const table = await Model.get(context, param.tableId, false, ncMeta);
    if (!table) {
      NcError.get(context).tableNotFound(param.tableId);
    }

    await this.baseTrashService.trashResource(context, {
      resourceId: param.tableId,
      resourceType: 'table',
      user: param.user,
      req: param.req,
      ncMeta,
    });

    this.appHooksServiceEE.emit(AppEvents.TABLE_DELETE, {
      table,
      user: param.user,
      req: param.req,
      context,
    });

    return true;
  }

  @EEOnly()
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
      isDuplicateOperation?: boolean;
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
          xcCondition: {
            _or: [{ deleted: { eq: false } }, { deleted: { eq: null } }],
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

  async getTableWithAccessibleViews(
    context: NcContext,
    param: {
      tableId: string;
      user: User | UserType;
    },
  ) {
    const table = await super.getTableWithAccessibleViews(context, param);

    if (table) {
      table.date_dependency = await DateDependency.getByModelId(
        context,
        table.id,
      );
    }

    return table;
  }
}

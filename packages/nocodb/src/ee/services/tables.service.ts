import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import { TablesService as TableServiceCE } from 'src/services/tables.service';
import type { NcApiVersion } from 'nocodb-sdk';
import type { TableReqType, UserType } from 'nocodb-sdk';
import type { User } from '~/models';
import type { OperationSource } from '~/helpers/columnHelpers';
import type { NcRequest } from '~/interface/config';
import { MetaService } from '~/meta/meta.service';
import { NcContext } from '~/interface/config';
import { EEOnly } from '~/decorators/ee-only.decorator';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { NcError } from '~/helpers/catchError';
import { assertNotSandboxProduction } from '~/helpers/sandboxGuards';
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
import {
  TableCreateContract,
  TableDeleteContract,
  TableUpdateContract,
} from '~/command-registry/operations/tables.operations';

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

  @EEOnly()
  @TraceCommand(TableCreateContract)
  async tableCreate(
    context: NcContext,
    param: {
      baseId: string;
      sourceId?: string;
      table: TableReqType & {
        _sandboxColumnIds?: Record<string, string>;
        _sandboxDefaultViewId?: string;
      };
      user: User | UserType;
      req: NcRequest;
      synced?: boolean;
      apiVersion?: NcApiVersion;
      isDuplicateOperation?: boolean;
      operationSource?: OperationSource;
    },
  ) {
    await assertNotSandboxProduction(
      context,
      'Creating tables is not allowed on a base with an active sandbox. Create tables in the sandbox.',
    );

    // During replay: inject sandbox column IDs into the column definitions so
    // auto-created columns (Title etc.) get the same IDs on production as in sandbox.
    const { _sandboxColumnIds, _sandboxDefaultViewId, ...tableBody } =
      param.table ?? {};
    const tableParam: any = { ...tableBody };
    if (_sandboxColumnIds && tableParam.columns?.length) {
      tableParam.columns = tableParam.columns.map((col: any) => ({
        ...col,
        id: _sandboxColumnIds[col.title] ?? _sandboxColumnIds[col.cn] ?? col.id,
      }));
    }
    if (_sandboxDefaultViewId) {
      tableParam._sandboxDefaultViewId = _sandboxDefaultViewId;
    }

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
        tableParam?.columns?.length &&
        tableParam.columns.length >= columnLimitForWorkspace
      ) {
        NcError.planLimitExceeded(
          `Maximum ${columnLimitForWorkspace} columns are allowed, for more please upgrade your plan`,
          {
            plan: plan?.title,
            limit: columnLimitForWorkspace,
            current: tableParam.columns.length,
          },
        );
      }
    }

    return super.tableCreate(context, {
      ...param,
      table: tableParam,
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

  @EEOnly()
  @TraceCommand(TableUpdateContract)
  async tableUpdate(
    context: NcContext,
    param: {
      tableId: any;
      table: Partial<TableReqType> & { base_id?: string };
      baseId?: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    await assertNotSandboxProduction(
      context,
      'Renaming tables is not allowed on a base with an active sandbox. Make the change in the sandbox.',
    );

    return super.tableUpdate(context, param);
  }

  @EEOnly()
  @TraceCommand(TableDeleteContract)
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
    await assertNotSandboxProduction(
      context,
      'Deleting tables is not allowed on a base with an active sandbox. Delete the table in the sandbox.',
    );

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
}

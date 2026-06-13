import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import { TablesService as TableServiceCE } from 'src/services/tables.service';
import type { NcApiVersion, OperationSource } from 'nocodb-sdk';
import type { TableReqType, UserType } from 'nocodb-sdk';
import type { User } from '~/models';
import type { NcRequest } from '~/interface/config';
import { OperationName } from '~/command-registry/op-names';
import { MetaService } from '~/meta/meta.service';
import { NcContext } from '~/interface/config';
import { EEOnly } from '~/decorators/ee-only.decorator';
import {
  captureForTrace,
  TraceCommand,
} from '~/decorators/trace-command.decorator';
import { NcError } from '~/helpers/catchError';
import { assertNotSandboxProduction } from '~/helpers/sandboxGuards';
import { Base, Model } from '~/models';
import { MetaDiffsService } from '~/services/meta-diffs.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { ColumnsService } from '~/services/columns.service';
import { LinkPlaceholderService } from '~/services/link-placeholder.service';
import { BaseTrashService } from '~/services/base-trash/base-trash.service';
import { MetaDependencyEventHandler } from '~/services/meta-dependency/event-handler.service';
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
    protected readonly baseTrashService: BaseTrashService,
    protected readonly metaDependencyEventHandlerEE: MetaDependencyEventHandler,
  ) {
    super(
      metaDiffServiceEE,
      appHooksServiceEE,
      columnsServiceEE,
      linkPlaceholderServiceEE,
      metaDependencyEventHandlerEE,
    );
  }

  @EEOnly()
  @TraceCommand(OperationName.tableCreate)
  async tableCreate(
    context: NcContext,
    param: {
      baseId: string;
      sourceId?: string;
      table: TableReqType;
      user: User | UserType;
      req: NcRequest;
      synced?: boolean;
      mm?: boolean;
      apiVersion?: NcApiVersion;
      isDuplicateOperation?: boolean;
      operationSource?: OperationSource;
    },
  ) {
    await assertNotSandboxProduction(
      context,
      'Creating tables is not allowed on a base with an active sandbox. Create tables in the sandbox.',
    );

    const tableParam: any = { ...(param.table ?? {}) };

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
            _and: [
              { _or: [{ deleted: { eq: false } }, { deleted: { eq: null } }] },
              { _or: [{ mm: { eq: false } }, { mm: { eq: null } }] },
            ],
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

    const created = await super.tableCreate(context, {
      ...param,
      table: tableParam,
      sourceId: source?.id || param.sourceId,
    });

    if (created && Array.isArray(created.columns)) {
      captureForTrace(
        'sandboxColumns',
        created.columns.map((c) => ({
          id: c.id,
          cn: c.column_name,
          title: c.title,
        })),
      );
    }
    const defaultViewId = created?.views?.[0]?.id;
    if (defaultViewId) captureForTrace('sandboxDefaultViewId', defaultViewId);

    return created;
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
  @TraceCommand(OperationName.tableUpdate)
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
  @TraceCommand(OperationName.tableDelete)
  async tableDelete(
    context: NcContext,
    param: {
      tableId: string;
      forceDeleteRelations?: boolean;
      forceDeleteSyncs?: boolean;
      skipLinkPlaceholder?: boolean;
      skipTrash?: boolean;
      req: NcRequest;
      /**
       * When trashing (skipTrash falsy), record the table's trash entry as a
       * child of this parent. Only the table-sync drop path passes this — plain
       * table deletes leave the entry parentless as before.
       */
      parent?: { type: string; id: string; name?: string };
    },
    ncMeta?: MetaService,
  ) {
    await assertNotSandboxProduction(
      context,
      'Deleting tables is not allowed on a base with an active sandbox. Delete the table in the sandbox.',
    );

    const table = await Model.get(context, param.tableId, false, ncMeta);
    if (!table) {
      NcError.get(context).tableNotFound(param.tableId);
    }

    if (table.synced && !param.forceDeleteSyncs) {
      NcError.get(context).invalidRequestBody(
        'This table is managed by a sync. Convert it to a regular table before deleting it.',
      );
    }

    if (table.mm && !param.forceDeleteSyncs) {
      return super.tableDelete(context, param, ncMeta);
    }

    if (param.skipTrash) {
      return super.tableDelete(context, param, ncMeta);
    }

    const user = param.req?.user;

    await this.baseTrashService.trashResource(context, {
      resourceId: param.tableId,
      resourceType: 'table',
      user,
      req: param.req,
      ncMeta,
      parent: param.parent,
    });

    this.appHooksServiceEE.emit(AppEvents.TABLE_DELETE, {
      table,
      user,
      req: param.req,
      context,
    });

    return true;
  }
}

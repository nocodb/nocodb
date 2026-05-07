import { Injectable } from '@nestjs/common';
import {
  AppEvents,
  EventType,
  isDeletedCol,
  PlanFeatureTypes,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { Model, Source } from '~/models';
import BaseTrash from '~/models/BaseTrash';
import { NcError } from '~/helpers/catchError';
import { TablesService } from '~/services/tables.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { TRASH_BATCH_SIZE } from '~/services/base-trash/record-trash.helpers';
import { checkForFeature } from '~/helpers/paymentHelpers';
import { resolveTrashRetentionDays } from '~/ee/helpers/trashHelpers';
import { getCompositePkValue } from '~/helpers/dbHelpers';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import NocoSocket from '~/socket/NocoSocket';

@Injectable()
export class BaseTrashSettingsService {
  constructor(
    private readonly tablesService: TablesService,
    private readonly appHooksService: AppHooksService,
  ) {}

  async list(
    context: NcContext,
    param: {
      baseId: string;
      user: NcRequest['user'];
      roles: Record<string, boolean>;
    },
  ) {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_TRASH_SETTINGS);

    const accessibleTables = await this.tablesService.getAccessibleTables(
      context,
      {
        baseId: param.baseId,
        roles: param.roles,
        user: param.user,
        allSources: true,
      },
    );

    const defaultRetentionDays = await resolveTrashRetentionDays(context, {
      source: 'record',
    });

    const sources = await Source.list(context, { baseId: param.baseId });
    const metaSourceId = sources.find((s) => s.isMeta())?.id;

    const tables = await Promise.all(
      accessibleTables.map(async (model) => {
        await model.getColumns(context);
        const hasDeletedColumn = model.columns.some((c) => isDeletedCol(c));
        return {
          id: model.id,
          title: model.title,
          trash_disabled: model.trash_disabled,
          trash_retention_days: model.trash_retention_days,
          is_meta: !!metaSourceId && model.source_id === metaSourceId,
          has_deleted_column: hasDeletedColumn,
        };
      }),
    );

    return { tables, defaultRetentionDays };
  }

  /**
   * Update per-table trash settings (disabled flag, retention override).
   * Disabling a table's trash empties any existing soft-deleted rows.
   */
  async update(
    context: NcContext,
    param: {
      tableId: string;
      body: {
        trash_disabled?: boolean | null;
        trash_retention_days?: number | null;
      };
    },
    req: NcRequest,
  ) {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_TRASH_SETTINGS);

    const accessibleTables = await this.tablesService.getAccessibleTables(
      context,
      {
        baseId: context.base_id,
        roles: req?.user?.base_roles ?? {},
        user: req?.user,
        allSources: true,
      },
    );

    if (!accessibleTables.some((t) => t.id === param.tableId)) {
      NcError.get(context).tableNotFound(param.tableId);
    }

    const model = await Model.get(context, param.tableId);
    if (!model) NcError.get(context).tableNotFound(param.tableId);

    const source = await Source.get(context, model.source_id);
    if (!source || !source.isMeta()) {
      NcError.get(context).tableTrashNotSupported(model.title);
    }

    await model.getColumns(context);
    if (!model.columns.some((c) => isDeletedCol(c))) {
      NcError.get(context).tableTrashNotSupported(model.title);
    }

    await Model.updateTrashSettings(context, param.tableId, param.body);

    if (param.body.trash_disabled) {
      await this.emptyTableTrash(context, { tableId: param.tableId, req });
    }

    const table = await Model.getWithInfo(context, { id: model.id });

    NocoSocket.broadcastEvent(context, {
      event: EventType.META_EVENT,
      payload: { action: 'table_update', payload: table },
    });

    return { message: 'Trash settings updated' };
  }

  /**
   * Hard-delete every soft-deleted row in a table (RLS-bounded). Internal —
   * invoked from `update` when trash is disabled on a table.
   */
  private async emptyTableTrash(
    context: NcContext,
    param: { tableId: string; req: NcRequest },
  ): Promise<void> {
    const model = await Model.get(context, param.tableId);
    if (!model) NcError.get(context).tableNotFound(param.tableId);
    await model.getColumns(context);

    const deletedColumn = model.columns.find((c) => isDeletedCol(c));
    if (!deletedColumn) return;

    const source = await Source.get(context, model.source_id);
    if (!source || !source.isMeta()) return;

    const baseModel = await Model.getBaseModelSQL(context, {
      model,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const primaryKeys = model.primaryKeys;
    const pkColNames = primaryKeys.map((pk) => pk.column_name);

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const qb = baseModel
        .dbDriver(baseModel.tnPath)
        .select(pkColNames)
        .where(deletedColumn.column_name, true)
        .limit(TRASH_BATCH_SIZE);

      const rows = await baseModel.execAndParse(qb, null, { raw: true });
      if (!rows.length) break;

      const ids = rows.map((r) => getCompositePkValue(primaryKeys, r));
      await baseModel.permanentDeleteByIds(ids, param.req, true);

      this.appHooksService.emit(AppEvents.RECORDS_PERMANENT_DELETE, {
        context,
        req: param.req,
        tableId: param.tableId,
        rowIds: ids,
      });
    }

    await BaseTrash.deleteRecordEntriesForTable(context, param.tableId);
  }
}

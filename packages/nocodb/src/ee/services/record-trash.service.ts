import { Injectable } from '@nestjs/common';
import { isDeletedCol, PlanFeatureTypes, PlanLimitTypes } from 'nocodb-sdk';
import { RecordTrashService as RecordTrashServiceCE } from 'src/services/record-trash.service';
import type { NcRequest } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import {
  checkForFeature,
  checkLimit,
  getLimit,
} from '~/helpers/paymentHelpers';
import { Model, Source } from '~/models';
import { NcError } from '~/helpers/catchError';
import { TablesService } from '~/services/tables.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

@Injectable()
export class RecordTrashService extends RecordTrashServiceCE {
  constructor(
    protected readonly appHooksService: AppHooksService,
    protected readonly tablesService: TablesService,
  ) {
    super(appHooksService);
  }

  async getBaseTrashSettings(
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

    const defaultRetentionDays = await this.resolveRetentionDays(context);

    const tables = await Promise.all(
      accessibleTables.map(async (t) => {
        const model = await Model.get(context, t.id);
        await model.getColumns(context);

        const source = await Source.get(context, model.source_id);
        const isMeta = source?.isMeta();
        const hasDeletedColumn = model.columns.some((c) => isDeletedCol(c));

        return {
          id: model.id,
          title: model.title,
          trash_disabled: model.trash_disabled,
          trash_retention_days: model.trash_retention_days,
          is_meta: isMeta,
          has_deleted_column: hasDeletedColumn,
        };
      }),
    );

    return { tables, defaultRetentionDays };
  }

  async updateTrashSettings(
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

    // Verify table visibility first
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
      await this.emptyTrash(context, { tableId: param.tableId, req });
    }

    return { message: 'Trash settings updated' };
  }

  protected async resolveRetentionDays(context: NcContext): Promise<number> {
    try {
      const { limit } = await getLimit(
        PlanLimitTypes.LIMIT_TRASH_RETENTION,
        context.workspace_id,
      );
      if (limit !== Infinity && limit > 0) return limit;
    } catch {
      // fallback below
    }
    return parseInt(process.env.NC_TRASH_RETENTION_DAYS || '30', 10);
  }

  protected async checkRestoreLimits(
    context: NcContext,
    count: number,
  ): Promise<void> {
    await checkLimit({
      workspaceId: context.workspace_id,
      type: PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE,
      delta: count,
    });
  }
}

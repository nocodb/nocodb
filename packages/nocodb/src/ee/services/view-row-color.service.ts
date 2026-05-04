import { Injectable, Logger } from '@nestjs/common';
import {
  arrayToNested,
  EventType,
  NcBaseError,
  NcContext,
  parseProp,
  PlanFeatureTypes,
  ROW_COLORING_MODE,
  UITypes,
} from 'nocodb-sdk';
import {
  type RowColorConditionBody,
  ViewRowColorService as ViewRowColorServiceCE,
} from 'src/services/view-row-color.service';
import type {
  ColumnReqType,
  FilterType,
  NcRequest,
  RowColoringInfo,
  RowColoringInfoFilter,
  RowColoringInfoFilterRow,
} from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import type { Column, SelectOption } from '~/models';
import type { ViewMetaRowColoring } from '~/models/View';
import { EEOnly } from '~/decorators/ee-only.decorator';
import {
  type ViewWebhookManager,
  ViewWebhookManagerBuilder,
} from '~/utils/view-webhook-manager';
import { MetaTable } from '~/cli';
import { NcError } from '~/helpers/catchError';
import { extractProps } from '~/helpers/extractProps';
import { checkForFeature } from '~/helpers/paymentHelpers';
import { Model, View } from '~/models';
import RowColorCondition from '~/models/RowColorCondition';
import Noco from '~/Noco';
import NocoSocket from '~/socket/NocoSocket';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { OperationName } from '~/command-registry/op-names';

@Injectable()
export class ViewRowColorService extends ViewRowColorServiceCE {
  protected logger = new Logger(ViewRowColorService.name);

  @EEOnly()
  async getByViewId(
    context: NcContext,
    param: {
      fk_view_id?: string;
      ncMeta?: MetaService;
    },
  ) {
    const ncMeta = param.ncMeta ?? Noco.ncMeta;

    let view: View;
    if (param.fk_view_id) {
      view = await View.get(context, param.fk_view_id);
      if (!view) {
        NcError.get(context).viewNotFound(param.fk_view_id);
      }
    } else {
      NcError.requiredFieldMissing('view_id');
    }

    if (view.row_coloring_mode === ROW_COLORING_MODE.SELECT) {
      const model = await Model.get(context, view.fk_model_id);

      await model.getColumns(context);

      const meta: ViewMetaRowColoring = parseProp(view.meta);

      const selectColumn = model.columns.find(
        (k) => k.id === meta?.rowColoringInfo?.fk_column_id,
      );

      // If select column is not found that means the column is deleted
      if (!selectColumn) {
        return null;
      }

      const selectOptions = await selectColumn.getColOptions<SelectOption>(
        context,
      );

      return {
        options: (selectOptions as any).options,
        mode: ROW_COLORING_MODE.SELECT,
        is_set_as_background: meta?.rowColoringInfo?.is_set_as_background,
        type: 'row', // Select mode only supports row coloring
        fk_column_id: meta?.rowColoringInfo?.fk_column_id,
        selectColumn,
        fk_model_id: model.id,
        fk_view_id: view.id,
      } as RowColoringInfo;
    } else if (view.row_coloring_mode === ROW_COLORING_MODE.FILTER) {
      const result = {
        mode: ROW_COLORING_MODE.FILTER,
        fk_model_id: view.fk_model_id,
        fk_view_id: view.id,
        conditions: [],
      } as RowColoringInfo;

      const rowColorConditions = await RowColorCondition.getByViewId(
        context,
        view.id,
      );
      const rawFilters = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.FILTER_EXP,
        {
          xcCondition: (knex) =>
            knex.whereIn(
              'fk_row_color_condition_id',
              rowColorConditions.map((k) => k.id),
            ),
        },
      );

      for (const rowColorCondition of rowColorConditions.sort(
        (k, l) => k.nc_order - l.nc_order,
      )) {
        const filters = rawFilters
          .filter((k) => k.fk_row_color_condition_id === rowColorCondition.id)
          .sort((k, l) => k.order - l.order);
        const nestedFilters = arrayToNested({
          data: filters,
          childAssignHandler: (filter, children) =>
            filter.children === children,
          getFkHandler: (filter) => filter.fk_parent_id,
          getIdHandler: (filter) => filter.id,
        });
        const condition: RowColoringInfoFilterRow = {
          id: rowColorCondition.id,
          color: rowColorCondition.color,
          nc_order: rowColorCondition.nc_order,
          is_set_as_background: rowColorCondition.is_set_as_background,
          type: rowColorCondition.type ?? 'row',
          fk_target_column_id: rowColorCondition.fk_target_column_id,
          conditions: filters,
          nestedConditions: nestedFilters,
        };
        (result as RowColoringInfoFilter).conditions.push(condition);
      }
      return result;
    } else {
      return null;
    }
  }

  // Recursively inserts a row-color filter and its descendants. Each node
  // honors a pre-set `id` and `order` under `is_replay` so undo of
  // `rowColorConditionDelete` can rebuild the original tree shape verbatim.
  // We don't go through `Filter.insert` because that path requires one of
  // {fk_view_id, fk_hook_id, fk_parent_column_id, fk_level_id, fk_button_col_id}
  // which row-color filters don't have.
  private async insertRowColorFilterSubtree(
    context: NcContext,
    rowColorConditionId: string,
    filter: Partial<FilterType> & { children?: Partial<FilterType>[] },
    ncMeta: MetaService,
    fkParentId: string | null = null,
  ) {
    const isReplay = context?.additionalContext?.is_replay === true;
    const insertObj = extractProps(filter as any, [
      'fk_column_id',
      'comparison_op',
      'comparison_sub_op',
      'value',
      'is_group',
      'logical_op',
      'base_id',
      'source_id',
      'meta',
      'enabled',
      ...(isReplay ? (['order'] as const) : []),
    ]) as Record<string, unknown>;
    insertObj.fk_row_color_condition_id = rowColorConditionId;
    insertObj.fk_parent_id = fkParentId ?? filter.fk_parent_id ?? null;
    if (isReplay && (filter as { id?: string }).id) {
      insertObj.id = (filter as { id?: string }).id;
    }
    if (!isReplay) {
      insertObj.order = await ncMeta.metaGetNextOrder(MetaTable.FILTER_EXP, {
        fk_row_color_condition_id: rowColorConditionId,
        fk_parent_id: insertObj.fk_parent_id,
      });
    }
    const inserted = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.FILTER_EXP,
      insertObj,
    );
    if (filter.children?.length) {
      for (const child of filter.children) {
        await this.insertRowColorFilterSubtree(
          context,
          rowColorConditionId,
          child as Partial<FilterType>,
          ncMeta,
          inserted.id as string,
        );
      }
    }
    return inserted;
  }

  @TraceCommand(OperationName.rowColorConditionAdd)
  @EEOnly()
  async addRowColoringCondition(
    context: NcContext,
    param: {
      fk_view_id?: string;
      condition: RowColorConditionBody & { id?: string };
      req?: NcRequest;
      filter?: FilterType;
      filters?: FilterType[];
      viewWebhookManager?: ViewWebhookManager;
      ncMeta?: MetaService;
    },
  ) {
    const ncMeta = param.ncMeta ?? Noco.ncMeta;
    const { condition } = param;
    await checkForFeature(context, PlanFeatureTypes.FEATURE_ROW_COLOUR, ncMeta);

    if (condition.type === 'cell') {
      await checkForFeature(
        context,
        PlanFeatureTypes.FEATURE_CELL_COLOUR,
        ncMeta,
      );

      if (!condition.fk_target_column_id) {
        NcError.get(context).requiredFieldMissing('fk_target_column_id');
      }
    }

    let view: View;
    if (param.fk_view_id) {
      view = await View.get(context, param.fk_view_id);
      if (!view) {
        NcError.get(context).viewNotFound(param.fk_view_id);
      }
    } else {
      NcError.get(context).requiredFieldMissing('view_id');
    }
    if (
      view.row_coloring_mode &&
      view.row_coloring_mode !== ROW_COLORING_MODE.FILTER
    ) {
      NcError.get(context).invalidRequestBody(
        'Cannot directly change row coloring mode, remove it first',
      );
    }
    if (!condition.color || !condition.nc_order) {
      NcError.get(context).invalidRequestBody(
        'Invalid payload for row coloring condition',
      );
    }

    const viewWebhookManager =
      param.viewWebhookManager ??
      (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(view.id)
      ).forUpdate();

    const ncMetaTrans = await ncMeta.startTransaction();

    try {
      const rowColoringCondition = await RowColorCondition.insert(
        context,
        {
          // `is_replay` honors a pre-set id; ignored on the normal path.
          id: condition.id,
          fk_view_id: view.id,
          fk_workspace_id: context.workspace_id,
          base_id: context.base_id,
          color: condition.color,
          nc_order: condition.nc_order,
          is_set_as_background: condition.is_set_as_background ?? false,
          type: condition.type ?? 'row',
          fk_target_column_id: condition.fk_target_column_id,
        },
        ncMetaTrans,
      );
      const rowColoringConditionId = rowColoringCondition.id;

      const filterRoots = param.filters ?? (param.filter ? [param.filter] : []);
      for (const root of filterRoots) {
        await this.insertRowColorFilterSubtree(
          context,
          rowColoringConditionId,
          root,
          ncMetaTrans,
        );
      }

      if (!view.row_coloring_mode) {
        await View.update(
          context,
          view.id,
          {
            row_coloring_mode: ROW_COLORING_MODE.FILTER,
          },
          false,
          ncMeta,
        );
      }

      await ncMetaTrans.commit();

      const rowColorInfo = await this.getByViewId(context, {
        fk_view_id: view.id,
        ncMeta,
      });

      NocoSocket.broadcastEvent(
        context,
        {
          event: EventType.META_EVENT,
          payload: {
            action: 'row_color_update',
            payload: rowColorInfo,
          },
        },
        context.socket_id,
      );
      if (!param.viewWebhookManager) {
        (await viewWebhookManager.withNewViewId(view.id)).emit();
      }

      return {
        id: rowColoringCondition.id,
        info: rowColorInfo,
      };
    } catch (e) {
      await ncMetaTrans.rollback(e);
      if (e instanceof NcError || e instanceof NcBaseError) throw e;
      this.logger.error('Failed to add row color condition', e);
      NcError.get(context).internalServerError(
        'Failed to add row color condition',
      );
    }
  }

  @TraceCommand(OperationName.rowColorConditionUpdate)
  @EEOnly()
  async updateRowColoringCondition(
    context: NcContext,
    param: {
      fk_view_id?: string;
      fk_row_coloring_conditions_id: string;
      condition: RowColorConditionBody;
      req?: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
      ncMeta?: MetaService;
    },
  ) {
    const ncMeta = param.ncMeta ?? Noco.ncMeta;
    const { condition } = param;

    if (condition.type === 'cell') {
      await checkForFeature(
        context,
        PlanFeatureTypes.FEATURE_CELL_COLOUR,
        ncMeta,
      );

      if (!condition.fk_target_column_id) {
        NcError.get(context).requiredFieldMissing('fk_target_column_id');
      }
    }

    let view: View;
    if (param.fk_view_id) {
      view = await View.get(context, param.fk_view_id);
      if (!view) {
        NcError.get(context).viewNotFound(param.fk_view_id);
      }
    } else {
      NcError.requiredFieldMissing('view_id');
    }
    if (
      view.row_coloring_mode &&
      view.row_coloring_mode !== ROW_COLORING_MODE.FILTER
    ) {
      NcError.badRequest(
        'Cannot directly change row coloring mode, remove it first',
      );
    }

    const viewWebhookManager =
      param.viewWebhookManager ??
      (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(view.id)
      ).forUpdate();

    const rowColorCondition = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.ROW_COLOR_CONDITIONS,
      {
        fk_workspace_id: context.workspace_id,
        base_id: context.base_id,
        color: condition.color,
        nc_order: condition.nc_order,
        is_set_as_background: condition.is_set_as_background,
        ...(condition.type !== undefined && { type: condition.type }),
        ...(condition.fk_target_column_id !== undefined && {
          fk_target_column_id: condition.fk_target_column_id,
        }),
      },
      param.fk_row_coloring_conditions_id,
    );

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'row_color_update',
          payload: await this.getByViewId(context, {
            fk_view_id: view.id,
            ncMeta,
          }),
        },
      },
      context.socket_id,
    );
    if (!param.viewWebhookManager) {
      (await viewWebhookManager.withNewViewId(view.id)).emit();
    }

    return rowColorCondition;
  }

  @TraceCommand(OperationName.rowColorConditionDelete)
  @EEOnly()
  async deleteRowColoringCondition(
    context: NcContext,
    param: {
      fk_view_id?: string;
      fk_row_coloring_conditions_id: string;
      req?: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
      ncMeta?: MetaService;
    },
  ) {
    const ncMeta = param.ncMeta ?? Noco.ncMeta;
    const exists = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.ROW_COLOR_CONDITIONS,
      {
        id: param.fk_row_coloring_conditions_id,
      },
    );
    if (!exists) {
      NcError.notFound(
        `Row color condition with id ${param.fk_row_coloring_conditions_id} does not exists`,
      );
    }
    if (param.fk_view_id && param.fk_view_id !== exists.fk_view_id) {
      NcError.notFound(
        `Row color condition with id ${param.fk_row_coloring_conditions_id} does not exists`,
      );
    }

    const view = await View.get(context, exists.fk_view_id);

    if (!view) {
      NcError.get(context).viewNotFound(param.fk_view_id);
    }

    const viewWebhookManager =
      param.viewWebhookManager ??
      (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(view.id)
      ).forUpdate();

    await RowColorCondition.delete(
      context,
      param.fk_row_coloring_conditions_id,
      param.ncMeta,
    );

    const remaining = await RowColorCondition.getByViewId(context, view.id);
    if (remaining.length === 0 && view.row_coloring_mode) {
      await View.update(
        context,
        view.id,
        { row_coloring_mode: null },
        false,
        ncMeta,
      );
    }

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'row_color_update',
          payload: await this.getByViewId(context, {
            fk_view_id: view.id,
            ncMeta,
          }),
        },
      },
      context.socket_id,
    );
    if (!param.viewWebhookManager) {
      (await viewWebhookManager.withNewViewId(view.id)).emit();
    }
  }

  @TraceCommand(OperationName.rowColorSelectSet)
  @EEOnly()
  async setRowColoringSelect(
    context: NcContext,
    param: {
      fk_view_id?: string;
      fk_column_id: string;
      is_set_as_background: boolean;
      req?: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
      ncMeta?: MetaService;
    },
  ) {
    const ncMeta = param.ncMeta ?? Noco.ncMeta;

    await checkForFeature(context, PlanFeatureTypes.FEATURE_ROW_COLOUR, ncMeta);

    let view: View;
    if (param.fk_view_id) {
      view = await View.get(context, param.fk_view_id);
      if (!view) {
        NcError.get(context).viewNotFound(param.fk_view_id);
      }
    } else {
      NcError.get(context).requiredFieldMissing('view_id');
    }
    if (!param.fk_column_id) {
      NcError.get(context).requiredFieldMissing('fk_column_id');
    } else {
      const columns = await view.getColumns(context);
      if (!columns.find((col) => col.fk_column_id === param.fk_column_id)) {
        NcError.get(context).fieldNotFound(param.fk_column_id);
      }
    }

    const viewWebhookManager =
      param.viewWebhookManager ??
      (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(view.id)
      ).forUpdate();

    const viewMeta: ViewMetaRowColoring = parseProp(view.meta);
    viewMeta.rowColoringInfo = {
      fk_column_id: param.fk_column_id,
      is_set_as_background: param.is_set_as_background ?? false,
    };

    const result = await View.update(
      context,
      view.id,
      {
        row_coloring_mode: ROW_COLORING_MODE.SELECT,
        meta: viewMeta,
      },
      false,
      ncMeta,
    );

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'view_update',
          payload: {
            ...result,
            from_row_color: true,
          },
        },
      },
      context.socket_id,
    );
    if (!param.viewWebhookManager) {
      (await viewWebhookManager.withNewViewId(view.id)).emit();
    }
  }

  @TraceCommand(OperationName.rowColoringRemove)
  @EEOnly()
  async removeRowColorInfo(
    context: NcContext,
    param: {
      fk_view_id?: string;
      req?: NcRequest;
      ncMeta?: MetaService;
      viewWebhookManager?: ViewWebhookManager;
    },
  ) {
    const ncMeta = param.ncMeta ?? Noco.ncMeta;
    let view: View;
    if (param.fk_view_id) {
      view = await View.get(context, param.fk_view_id);
      if (!view) {
        NcError.get(context).viewNotFound(param.fk_view_id);
      }
    } else {
      NcError.get(context).requiredFieldMissing('view_id');
    }

    const viewWebhookManager =
      param.viewWebhookManager ??
      (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(view.id)
      ).forUpdate();

    if (view.row_coloring_mode === ROW_COLORING_MODE.FILTER) {
      const rowColorConditions = await RowColorCondition.getByViewId(
        context,
        view.id,
      );

      const ncMetaTrans = await ncMeta.startTransaction();

      try {
        for (const rowColorCondition of rowColorConditions) {
          await ncMetaTrans.metaDelete(
            context.workspace_id,
            context.base_id,
            MetaTable.FILTER_EXP,
            {
              fk_row_color_condition_id: rowColorCondition.id,
            },
          );
          await ncMetaTrans.metaDelete(
            context.workspace_id,
            context.base_id,
            MetaTable.ROW_COLOR_CONDITIONS,
            rowColorCondition.id,
          );
        }

        const result = await View.update(
          context,
          view.id,
          {
            row_coloring_mode: null,
          },
          false,
          ncMeta,
        );

        NocoSocket.broadcastEvent(
          context,
          {
            event: EventType.META_EVENT,
            payload: {
              action: 'view_update',
              payload: {
                ...result,
                from_row_color: true,
              },
            },
          },
          context.socket_id,
        );

        await ncMetaTrans.commit();
      } catch (e) {
        await ncMetaTrans.rollback(e);
        if (e instanceof NcError || e instanceof NcBaseError) throw e;
        this.logger.error('Failed to remove row color info', e);
        NcError.get(context).internalServerError(
          'Failed to remove row color info',
        );
      }
    } else if (view.row_coloring_mode === ROW_COLORING_MODE.SELECT) {
      const viewMeta = parseProp(view.meta);
      delete viewMeta.rowColoringInfo;

      const result = await View.update(
        context,
        view.id,
        {
          row_coloring_mode: null,
          meta: viewMeta,
        },
        false,
        ncMeta,
      );

      NocoSocket.broadcastEvent(
        context,
        {
          event: EventType.META_EVENT,
          payload: {
            action: 'view_update',
            payload: {
              ...result,
              from_row_color: true,
            },
          },
        },
        context.socket_id,
      );
    }

    if (!param.viewWebhookManager) {
      (await viewWebhookManager.withNewViewId(view.id)).emit();
    }
  }

  @EEOnly()
  async checkIfColumnInvolved(
    context: NcContext,
    param: {
      existingColumn: Column;
      newColumn?: Column | ColumnReqType;
      action: 'delete' | 'update';
      ncMeta?: MetaService;
    },
  ) {
    const { existingColumn, newColumn, action } = param;
    const ncMeta = param.ncMeta ?? Noco.ncMeta;
    const commitHandlers: (() => Promise<void>)[] = [];

    if (
      existingColumn.uidt === UITypes.SingleSelect &&
      (action === 'delete' ||
        (action === 'update' && newColumn?.uidt !== UITypes.SingleSelect))
    ) {
      // remove row coloring select from view
      const views = await View.list(context, existingColumn.fk_model_id);
      for (const view of views) {
        if (view.row_coloring_mode === ROW_COLORING_MODE.SELECT) {
          const metaRowColoring: ViewMetaRowColoring =
            parseProp(view.meta) ?? {};
          if (
            metaRowColoring?.rowColoringInfo?.fk_column_id === existingColumn.id
          ) {
            commitHandlers.push(() =>
              this.removeRowColorInfo(context, {
                fk_view_id: view.id,
              }),
            );
          }
        }
      }
    }

    if (action === 'delete') {
      // Handle cell-type row color conditions that target this column (fk_target_column_id)
      const cellColorConditions = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.ROW_COLOR_CONDITIONS,
        {
          condition: {
            fk_target_column_id: existingColumn.id,
            type: 'cell',
          },
        },
      );

      if (cellColorConditions?.length > 0) {
        for (const condition of cellColorConditions) {
          // Delete the cell-type condition (this will cascade delete filters)
          commitHandlers.push(() =>
            this.deleteRowColoringCondition(context, {
              fk_view_id: condition.fk_view_id,
              fk_row_coloring_conditions_id: condition.id,
              ncMeta,
            }),
          );

          // Check if this was the last condition in the view
          const allConditionsInView = await RowColorCondition.getByViewId(
            context,
            condition.fk_view_id,
          );

          const remainingConditions = allConditionsInView.filter(
            (c) => c.id !== condition.id,
          );

          if (remainingConditions.length === 0) {
            // If no other conditions remain, remove row coloring mode entirely
            commitHandlers.push(() =>
              this.removeRowColorInfo(context, {
                fk_view_id: condition.fk_view_id,
                ncMeta,
              }),
            );
          }
        }
      }

      // Handle row color conditions that use this column in filters (fk_column_id)
      const inConditions = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.FILTER_EXP,
        {
          xcCondition: (qb) => {
            qb.where('fk_column_id', existingColumn.id).whereNotNull(
              'fk_row_color_condition_id',
            );
          },
        },
      );

      if ((inConditions?.length ?? 0) > 0) {
        // get unique affectedRowColorConditionIds
        const affectedRowColorConditionIds = [
          ...new Set(inConditions.map((flt) => flt.fk_row_color_condition_id)),
        ];
        const affectedFilters = await ncMeta.metaList2(
          context.workspace_id,
          context.base_id,
          MetaTable.FILTER_EXP,
          {
            xcCondition: (qb) => {
              qb.whereIn(
                'fk_row_color_condition_id',
                affectedRowColorConditionIds,
              );
            },
          },
        );
        for (const affectedRowColorConditionId of affectedRowColorConditionIds) {
          // if not has other filters, remove the row coloring condition
          if (
            !affectedFilters.some(
              (flt) =>
                flt.fk_column_id !== existingColumn.id &&
                flt.fk_row_color_condition_id === affectedRowColorConditionId,
            )
          ) {
            const rowColorCondition = await RowColorCondition.getById(
              context,
              affectedRowColorConditionId,
            );
            commitHandlers.push(() =>
              this.deleteRowColoringCondition(context, {
                fk_view_id: rowColorCondition.fk_view_id,
                fk_row_coloring_conditions_id: affectedRowColorConditionId,
                ncMeta,
              }),
            );
            const rowColoringConditionsFromView =
              await RowColorCondition.getByViewId(
                context,
                rowColorCondition.fk_view_id,
              );
            if (
              !rowColoringConditionsFromView.some(
                (rowColor) => rowColor.id !== rowColorCondition.id,
              )
            ) {
              // if not has other condition, remove the row coloring setting altogether
              commitHandlers.push(() =>
                this.removeRowColorInfo(context, {
                  fk_view_id: rowColorCondition.fk_view_id,
                  ncMeta,
                }),
              );
            }
          }
        }
      }
    }

    return {
      applyRowColorInvolvement: async () => {
        for (const handler of commitHandlers) {
          await handler();
        }
      },
    };
  }

  // Atomic wipe-and-rebuild of a view's row coloring state. Used by the
  // command-registry as the inverse of `rowColorSelectSet` and
  // `rowColoringRemove` — both flip `row_coloring_mode` so a point inverse
  // would have to branch on prior mode and reconstruct meta or the
  // condition+filter tree case-by-case. One restore primitive keeps the
  // dispatch simple.
  @TraceCommand(OperationName.rowColoringRestore)
  @EEOnly()
  async restoreRowColoring(
    context: NcContext,
    param: {
      fk_view_id: string;
      snapshot: {
        row_coloring_mode: string | null;
        meta?: unknown;
        conditions?: Array<
          Partial<RowColorCondition> & {
            id: string;
            nestedFilters?: Array<
              Partial<FilterType> & { children?: Partial<FilterType>[] }
            >;
          }
        >;
      };
      req?: NcRequest;
      viewWebhookManager?: ViewWebhookManager;
      ncMeta?: MetaService;
    },
  ) {
    const ncMeta = param.ncMeta ?? Noco.ncMeta;

    const view = await View.get(context, param.fk_view_id);
    if (!view) {
      NcError.get(context).viewNotFound(param.fk_view_id);
    }

    const viewWebhookManager =
      param.viewWebhookManager ??
      (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(view.id)
      ).forUpdate();

    const ncMetaTrans = await ncMeta.startTransaction();
    try {
      // Wipe current state regardless of the snapshot mode — the snapshot is
      // authoritative and we want to fully replace, not merge.
      const existing = await RowColorCondition.getByViewId(
        context,
        view.id,
        ncMetaTrans,
      );
      for (const cond of existing) {
        await ncMetaTrans.metaDelete(
          context.workspace_id,
          context.base_id,
          MetaTable.FILTER_EXP,
          { fk_row_color_condition_id: cond.id },
        );
        await ncMetaTrans.metaDelete(
          context.workspace_id,
          context.base_id,
          MetaTable.ROW_COLOR_CONDITIONS,
          cond.id,
        );
      }

      const targetMode = param.snapshot.row_coloring_mode ?? null;

      if (targetMode === ROW_COLORING_MODE.FILTER) {
        for (const cond of param.snapshot.conditions ?? []) {
          await RowColorCondition.insert(
            context,
            {
              id: cond.id,
              fk_view_id: view.id,
              fk_workspace_id: context.workspace_id,
              base_id: context.base_id,
              color: cond.color as string,
              nc_order: cond.nc_order as number,
              is_set_as_background: !!cond.is_set_as_background,
              type: (cond.type as string) ?? 'row',
              fk_target_column_id: cond.fk_target_column_id,
            },
            ncMetaTrans,
          );
          for (const root of cond.nestedFilters ?? []) {
            await this.insertRowColorFilterSubtree(
              context,
              cond.id,
              root,
              ncMetaTrans,
            );
          }
        }
      }

      const viewUpdate: Record<string, unknown> = {
        row_coloring_mode: targetMode,
      };
      if (targetMode === ROW_COLORING_MODE.SELECT && param.snapshot.meta) {
        viewUpdate.meta = param.snapshot.meta;
      } else if (targetMode === null) {
        // Clear any lingering rowColoringInfo on the view's meta.
        const currentMeta = parseProp(view.meta) ?? {};
        delete (currentMeta as Record<string, unknown>).rowColoringInfo;
        viewUpdate.meta = currentMeta;
      }
      // `View.update` accepts a partial of the typed view shape; the dynamic
      // `viewUpdate` is built per-mode above (mode + optional meta), so cast.
      await View.update(
        context,
        view.id,
        viewUpdate as Parameters<typeof View.update>[2],
        false,
        ncMetaTrans,
      );

      await ncMetaTrans.commit();
    } catch (e) {
      await ncMetaTrans.rollback(e);
      if (e instanceof NcError || e instanceof NcBaseError) throw e;
      this.logger.error('Failed to restore row coloring', e);
      NcError.get(context).internalServerError(
        'Failed to restore row coloring',
      );
    }

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'row_color_update',
          payload: await this.getByViewId(context, {
            fk_view_id: view.id,
            ncMeta,
          }),
        },
      },
      context.socket_id,
    );
    // Mode/meta changes also need a `view_update` so the FE picks up the
    // mode flip on the cached view object.
    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'view_update',
          payload: {
            ...(await View.get(context, view.id)),
            from_row_color: true,
          },
        },
      },
      context.socket_id,
    );

    if (!param.viewWebhookManager) {
      (await viewWebhookManager.withNewViewId(view.id)).emit();
    }
  }
}

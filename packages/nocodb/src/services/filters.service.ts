import { Injectable } from '@nestjs/common';
import RowColorCondition from 'src/models/RowColorCondition';
import { Injectable, Logger } from '@nestjs/common';
import { AppEvents, comparisonOpList, EventType, UITypes } from 'nocodb-sdk';
import type { FilterReqType, FilterType, UserType, ViewType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { ViewWebhookManager } from '~/utils/view-webhook-manager';
import type { MetaService } from 'src/meta/meta.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import NocoSocket from '~/socket/NocoSocket';
import { ViewWebhookManagerBuilder } from '~/utils/view-webhook-manager';
import { Column, Filter, Hook, View } from '~/models';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

@Injectable()
export class FiltersService {
  protected readonly logger = new Logger(FiltersService.name);
  constructor(protected readonly appHooksService: AppHooksService) {}

  async hookFilterCreate(
    context: NcContext,
    param: {
      filter: FilterReqType;
      hookId: any;
      user: UserType;
      req: NcRequest;
    },
  ) {
    validatePayload('swagger.json#/components/schemas/FilterReq', param.filter);

    const hook = await Hook.get(context, param.hookId);

    if (!hook) {
      NcError.badRequest('Hook not found');
    }

    const filter = await Filter.insert(context, {
      ...param.filter,
      fk_hook_id: param.hookId,
    });

    this.appHooksService.emit(AppEvents.FILTER_CREATE, {
      filter,
      hook,
      req: param.req,
      context,
    });
    return filter;
  }

  async hookFilterList(context: NcContext, param: { hookId: any }) {
    return Filter.rootFilterListByHook(context, { hookId: param.hookId });
  }

  async filterDelete(
    context: NcContext,
    param: { filterId: string; req: NcRequest },
    ncMeta?: MetaService,
  ) {
    const filter = await Filter.get(context, param.filterId);

    if (!filter) {
      NcError.badRequest('Filter not found');
    }

    const parentData = await filter.extractRelatedParentMetas(context);

    let viewWebhookManager: ViewWebhookManager;
    if (filter.fk_view_id) {
      const view = await View.get(context, filter.fk_view_id, ncMeta);
      viewWebhookManager = (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(filter.fk_view_id)
      ).forUpdate();
    } else if (filter.fk_row_color_condition_id) {
      const rowColorCondition = await RowColorCondition.getById(
        context,
        filter.fk_row_color_condition_id,
        ncMeta,
      );
      const view = await View.get(
        context,
        rowColorCondition.fk_view_id,
        ncMeta,
      );
      viewWebhookManager = (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(rowColorCondition.fk_view_id)
      ).forUpdate();
    }
    await Filter.delete(context, param.filterId);

    this.appHooksService.emit(AppEvents.FILTER_DELETE, {
      filter,
      req: param.req,
      context,
      ...parentData,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'filter_delete',
          payload: filter,
        },
      },
      context.socket_id,
    );

    if (viewWebhookManager) {
      (
        await viewWebhookManager.withNewViewId(viewWebhookManager.getViewId())
      ).emit();
    }
    return true;
  }

  async filterCreate(
    context: NcContext,
    param: {
      filter: FilterReqType;
      viewId: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    validatePayload('swagger.json#/components/schemas/FilterReq', param.filter);

    const view = await View.get(context, param.viewId);

    const viewWebhookManager: ViewWebhookManager = (
      await (
        await new ViewWebhookManagerBuilder(context).withModelId(
          view.fk_model_id,
        )
      ).withViewId(param.viewId)
    ).forUpdate();

    const filter = await Filter.insert(context, {
      ...param.filter,
      fk_view_id: param.viewId,
    });

    this.appHooksService.emit(AppEvents.FILTER_CREATE, {
      filter,
      view,
      req: param.req,
      context,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'filter_create',
          payload: filter,
        },
      },
      context.socket_id,
    );

    if (viewWebhookManager) {
      (
        await viewWebhookManager.withNewViewId(viewWebhookManager.getViewId())
      ).emit();
    }
    return filter;
  }

  async filterUpdate(
    context: NcContext,
    param: {
      filter: FilterReqType;
      filterId: string;
      user: UserType;
      req: NcRequest;
    },
    ncMeta?: MetaService,
  ) {
    validatePayload('swagger.json#/components/schemas/FilterReq', param.filter);

    const filter = await Filter.get(context, param.filterId, ncMeta);

    let viewWebhookManager: ViewWebhookManager;
    if (filter.fk_view_id) {
      const view = await View.get(context, filter.fk_view_id, ncMeta);
      viewWebhookManager = (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(filter.fk_view_id)
      ).forUpdate();
    } else if (filter.fk_row_color_condition_id) {
      const rowColorCondition = await RowColorCondition.getById(
        context,
        filter.fk_row_color_condition_id,
        ncMeta,
      );
      const view = await View.get(
        context,
        rowColorCondition.fk_view_id,
        ncMeta,
      );
      viewWebhookManager = (
        await (
          await new ViewWebhookManagerBuilder(context, ncMeta).withModelId(
            view.fk_model_id,
          )
        ).withViewId(rowColorCondition.fk_view_id)
      ).forUpdate();
    }

    if (!filter) {
      NcError.badRequest('Filter not found');
    }
    // todo: type correction
    const res = await Filter.update(
      context,
      param.filterId,
      param.filter as Filter,
      ncMeta,
    );

    const parentData = await filter.extractRelatedParentMetas(context, ncMeta);

    this.appHooksService.emit(AppEvents.FILTER_UPDATE, {
      filter: { ...filter, ...param.filter },
      oldFilter: filter,
      req: param.req,
      ...parentData,
      context,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'filter_update',
          payload: filter,
        },
      },
      context.socket_id,
    );

    if (viewWebhookManager) {
      (
        await viewWebhookManager.withNewViewId(viewWebhookManager.getViewId())
      ).emit();
    }
    return res;
  }

  async filterChildrenList(context: NcContext, param: { filterId: string }) {
    return Filter.parentFilterList(context, {
      parentId: param.filterId,
    });
  }

  async filterGet(context: NcContext, param: { filterId: string }) {
    const filter = await Filter.get(context, param.filterId);
    return filter;
  }

  async filterList(
    context: NcContext,
    param: { viewId: string; includeAllFilters?: boolean },
  ) {
    const filter = await (param.includeAllFilters
      ? Filter.allViewFilterList(context, { viewId: param.viewId })
      : Filter.rootFilterList(context, { viewId: param.viewId }));

    return filter;
  }

  async linkFilterCreate(
    _context: NcContext,
    _param: {
      filter: any;
      columnId: string;
      user: UserType;
      req: NcRequest;
    },
  ): Promise<any> {
    // placeholder method
    return null;
  }

  /**
   * Transform filters for a column type change - remove incompatible ones
   * Works for all filter types: hook, link, grid, etc.
   */
  async transformFiltersForColumnTypeChange(
    context: NcContext,
    columnId: string,
    newColumnType: UITypes,
    oldColumnType: UITypes,
    sqlUi: any,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    // Get all filters that reference this column from all tables
    const filtersToCheck = await this.getAllFiltersForColumn(
      context,
      columnId,
      ncMeta,
    );

    // Remove incompatible filters
    for (const filter of filtersToCheck) {
      const validation = this.validateFilterForTypeChange(
        filter,
        newColumnType,
        oldColumnType,
        sqlUi,
      );
      console.log(validation);
      if (validation.shouldRemove) {
        await this.deleteFilter(context, filter.id, ncMeta);
      }
    }
  }

  /**
   * Get all filters that reference a specific column from all filter tables
   */
  private async getAllFiltersForColumn(
    context: NcContext,
    columnId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<FilterType[]> {
    const filters: FilterType[] = [];

    try {
      // Query nc_filter table directly for all filters referencing this column
      const filterResults = await ncMeta
        .knex(MetaTable.FILTER_EXP)
        .where({
          base_id: context.base_id,
          ...(context.workspace_id
            ? { fk_workspace_id: context.workspace_id }
            : {}),
        })
        .where('fk_column_id', columnId)
        .select('*');

      // Convert to FilterType objects
      for (const row of filterResults) {
        filters.push({
          id: row.id,
          fk_column_id: row.fk_column_id,
          comparison_op: row.comparison_op,
          comparison_sub_op: row.comparison_sub_op,
          value: row.value,
          logical_op: row.logical_op,
          is_group: row.is_group,
          fk_view_id: row.fk_view_id,
          fk_hook_id: row.fk_hook_id,
          fk_parent_id: row.fk_parent_id,
          children: [], // Will be populated if needed
        });
      }
    } catch (error) {
      console.warn(
        `Failed to query filters for column ${columnId}: ${error.message}`,
      );
    }

    return filters;
  }

  /**
   * Delete a filter directly from the database
   */
  private async deleteFilter(
    context: NcContext,
    filterId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    try {
      // Delete directly from nc_filters table
      await Filter.delete(context, filterId, ncMeta);
    } catch (error) {
      console.warn(`Failed to delete filter ${filterId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if an operator is compatible with a column type
   */
  isOperatorCompatible(
    operator: string,
    columnType: UITypes,
    oldColumnType: UITypes,
  ): boolean {
    const operators = comparisonOpList(columnType);
    const oldOperators = comparisonOpList(oldColumnType);

    const isInOldOperators = oldOperators.find((op) => op.value === operator);

    return operators.some(
      (op) =>
        op.value === operator &&
        (isInOldOperators?.text === op.text) && (
          (op.includedTypes && op.includedTypes?.includes(columnType)) ||
            (op.excludedTypes && !op.excludedTypes?.includes(columnType)),
        ),
    );
  }
    }

  /**
   * Validate if a filter should be removed due to column type change
   */
  validateFilterForTypeChange(
    filter: FilterType,
    newColumnType: UITypes,
    oldColumnType: UITypes,
    sqlUI: any,
  ): { shouldRemove: boolean; reason?: string } {
    const operator = filter.comparison_op;
    if (!operator) {
      return {
        shouldRemove: true,
        reason: 'Filter has no comparison operator',
      };
    }

    // check if abstract type changed
    const oldAbstractType = sqlUI.getAbstractType({ uidt: oldColumnType });
    const newAbstractType = sqlUI.getAbstractType({ uidt: newColumnType });

    console.log(
      newColumnType,
      oldColumnType,
      `Validating filter ${filter.id}: ${oldAbstractType} -> ${newAbstractType}, operator: ${operator}`,
    );
    if (oldAbstractType !== newAbstractType) {
      return {
        shouldRemove: true,
        reason: `Column abstract type changed from ${oldAbstractType} to ${newAbstractType}`,
      };
    }

    // Check if operator is compatible with new type
    if (this.isOperatorCompatible(operator, newColumnType, oldColumnType)) {
      return { shouldRemove: false };
    }

    // Operator is not compatible, filter must be removed
    return {
      shouldRemove: true,
      reason: `Operator ${operator} is not compatible with column type ${newColumnType}`,
    };
  }

  /**
   * Get all operators compatible with a column type
   */
  getCompatibleOperators(columnType: UITypes): string[] {
    const operators = comparisonOpList(columnType);
    return operators.map((op) => op.value);
  }
}

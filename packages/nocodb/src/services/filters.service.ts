import { Injectable } from '@nestjs/common';
import RowColorCondition from 'src/models/RowColorCondition';
import { AppEvents, EventType, UITypes } from 'nocodb-sdk';
import type { FilterReqType, FilterType, UserType, ViewType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { ViewWebhookManager } from '~/utils/view-webhook-manager';
import type { MetaService } from 'src/meta/meta.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { FilterOperatorRegistryService } from '~/services/filter-operator-registry.service';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import NocoSocket from '~/socket/NocoSocket';
import { ViewWebhookManagerBuilder } from '~/utils/view-webhook-manager';
import { Column, Filter, Hook, View } from '~/models';
import Noco from '~/Noco';

export interface FilterTransformationImpact {
  viewId: string;
  viewTitle: string;
  originalFilters: FilterType;
  transformedFilters: FilterType | null;
  removedFilters: FilterType[];
  modifiedFilters: FilterType[];
  reason: string;
}

export interface ColumnTypeChangeImpact {
  columnId: string;
  columnTitle: string;
  fromType: UITypes;
  toType: UITypes;
  impactedViews: FilterTransformationImpact[];
  totalViewsImpacted: number;
  totalFiltersRemoved: number;
  totalFiltersModified: number;
}

@Injectable()
export class FiltersService {
  constructor(
    protected readonly appHooksService: AppHooksService,
    protected readonly filterOperatorRegistry: FilterOperatorRegistryService,
  ) {}

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
   * Analyze the impact of a column type change on all views and filters
   */
  async analyzeColumnTypeChangeImpact(
    context: NcContext,
    columnId: string,
    fromType: UITypes,
    toType: UITypes,
    ncMeta = Noco.ncMeta,
  ): Promise<ColumnTypeChangeImpact> {
    const column = await Column.get(context, { colId: columnId }, ncMeta);
    if (!column) {
      throw new Error(`Column ${columnId} not found`);
    }

    // Get all views that reference this column
    const views = await this.getViewsReferencingColumn(
      context,
      columnId,
      ncMeta,
    );

    const impactedViews: FilterTransformationImpact[] = [];
    let totalFiltersRemoved = 0;
    let totalFiltersModified = 0;

    for (const view of views) {
      const impact = await this.analyzeViewFilterImpact(
        context,
        view,
        columnId,
        fromType,
        toType,
        ncMeta,
      );

      if (impact) {
        impactedViews.push(impact);
        totalFiltersRemoved += impact.removedFilters.length;
        totalFiltersModified += impact.modifiedFilters.length;
      }
    }

    return {
      columnId,
      columnTitle: column.title,
      fromType,
      toType,
      impactedViews,
      totalViewsImpacted: impactedViews.length,
      totalFiltersRemoved,
      totalFiltersModified,
    };
  }

  /**
   * Transform all filters for a column type change
   */
  async transformFiltersForColumnTypeChange(
    context: NcContext,
    columnId: string,
    fromType: UITypes,
    toType: UITypes,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const impact = await this.analyzeColumnTypeChangeImpact(
      context,
      columnId,
      fromType,
      toType,
      ncMeta,
    );

    // Apply transformations to each impacted view
    for (const viewImpact of impact.impactedViews) {
      await this.applyFilterTransformationToView(
        context,
        viewImpact.viewId,
        viewImpact.transformedFilters,
        ncMeta,
      );
    }

    // Log the transformation
    await this.logFilterTransformation(context, impact, ncMeta);
  }

  /**
   * Get all views that reference a specific column
   */
  private async getViewsReferencingColumn(
    context: NcContext,
    columnId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ViewType[]> {
    // Get the column to find its model ID
    const column = await Column.get(context, { colId: columnId }, ncMeta);
    if (!column) {
      throw new Error(`Column ${columnId} not found`);
    }

    // Get all views in the model
    const views = await View.list(context, column.fk_model_id, ncMeta);

    const viewsWithFilters: ViewType[] = [];

    for (const view of views) {
      try {
        const filters = await Filter.getFilterObject(
          context,
          {
            viewId: view.id,
          },
          ncMeta,
        );

        // Check if this view has filters that reference the column
        if (this.viewReferencesColumn(filters, columnId)) {
          viewsWithFilters.push(view);
        }
      } catch (error) {
        // Log warning but continue processing other views
        console.warn(
          `Failed to get filters for view ${view.id}: ${error.message}`,
        );
      }
    }

    return viewsWithFilters;
  }

  /**
   * Check if a view's filters reference a specific column
   */
  private viewReferencesColumn(filters: FilterType, columnId: string): boolean {
    if (!filters || !filters.children) {
      return false;
    }

    return this.filterTreeReferencesColumn(filters.children, columnId);
  }

  /**
   * Recursively check if a filter tree references a specific column
   */
  private filterTreeReferencesColumn(
    filters: FilterType[],
    columnId: string,
  ): boolean {
    for (const filter of filters) {
      if (filter.fk_column_id === columnId) {
        return true;
      }

      if (filter.children && filter.children.length > 0) {
        if (this.filterTreeReferencesColumn(filter.children, columnId)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Analyze the impact of a column type change on a specific view
   */
  private async analyzeViewFilterImpact(
    context: NcContext,
    view: ViewType,
    columnId: string,
    fromType: UITypes,
    toType: UITypes,
    ncMeta = Noco.ncMeta,
  ): Promise<FilterTransformationImpact | null> {
    try {
      const originalFilters = await Filter.getFilterObject(
        context,
        {
          viewId: view.id,
        },
        ncMeta,
      );

      if (!originalFilters || !originalFilters.children) {
        return null;
      }

      const transformedFilters = await this.transformFilterTree(
        context,
        originalFilters.children,
        columnId,
        fromType,
        toType,
        ncMeta,
      );

      const removedFilters = this.getRemovedFilters(
        originalFilters.children,
        transformedFilters,
        columnId,
      );

      const modifiedFilters = this.getModifiedFilters(
        originalFilters.children,
        transformedFilters,
        columnId,
      );

      // Only return impact if there are actual changes
      if (removedFilters.length === 0 && modifiedFilters.length === 0) {
        return null;
      }

      return {
        viewId: view.id,
        viewTitle: view.title,
        originalFilters,
        transformedFilters:
          transformedFilters.length > 0
            ? {
                ...originalFilters,
                children: transformedFilters,
              }
            : null,
        removedFilters,
        modifiedFilters,
        reason: this.getTransformationReason(
          fromType,
          toType,
          removedFilters,
          modifiedFilters,
        ),
      };
    } catch (error) {
      console.warn(`Failed to analyze view ${view.id}: ${error.message}`);
      return null;
    }
  }

  /**
   * Transform a filter tree for a column type change
   */
  private async transformFilterTree(
    context: NcContext,
    filters: FilterType[],
    columnId: string,
    fromType: UITypes,
    toType: UITypes,
    ncMeta = Noco.ncMeta,
  ): Promise<FilterType[]> {
    const transformedFilters: FilterType[] = [];

    for (const filter of filters) {
      if (filter.is_group && filter.children) {
        // Recursively transform group filters
        const transformedChildren = await this.transformFilterTree(
          context,
          filter.children,
          columnId,
          fromType,
          toType,
          ncMeta,
        );

        if (transformedChildren.length > 0) {
          transformedFilters.push({
            ...filter,
            children: transformedChildren,
          });
        }
      } else if (filter.fk_column_id === columnId) {
        // Transform individual filter
        const transformedFilter = this.transformIndividualFilter(
          filter,
          fromType,
          toType,
        );

        if (transformedFilter) {
          transformedFilters.push(transformedFilter);
        }
      } else {
        // Keep filter unchanged
        transformedFilters.push(filter);
      }
    }

    return transformedFilters;
  }

  /**
   * Transform an individual filter for a column type change
   */
  private transformIndividualFilter(
    filter: FilterType,
    fromType: UITypes,
    toType: UITypes,
  ): FilterType | null {
    // Check if operator is still valid for the new type
    if (
      !this.filterOperatorRegistry.isOperatorCompatible(
        filter.comparison_op!,
        toType,
      )
    ) {
      return null; // Remove filter if operator is not compatible
    }

    // For incompatible type changes (like number to string, string to number),
    // we simply delete the filter instead of trying to convert it
    if (this.isIncompatibleTypeChange(fromType, toType)) {
      return null; // Remove filter for incompatible type changes
    }

    // Keep the filter unchanged if it's compatible
    return filter;
  }

  /**
   * Check if a type change is incompatible and should result in filter deletion
   */
  private isIncompatibleTypeChange(
    fromType: UITypes,
    toType: UITypes,
  ): boolean {
    // Number to String or String to Number - incompatible
    if (
      [
        UITypes.Number,
        UITypes.Decimal,
        UITypes.Currency,
        UITypes.Percent,
        UITypes.Year,
        UITypes.Duration,
        UITypes.Rating,
      ].includes(fromType) &&
      [
        UITypes.SingleLineText,
        UITypes.LongText,
        UITypes.Email,
        UITypes.PhoneNumber,
        UITypes.URL,
        UITypes.GeoData,
        UITypes.JSON,
      ].includes(toType)
    ) {
      return true;
    }

    if (
      [
        UITypes.SingleLineText,
        UITypes.LongText,
        UITypes.Email,
        UITypes.PhoneNumber,
        UITypes.URL,
        UITypes.GeoData,
        UITypes.JSON,
      ].includes(fromType) &&
      [
        UITypes.Number,
        UITypes.Decimal,
        UITypes.Currency,
        UITypes.Percent,
        UITypes.Year,
        UITypes.Duration,
        UITypes.Rating,
      ].includes(toType)
    ) {
      return true;
    }

    // Select to LinkToAnotherRecord - incompatible
    if (
      [UITypes.SingleSelect, UITypes.MultiSelect].includes(fromType) &&
      [UITypes.LinkToAnotherRecord, UITypes.Links].includes(toType)
    ) {
      return true;
    }

    // Date/Time to Text - incompatible
    if (
      [
        UITypes.Date,
        UITypes.DateTime,
        UITypes.Time,
        UITypes.CreatedTime,
        UITypes.LastModifiedTime,
      ].includes(fromType) &&
      [
        UITypes.SingleLineText,
        UITypes.LongText,
        UITypes.Email,
        UITypes.PhoneNumber,
        UITypes.URL,
        UITypes.GeoData,
        UITypes.JSON,
      ].includes(toType)
    ) {
      return true;
    }

    // Text to Date/Time - incompatible
    if (
      [
        UITypes.SingleLineText,
        UITypes.LongText,
        UITypes.Email,
        UITypes.PhoneNumber,
        UITypes.URL,
        UITypes.GeoData,
        UITypes.JSON,
      ].includes(fromType) &&
      [
        UITypes.Date,
        UITypes.DateTime,
        UITypes.Time,
        UITypes.CreatedTime,
        UITypes.LastModifiedTime,
      ].includes(toType)
    ) {
      return true;
    }

    // Checkbox to Text - incompatible
    if (
      fromType === UITypes.Checkbox &&
      [
        UITypes.SingleLineText,
        UITypes.LongText,
        UITypes.Email,
        UITypes.PhoneNumber,
        UITypes.URL,
        UITypes.GeoData,
        UITypes.JSON,
      ].includes(toType)
    ) {
      return true;
    }

    // Text to Checkbox - incompatible
    if (
      [
        UITypes.SingleLineText,
        UITypes.LongText,
        UITypes.Email,
        UITypes.PhoneNumber,
        UITypes.URL,
        UITypes.GeoData,
        UITypes.JSON,
      ].includes(fromType) &&
      toType === UITypes.Checkbox
    ) {
      return true;
    }

    return false;
  }

  /**
   * Get filters that were removed during transformation
   */
  private getRemovedFilters(
    originalFilters: FilterType[],
    transformedFilters: FilterType[],
    columnId: string,
  ): FilterType[] {
    const removed: FilterType[] = [];

    for (const originalFilter of originalFilters) {
      if (originalFilter.fk_column_id === columnId) {
        const stillExists = transformedFilters.some(
          (tf) => tf.id === originalFilter.id && tf.fk_column_id === columnId,
        );

        if (!stillExists) {
          removed.push(originalFilter);
        }
      }
    }

    return removed;
  }

  /**
   * Get filters that were modified during transformation
   */
  private getModifiedFilters(
    originalFilters: FilterType[],
    transformedFilters: FilterType[],
    columnId: string,
  ): FilterType[] {
    const modified: FilterType[] = [];

    for (const originalFilter of originalFilters) {
      if (originalFilter.fk_column_id === columnId) {
        const transformedFilter = transformedFilters.find(
          (tf) => tf.id === originalFilter.id && tf.fk_column_id === columnId,
        );

        if (
          transformedFilter &&
          this.filtersAreDifferent(originalFilter, transformedFilter)
        ) {
          modified.push(originalFilter);
        }
      }
    }

    return modified;
  }

  /**
   * Check if two filters are different
   */
  private filtersAreDifferent(
    filter1: FilterType,
    filter2: FilterType,
  ): boolean {
    return (
      filter1.comparison_op !== filter2.comparison_op ||
      filter1.comparison_sub_op !== filter2.comparison_sub_op ||
      filter1.value !== filter2.value ||
      filter1.logical_op !== filter2.logical_op
    );
  }

  /**
   * Get a human-readable reason for the transformation
   */
  private getTransformationReason(
    fromType: UITypes,
    toType: UITypes,
    removedFilters: FilterType[],
    modifiedFilters: FilterType[],
  ): string {
    if (removedFilters.length > 0 && modifiedFilters.length === 0) {
      return `Column type changed from ${fromType} to ${toType}. ${removedFilters.length} filter(s) removed due to incompatibility.`;
    } else if (removedFilters.length === 0 && modifiedFilters.length > 0) {
      return `Column type changed from ${fromType} to ${toType}. ${modifiedFilters.length} filter(s) kept unchanged.`;
    } else if (removedFilters.length > 0 && modifiedFilters.length > 0) {
      return `Column type changed from ${fromType} to ${toType}. ${removedFilters.length} filter(s) removed due to incompatibility, ${modifiedFilters.length} filter(s) kept unchanged.`;
    } else {
      return `Column type changed from ${fromType} to ${toType}. No filters were affected.`;
    }
  }

  /**
   * Apply transformed filters to a view
   */
  private async applyFilterTransformationToView(
    context: NcContext,
    viewId: string,
    transformedFilters: FilterType | null,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    try {
      if (transformedFilters === null) {
        // Remove all filters for this view
        await Filter.deleteAll(context, viewId, ncMeta);
      } else {
        // Update filters for this view
        await this.updateViewFilters(
          context,
          viewId,
          transformedFilters,
          ncMeta,
        );
      }
    } catch (error) {
      console.error(
        `Failed to apply filter transformation to view ${viewId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Update filters for a view
   */
  private async updateViewFilters(
    context: NcContext,
    viewId: string,
    filters: FilterType,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    // First, remove all existing filters
    await Filter.deleteAll(context, viewId, ncMeta);

    // Then, insert the new transformed filters
    if (filters.children && filters.children.length > 0) {
      await this.insertFilterTree(
        context,
        viewId,
        filters.children,
        null,
        ncMeta,
      );
    }
  }

  /**
   * Recursively insert a filter tree
   */
  private async insertFilterTree(
    context: NcContext,
    viewId: string,
    filters: FilterType[],
    parentId: string | null,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    for (const filter of filters) {
      const insertData = {
        ...filter,
        fk_view_id: viewId,
        fk_parent_id: parentId,
      };

      const insertedFilter = await Filter.insert(context, insertData, ncMeta);

      if (filter.children && filter.children.length > 0) {
        await this.insertFilterTree(
          context,
          viewId,
          filter.children,
          insertedFilter.id,
          ncMeta,
        );
      }
    }
  }

  /**
   * Log the filter transformation for audit purposes
   */
  private async logFilterTransformation(
    context: NcContext,
    impact: ColumnTypeChangeImpact,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    // This could be extended to write to an audit log table
    console.log(
      `Filter transformation completed for column ${impact.columnTitle}: ${impact.totalViewsImpacted} views impacted, ${impact.totalFiltersRemoved} filters removed, ${impact.totalFiltersModified} filters modified`,
    );
  }

  /**
   * Get a summary of the transformation impact for user display
   */
  getTransformationSummary(impact: ColumnTypeChangeImpact): string {
    const { totalViewsImpacted, totalFiltersRemoved, totalFiltersModified } =
      impact;

    let summary = `Column type change will impact ${totalViewsImpacted} view(s). `;

    if (totalFiltersRemoved > 0) {
      summary += `${totalFiltersRemoved} filter(s) will be removed. `;
    }

    if (totalFiltersModified > 0) {
      summary += `${totalFiltersModified} filter(s) will be modified. `;
    }

    if (totalFiltersRemoved === 0 && totalFiltersModified === 0) {
      summary += 'No filters will be affected.';
    }

    return summary;
  }

  /**
   * Check if a column type change requires user confirmation
   */
  requiresUserConfirmation(impact: ColumnTypeChangeImpact): boolean {
    return impact.totalFiltersRemoved > 0 || impact.totalFiltersModified > 0;
  }
}

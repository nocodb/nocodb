import { isOrderCol, ViewTypes } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { Model, View } from '~/models';
import {
  CalendarRange,
  DateDependency,
  Filter,
  GalleryView,
  GridViewColumn,
  KanbanView,
  KanbanViewColumn,
  TimelineRange,
} from '~/models';
import { View as ViewModel } from '~/models';

/**
 * The columns a VIEW exposes, plus the per-view-type extras resolution needs.
 *
 * "Exposed" is wider than the field menu's `show` flag: the layout-driving
 * columns count too — grid group-by, kanban stack, gallery/kanban cover image,
 * calendar/timeline/gantt ranges — since their values position what the viewer
 * sees.
 *
 * Single source of truth for two gates that MUST agree: `getAst`'s `allowedCols`
 * (what lands in the payload) and `restrictSharedViewQuery` (what a shared-view
 * caller may name in `where`/`sort`/`groupby`/`aggregation`). Computed
 * separately they would drift, and either direction is a bug — too narrow breaks
 * a legitimate query on a shown column, too wide reopens the hidden-column
 * oracle.
 */
export interface ViewVisibleColumns {
  /** `{ [columnId]: truthy }` for every column the view exposes. */
  allowedCols: Record<string, unknown>;
  /** Gallery/kanban cover image column id, if any. */
  coverImageId?: string;
  /** Kanban stack-by column id, if any. */
  kanbanGroupColumnId?: string;
  /** Calendar / timeline / gantt range (and gantt dep-link) column ids. */
  dependencyFieldsForRangeView?: string[];
  /** View-owned sort column ids (only populated when asked for). */
  sortColumnIds: string[];
  /** View-owned filter column ids (only populated when asked for). */
  filterColumnIds: string[];
}

export async function resolveViewVisibleColumns(
  context: NcContext,
  {
    model,
    view,
    includeSortAndFilterColumns = false,
  }: {
    model: Model;
    view?: View;
    /**
     * Also treat the view's OWN sort/filter columns as exposed. Off by default —
     * a view may sort/filter on a column it does not show, and those conditions
     * come from the view config, not from caller input.
     */
    includeSortAndFilterColumns?: boolean;
  },
): Promise<ViewVisibleColumns> {
  let coverImageId: string | undefined;
  let dependencyFieldsForRangeView: string[] | undefined;
  let kanbanGroupColumnId: string | undefined;
  let sortColumnIds: string[] = [];
  let filterColumnIds: string[] = [];

  if (view && view.type === ViewTypes.GALLERY) {
    const gallery = await GalleryView.get(context, view.id);
    coverImageId = gallery.fk_cover_image_col_id;
  } else if (view && view.type === ViewTypes.KANBAN) {
    const kanban = await KanbanView.get(context, view.id);
    coverImageId = kanban.fk_cover_image_col_id;
    kanbanGroupColumnId = kanban.fk_grp_col_id;
  } else if (view && view.type === ViewTypes.CALENDAR) {
    const calenderRanges = await CalendarRange.read(context, view.id);
    if (calenderRanges) {
      dependencyFieldsForRangeView = calenderRanges.ranges
        .flatMap((obj) =>
          [obj.fk_from_column_id, (obj as any).fk_to_column_id].filter(Boolean),
        )
        .map(String);
    }
  } else if (view && view.type === ViewTypes.TIMELINE) {
    // Timeline date columns (start/end) drive the bar position. They are
    // typically hidden in the Fields menu, so without explicitly forcing
    // them through `allowedCols`, the data response would strip the values
    // and the frontend would treat every record as "without dates".
    const timelineRanges = await TimelineRange.read(context, view.id);
    if (timelineRanges) {
      dependencyFieldsForRangeView = timelineRanges.ranges
        .flatMap((obj) =>
          [obj.fk_from_column_id, (obj as any).fk_to_column_id].filter(Boolean),
        )
        .map(String);
    }
  } else if (view && view.type === ViewTypes.GANTT) {
    // Gantt consumes a DateDependency rule (EE-only). View-owned rule
    // (fk_gantt_view_id = view.id) takes precedence, with fallback to the
    // table-level default (fk_gantt_view_id IS NULL). Start/end date and
    // dep-link columns often aren't "shown" on the view, so we augment
    // the range-field list the same way Calendar does. CE's DateDependency
    // stub returns null from both methods, so this block is an effective
    // no-op in CE.
    const dep =
      (await DateDependency.getByGanttViewId(context, view.id)) ||
      (await DateDependency.getByModelId(context, model.id));
    if (dep && dep.is_active !== false) {
      dependencyFieldsForRangeView = [
        dep.fk_start_date_field_id,
        dep.fk_end_date_field_id,
        dep.fk_dependency_linkrow_field_id,
      ]
        .filter(Boolean)
        .map(String);
    }
  }

  if (view && includeSortAndFilterColumns) {
    const sorts = await view.getSorts(context);
    const filters = await Filter.allViewFilterList(context, {
      viewId: view.id,
    });
    sortColumnIds = sorts.map((s) => s.fk_column_id);
    filterColumnIds = filters.map((f) => f.fk_column_id);
  }

  if (!model.columns?.length) await model.getColumns(context);

  if (includeSortAndFilterColumns) {
    const orderCol = model.columns.find((c) => isOrderCol(c));
    if (orderCol) {
      sortColumnIds.push(orderCol.id);
    }
  }

  let allowedCols: Record<string, unknown> = null;
  if (view) {
    allowedCols = (await ViewModel.getColumns(context, view.id)).reduce<
      Record<string, unknown>
    >(
      (o, c) => ({
        ...o,
        [c.fk_column_id]:
          c.show ||
          (c instanceof GridViewColumn && c.group_by) ||
          (c instanceof KanbanViewColumn &&
            c.fk_column_id === kanbanGroupColumnId),
      }),
      {},
    );
    if (coverImageId) {
      allowedCols[coverImageId] = 1;
    }
    if (dependencyFieldsForRangeView) {
      dependencyFieldsForRangeView.forEach((id) => {
        allowedCols[id] = 1;
      });
    }
    if (includeSortAndFilterColumns) {
      sortColumnIds.forEach((id) => (allowedCols[id] = 1));
      filterColumnIds.forEach((id) => (allowedCols[id] = 1));
    }
  }

  return {
    allowedCols,
    coverImageId,
    kanbanGroupColumnId,
    dependencyFieldsForRangeView,
    sortColumnIds,
    filterColumnIds,
  };
}

/**
 * The exposed set as a plain id Set — the shape the query sanitizers want.
 *
 * Primary keys are always included: a row id is not confidential (every public
 * row response carries it, and `/rows/:rowId/...` takes it in the URL), and
 * excluding it would break paging/sorting on a view whose pk is unshown.
 */
export async function getViewExposedColumnIds(
  context: NcContext,
  { model, view }: { model: Model; view?: View },
): Promise<Set<string>> {
  const { allowedCols } = await resolveViewVisibleColumns(context, {
    model,
    view,
  });

  if (!model.columns?.length) await model.getColumns(context);

  const exposed = new Set<string>();
  for (const column of model.columns) {
    if (column.pk || !allowedCols || allowedCols[column.id]) {
      exposed.add(column.id);
    }
  }
  return exposed;
}

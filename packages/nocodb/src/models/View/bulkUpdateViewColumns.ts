import { VIEW_GRID_DEFAULT_WIDTH, ViewTypes } from 'nocodb-sdk';
import type {
  CalendarColumnReqType,
  FormColumnReqType,
  GalleryColumnReqType,
  GridColumnReqType,
  KanbanColumnReqType,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import { extractProps } from '~/helpers/extractProps';
import { serializeJSON } from '~/utils/serialize';
import { CacheDelDirection } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import View from '~/models/View';
import Noco from '~/Noco';

export interface BulkUpdateViewColumnsResult {
  updatedCount: number;
  insertedCount: number;
  view: View;
}

/**
 * Internal helper: Get properties to extract for each view type
 */
function getPropsForViewType(viewType: ViewTypes): string[] {
  switch (viewType) {
    case ViewTypes.GRID:
      return [
        'order',
        'show',
        'width',
        'group_by',
        'group_by_order',
        'group_by_sort',
        'aggregation',
      ];
    case ViewTypes.GALLERY:
    case ViewTypes.KANBAN:
    case ViewTypes.MAP:
      return ['order', 'show'];
    case ViewTypes.FORM:
      return [
        'label',
        'help',
        'description',
        'required',
        'show',
        'order',
        'meta',
        'enable_scanner',
      ];
    case ViewTypes.CALENDAR:
      return ['order', 'show', 'bold', 'italic', 'underline'];
    default:
      return ['order', 'show'];
  }
}

function getDefaultPropsForViewType(viewType: ViewTypes) {
  switch (viewType) {
    case ViewTypes.GRID:
      return {
        width: VIEW_GRID_DEFAULT_WIDTH,
      };
    default:
      return {};
  }
}

/**
 * Internal helper: Prepare column data for insertion/update
 * Handles view-type-specific transformations (e.g., Form meta serialization)
 */
function prepareColumnData(
  viewType: ViewTypes,
  column: any,
  propsToExtract: string[],
): any {
  const defaultProps = getDefaultPropsForViewType(viewType);
  let data: any = { ...defaultProps, ...extractProps(column, propsToExtract) };

  // Form view: serialize meta field
  if (viewType === ViewTypes.FORM && data.meta) {
    data = { ...data, meta: serializeJSON(data.meta) };
  }

  return data;
}

export type UpdateViewColumnsPayload = { fk_column_id: string } & (
  | GridColumnReqType
  | GalleryColumnReqType
  | KanbanColumnReqType
  | FormColumnReqType
  | CalendarColumnReqType
);

/**
 * Bulk update view columns - optimized for performance
 *
 * This function handles bulk insert/update operations for view columns,
 * replacing the N+1 query pattern with batch operations.
 *
 * Performance improvements:
 * - Single batch query to check existing columns (instead of N queries)
 * - Bulk insert for new columns
 * - Parallel updates for existing columns
 * - Single cache clear at the end (handled by caller)
 *
 * @param context - NocoDB context
 * @param viewId - ID of the view
 * @param view - View object
 * @param columns - Array of column data to update/insert (each must have 'id' field)
 * @param ncMeta - Meta service instance (usually within a transaction)
 * @returns Result with counts and cache clear flag
 */
export async function bulkUpdateViewColumns(
  context: NcContext,
  {
    view,
    viewId,
    columns,
  }: {
    viewId: string;
    view?: View;
    columns: UpdateViewColumnsPayload[];
  },
  ncMeta: MetaService = Noco.ncMeta,
): Promise<BulkUpdateViewColumnsResult> {
  // probably can use ncMeta metaget directly than using View.get
  view = view ?? (await View.get(context, viewId, ncMeta));

  // STEP 1: Get table and properties configuration for this view type
  const metaTableName = View.extractViewColumnsTableName(view);
  const propsToExtract = getPropsForViewType(view.type);

  // STEP 2: Batch existence check - single query instead of N queries
  const existingColumns = await ncMeta.metaList2(
    context.workspace_id,
    context.base_id,
    metaTableName,
    { condition: { fk_view_id: viewId } },
  );

  let maxOrder = existingColumns
    .map((col) => col.order)
    .sort((a, b) => b - a)[0];
  const getNextOrder = () => ++maxOrder;

  // Build Map for O(1) lookup
  const existingColsMap = new Map(
    existingColumns.map((col) => [col.fk_column_id, col]),
  );

  // STEP 3: Separate updates and inserts
  const updatesData: Array<{ id: string; data: any }> = [];
  const insertsData: any[] = [];

  for (const column of columns) {
    // Extract column ID from the column object
    const columnId = column.fk_column_id;

    // Check if column exists
    const existingCol = existingColsMap.get(columnId);

    // Prepare data with view-type-specific transformations
    const data = prepareColumnData(view.type, column, propsToExtract);

    if (existingCol) {
      // UPDATE - column already exists
      updatesData.push({ id: existingCol.id, data });
    } else {
      // INSERT - new column
      // Mark order as null if not provided - will generate in bulk later
      if (data.order === undefined) {
        data.order = null;
      }

      insertsData.push({
        ...data,
        fk_view_id: viewId,
        fk_column_id: columnId,
        base_id: view.base_id,
        source_id: view.source_id,
      });
    }
  }

  // STEP 4: Generate order values for inserts if needed
  if (insertsData.length > 0) {
    const insertsNeedingOrder = insertsData.filter((d) => d.order === null);

    if (insertsNeedingOrder.length > 0) {
      for (const insertData of insertsNeedingOrder) {
        insertData.order = getNextOrder();
      }
    }
  }

  // STEP 5: Execute batch database operations
  const operations = [];

  // Parallel updates - each column has different data, so we run them in parallel
  if (updatesData.length > 0) {
    const updatePromises = updatesData.map(({ id, data }) =>
      ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        metaTableName,
        data,
        id,
      ),
    );
    operations.push(...updatePromises);
  }

  // Bulk inserts - single operation for all new columns
  if (insertsData.length > 0) {
    operations.push(
      ncMeta.bulkMetaInsert(
        context.workspace_id,
        context.base_id,
        metaTableName,
        insertsData,
      ),
    );
  }

  // Wait for all operations to complete
  await Promise.all(operations);

  // STEP 6: View-type-specific post-processing
  // Grid view requires fixing the primary value column visibility after inserts
  if (view.type === ViewTypes.GRID && insertsData.length > 0) {
    await View.fixPVColumnForView(context, viewId, ncMeta);
  }
  await View.clearSingleQueryCache(context, view.fk_model_id, [view], ncMeta);

  // Clear view columns list cache after bulk operations
  // This ensures the next read will fetch fresh data from the database
  const columnTableScope = View.extractViewColumnsTableNameScope(view);
  await NocoCache.deepDel(
    context,
    `${columnTableScope}:${viewId}`,
    CacheDelDirection.PARENT_TO_CHILD,
  );

  // STEP 7: Return results
  return {
    updatedCount: updatesData.length,
    insertedCount: insertsData.length,
    view: await View.get(context, viewId, ncMeta),
  };
}

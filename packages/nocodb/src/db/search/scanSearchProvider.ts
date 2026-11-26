import { isSystemColumn } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import { View } from '~/models';
import { isSharedViewAccess } from '~/helpers/accessSource';

/**
 * The fields a search reads. Matching itself is `IndexSearchProvider`'s
 * (`cellMatchFor`), live and indexed alike.
 */
export class ScanSearchProvider {
  /** The view's visible fields (all fields without a view). */
  async searchableColumns(baseModel: IBaseModelSqlV2) {
    const columns = await baseModel.model.getColumns();
    // A shared view never publishes a hidden field, display value included.
    const alwaysPv = !isSharedViewAccess(baseModel.context);

    let visible: Set<string> | undefined;
    if (baseModel.viewId) {
      const viewColumns = await View.getColumns(
        baseModel.context,
        baseModel.viewId,
      );
      if (viewColumns?.length) {
        visible = new Set(
          viewColumns.filter((vc) => vc.show).map((vc) => vc.fk_column_id),
        );
      }
    }

    return columns.filter(
      (c) =>
        ((c.pv && alwaysPv) || !visible || visible.has(c.id)) &&
        (c.pv || !isSystemColumn(c)),
    );
  }
}

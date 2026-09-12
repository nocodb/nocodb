import {
  isCreatedOrLastModifiedTimeCol,
  isSupportedDisplayValueColumn,
  isSystemColumn,
} from 'nocodb-sdk';
import type { ColumnType } from 'nocodb-sdk';

export default function mapDefaultDisplayValue<T extends ColumnType>(
  columnsArr: Array<T>,
): void | T {
  if (!columnsArr.some((column) => column.pv)) {
    const pkIndex = columnsArr.findIndex((column) => column.pk);

    // find first supported display value column which is not a primary key
    // nor a system column. Primary keys are excluded here (not just via
    // isSystemColumn) because some sources don't flag a PK as auto-generated:
    // e.g. an external Oracle table whose PK is populated by a sequence+trigger
    // rather than an IDENTITY column reports ai=false/cdf=null, so isSystemColumn
    // returns false and the opaque numeric PK (e.g. city_id) would otherwise be
    // picked as the display value instead of a real column (e.g. city name).
    // When the PK is the only viable column, the fallbacks below still pick it.
    const displayValueColumn = columnsArr.find(
      (column) =>
        !column.pk &&
        isSupportedDisplayValueColumn(column) &&
        !isSystemColumn(column) &&
        !isCreatedOrLastModifiedTimeCol(column),
    );

    if (displayValueColumn) {
      displayValueColumn.pv = true;
      return displayValueColumn;
    }

    // Fallback: pick the first non-system column
    const fallback = columnsArr.find((column) => !isSystemColumn(column));
    if (fallback) {
      fallback.pv = true;
      return fallback;
    }

    // Last resort: pick any non-pk column by position
    // if PK is at the end of table
    if (pkIndex === columnsArr.length - 1) {
      if (pkIndex > 0) {
        columnsArr[pkIndex - 1].pv = true;
        return columnsArr[pkIndex - 1];
      } else if (columnsArr.length > 0) {
        columnsArr[0].pv = true;
        return columnsArr[0];
      }
      // pk is not at the end of table
    } else if (pkIndex > -1) {
      columnsArr[pkIndex + 1].pv = true;
      return columnsArr[pkIndex + 1];
      //  no pk at all
    } else {
      if (columnsArr.length > 0) {
        columnsArr[0].pv = true;
        return columnsArr[0];
      }
    }
  }
}

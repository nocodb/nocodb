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

    // find first supported display value column which is not system column
    const displayValueColumn = columnsArr.find(
      (column) =>
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

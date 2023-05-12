import type { ColumnType } from 'nocodb-sdk';

export default function mapDefaultDisplayValue<T extends ColumnType>(
  columnsArr: Array<T>
): void | T {
  if (!columnsArr.some((column) => column.pv)) {
    const pkIndex = columnsArr.findIndex((column) => column.pk);

    if (pkIndex === -1) {
      columnsArr[0].pv = true;
      return columnsArr[0];
    }

    columnsArr[pkIndex].pv = true;
    return columnsArr[pkIndex];
  }
}

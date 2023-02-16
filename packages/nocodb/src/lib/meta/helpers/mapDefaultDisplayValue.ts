import { ColumnType } from 'nocodb-sdk';

export default function mapDefaultDisplayValue<T extends ColumnType>(
  columnsArr: Array<T>
): void | T {
  if (!columnsArr.some((column) => column.pv)) {
    let len = columnsArr.length;
    let pkIndex = -1;

    while (len--) {
      if (columnsArr[len].pk) {
        pkIndex = len;
        break;
      }
    }

    // if PK is at the end of table
    if (pkIndex === columnsArr.length - 1) {
      if (pkIndex > 0) {
        columnsArr[pkIndex - 1].pv = true;
        return columnsArr[pkIndex - 1];
      }
    }
    // pk is not at the end of table
    else if (pkIndex > -1) {
      columnsArr[pkIndex + 1].pv = true;
      return columnsArr[pkIndex + 1];
    }
    //  no pk at all
    else {
      // todo:
    }
  }
}

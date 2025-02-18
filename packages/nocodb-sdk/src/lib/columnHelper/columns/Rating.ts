import { ColumnType } from '~/lib/Api';
import { parseIntValue, serializeIntValue } from '..';
import AbstractColumnHelper from '../column.interface';
import { parseProp } from '~/lib/helperFunctions';

export class RatingHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    iconIdx: 0,
    icon: {
      full: 'mdi-star',
      empty: 'mdi-star-outline',
    },
    color: '#fcb401',
    max: 5,
  };

  serializeValue(value: any, col: ColumnType): number | null {
    const res = serializeIntValue(value);

    if (res) {
      return Math.min(
        res,
        parseProp(col.meta)?.max || this.columnDefaultMeta.max
      );
    }

    return res;
  }

  parseValue(value: any): string | number | null {
    return parseIntValue(value);
  }

  parsePlainCellValue(value: any, col: ColumnType): string {
    return `${parseIntValue(value, col) ?? ''}`;
  }
}

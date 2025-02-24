import { ColumnType } from '~/lib/Api';
import AbstractColumnHelper from '../column.interface';
import { parseProp } from '~/lib/helperFunctions';
import { ColumnHelper } from '../column-helper';

export class FormulaHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(_value?: any): null {
    return null;
  }

  parseValue(value: any, col: ColumnType): string | null {
    const columnMeta = parseProp(col?.meta);
    const childColumn = {
      uidt: columnMeta.display_type,
      ...columnMeta.display_column_meta,
    };

    return ColumnHelper.parseValue(value, childColumn);
  }

  parsePlainCellValue(value: any, col: ColumnType): string {
    return this.parseValue(value, col) ?? '';
  }
}

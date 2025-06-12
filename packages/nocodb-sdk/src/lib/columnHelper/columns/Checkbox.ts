import { ColumnType } from '~/lib/Api';
import { parseCheckboxValue, serializeCheckboxValue } from '..';
import AbstractColumnHelper from '../column.interface';
import { populateFillHandleStrictCopy } from '../utils/fill-handler';

export class CheckboxHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    iconIdx: 0,
    icon: {
      checked: 'mdi-check-bold',
      unchecked: 'mdi-crop-square',
    },
    color: '#777',
  };

  serializeValue(value: any): boolean {
    return serializeCheckboxValue(value);
  }

  parseValue(value: any): boolean {
    return parseCheckboxValue(value);
  }

  parsePlainCellValue(value: any): string {
    return parseCheckboxValue(value) ? 'Checked' : 'Unchecked';
  }

  // simply copy highlighted rows
  override populateFillHandle(params: {
    column: ColumnType;
    highlightedData: any[];
    numberOfRows: number;
  }): any[] {
    return populateFillHandleStrictCopy(params);
  }
}

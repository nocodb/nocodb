import { parseCheckboxValue, serializeCheckboxValue } from '..';
import AbstractColumnHelper from '../column.interface';

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
}

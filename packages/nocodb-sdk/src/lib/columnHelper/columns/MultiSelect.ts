import { ncIsArray } from '~/lib/is';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { serializeSelectValue } from '../utils';
import { ColumnType } from '~/lib/Api';
import { populateFillHandleStrictCopy } from '../utils/fill-handler';

export class MultiSelectHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string {
    return serializeSelectValue(value, params.col);
  }

  parseValue(value: any): string | null {
    if (!value) return null;

    if (ncIsArray(value)) {
      return value.join(', ');
    }

    return value.toString().split(',').join(', ');
  }

  parsePlainCellValue(value: any): string {
    return this.parseValue(value) ?? '';
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
